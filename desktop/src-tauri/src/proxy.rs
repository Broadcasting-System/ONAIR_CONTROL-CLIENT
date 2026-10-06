//! 로컬 프록시.
//! 웹뷰는 http://127.0.0.1:<포트>/ 만 본다. 프록시가 HTTP·WebSocket 을 서버로 넘기면서
//! Cloudflare Access 헤더(CF-Access-Client-Id / Secret)를 붙인다 → 토큰은 JS 로 절대 안 간다.
//!
//! 경로 → 업스트림: 기본은 `/api`(및 `/api/*/ws`) → API 서버, 나머지 → 컨트롤 UI 서버.
//! 다른 프로그램·웹사이트가 이 포트를 악용하지 못하게, 웹뷰만 아는 세션 쿠키가 있어야 통과시킨다.

use std::convert::Infallible;
use std::net::SocketAddr;
use std::sync::{Arc, RwLock};
use std::time::Duration;

use bytes::Bytes;
use futures_util::{SinkExt, StreamExt, TryStreamExt};
use http_body_util::{combinators::BoxBody, BodyExt, Full, StreamBody};
use hyper::body::{Frame, Incoming};
use hyper::header::{self, HeaderMap, HeaderName, HeaderValue};
use hyper::service::service_fn;
use hyper::{Method, Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use tokio::net::TcpListener;
use tokio_tungstenite::tungstenite;
use url::Url;

use crate::pages;

pub type BoxError = Box<dyn std::error::Error + Send + Sync>;
pub type ProxyBody = BoxBody<Bytes, BoxError>;

pub const CF_ID: &str = "cf-access-client-id";
pub const CF_SECRET: &str = "cf-access-client-secret";
pub const GATE_COOKIE: &str = "onair_gate";
/// 컨트롤 UI 가 같은 주소(origin)에서 /api 를 부르도록 알려주는 스크립트
pub const SAME_ORIGIN_SCRIPT: &str = "<script>window.__ONAIR_SAME_ORIGIN__=true;window.__ONAIR_DESKTOP__=true;</script>";

/// 경로 접두사 → 업스트림
#[derive(Debug, Clone)]
pub struct Route {
    pub prefix: String,
    pub upstream: Url,
}

#[derive(Debug, Clone)]
pub struct ProxyConfig {
    pub control: Url,
    pub routes: Vec<Route>,
    pub client_id: String,
    pub client_secret: String,
}

impl ProxyConfig {
    /// 기본 규칙: /api → api 업스트림, 그 외 → control
    pub fn new(control: Url, api: Url, client_id: String, client_secret: String) -> Self {
        Self {
            control,
            routes: vec![Route { prefix: "/api".into(), upstream: api }],
            client_id,
            client_secret,
        }
    }

    /// 가장 긴 접두사가 이긴다. 접두사는 경로 구분(/) 단위로만 맞춘다 (/apix 는 /api 아님).
    pub fn route(&self, path: &str) -> &Url {
        self.routes
            .iter()
            .filter(|r| prefix_matches(&r.prefix, path))
            .max_by_key(|r| r.prefix.len())
            .map(|r| &r.upstream)
            .unwrap_or(&self.control)
    }

    pub fn is_control(&self, upstream: &Url) -> bool {
        upstream == &self.control
    }

    fn upstream_origins(&self) -> Vec<Url> {
        let mut v = vec![self.control.clone()];
        v.extend(self.routes.iter().map(|r| r.upstream.clone()));
        v
    }
}

fn prefix_matches(prefix: &str, path: &str) -> bool {
    let p = prefix.trim_end_matches('/');
    p.is_empty() || path == p || path.starts_with(&format!("{p}/")) || path.starts_with(&format!("{p}?"))
}

/// 업스트림 주소 + 요청 경로·쿼리 → 최종 주소. 업스트림에 하위 경로가 있으면 앞에 붙인다.
pub fn join_upstream(upstream: &Url, path_and_query: &str) -> Url {
    let mut u = upstream.clone();
    let base = upstream.path().trim_end_matches('/');
    let (path, query) = match path_and_query.split_once('?') {
        Some((p, q)) => (p, Some(q)),
        None => (path_and_query, None),
    };
    u.set_path(&format!("{base}{path}"));
    u.set_query(query);
    u
}

pub fn origin_of(u: &Url) -> String {
    u.origin().ascii_serialization()
}

const HOP_BY_HOP: &[&str] = &[
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "proxy-connection",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
];

const WS_HANDSHAKE: &[&str] = &[
    "sec-websocket-key",
    "sec-websocket-version",
    "sec-websocket-extensions",
    "sec-websocket-accept",
];

/// 웹뷰 → 서버로 보낼 헤더. 홉 헤더·Host·게이트 쿠키를 빼고, CF 헤더를 (덮어)쓰고,
/// Origin/Referer 는 실제 브라우저가 보냈을 서버 주소로 바꾼다.
pub fn forward_headers(incoming: &HeaderMap, cfg: &ProxyConfig, local_origin: &str, websocket: bool) -> HeaderMap {
    let mut out = HeaderMap::new();
    let control_origin = origin_of(&cfg.control);
    for (name, value) in incoming.iter() {
        let n = name.as_str();
        if HOP_BY_HOP.contains(&n) || n == "host" || (websocket && n == "content-length") {
            continue;
        }
        if websocket && WS_HANDSHAKE.contains(&n) {
            continue;
        }
        // JS 가 CF 헤더를 흉내 내지 못하게 들어온 건 버린다
        if n == CF_ID || n == CF_SECRET {
            continue;
        }
        if n == "cookie" {
            if let Some(v) = strip_gate_cookie(value.to_str().unwrap_or("")) {
                if let Ok(hv) = HeaderValue::from_str(&v) {
                    out.append(header::COOKIE, hv);
                }
            }
            continue;
        }
        if n == "origin" || n == "referer" {
            let v = value.to_str().unwrap_or("");
            let replaced = if let Some(rest) = v.strip_prefix(local_origin) {
                format!("{control_origin}{rest}")
            } else {
                v.to_string()
            };
            if let Ok(hv) = HeaderValue::from_str(&replaced) {
                out.append(name.clone(), hv);
            }
            continue;
        }
        out.append(name.clone(), value.clone());
    }
    if let Ok(v) = HeaderValue::from_str(&cfg.client_id) {
        out.insert(HeaderName::from_static(CF_ID), v);
    }
    if let Ok(mut v) = HeaderValue::from_str(&cfg.client_secret) {
        v.set_sensitive(true);
        out.insert(HeaderName::from_static(CF_SECRET), v);
    }
    out.insert(
        HeaderName::from_static("x-onair-client"),
        HeaderValue::from_static(concat!("desktop/", env!("CARGO_PKG_VERSION"))),
    );
    out
}

/// Cookie 헤더에서 게이트 쿠키만 뺀다. 남는 게 없으면 None.
pub fn strip_gate_cookie(cookie: &str) -> Option<String> {
    let rest: Vec<&str> = cookie
        .split(';')
        .map(str::trim)
        .filter(|c| !c.is_empty() && !c.starts_with(&format!("{GATE_COOKIE}=")))
        .collect();
    if rest.is_empty() {
        None
    } else {
        Some(rest.join("; "))
    }
}

pub fn gate_cookie_value(cookie_header: &str) -> Option<&str> {
    cookie_header
        .split(';')
        .map(str::trim)
        .find_map(|c| c.strip_prefix(&format!("{GATE_COOKIE}=")).map(|v| v.trim()))
}

/// 서버가 보낸 리다이렉트 주소가 업스트림이면 로컬 주소로 바꾼다.
pub fn rewrite_location(loc: &str, cfg: &ProxyConfig, local_origin: &str) -> String {
    let Ok(u) = Url::parse(loc) else { return loc.to_string() };
    for up in cfg.upstream_origins() {
        if u.origin() == up.origin() {
            let base = up.path().trim_end_matches('/');
            let path = u.path().strip_prefix(base).unwrap_or(u.path());
            let path = if path.is_empty() { "/" } else { path };
            let mut s = format!("{local_origin}{path}");
            if let Some(q) = u.query() {
                s.push('?');
                s.push_str(q);
            }
            if let Some(f) = u.fragment() {
                s.push('#');
                s.push_str(f);
            }
            return s;
        }
    }
    loc.to_string()
}

/// Set-Cookie 의 Domain·Secure 를 지운다 (로컬은 http://127.0.0.1 이라).
pub fn rewrite_set_cookie(v: &str) -> String {
    v.split(';')
        .map(str::trim)
        .filter(|p| {
            let l = p.to_ascii_lowercase();
            !(l.starts_with("domain=") || l == "secure")
        })
        .collect::<Vec<_>>()
        .join("; ")
}

/// Cloudflare Access 가 막았는지 (로그인 페이지로 돌리거나 401/403)
pub fn is_cf_access_block(status: StatusCode, headers: &HeaderMap) -> bool {
    if status.is_redirection() {
        if let Some(loc) = headers.get(header::LOCATION).and_then(|v| v.to_str().ok()) {
            return loc.contains(".cloudflareaccess.com") || loc.contains("/cdn-cgi/access/");
        }
    }
    if status == StatusCode::FORBIDDEN || status == StatusCode::UNAUTHORIZED {
        return headers.contains_key("cf-ray")
            && headers
                .get(header::SERVER)
                .and_then(|v| v.to_str().ok())
                .map(|s| s.eq_ignore_ascii_case("cloudflare"))
                .unwrap_or(false)
            && headers
                .get(header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .map(|c| c.starts_with("text/html"))
                .unwrap_or(false);
    }
    false
}

/// HTML <head> 바로 뒤에 같은-주소 표시 스크립트를 넣는다.
pub fn inject_same_origin(html: &[u8]) -> Vec<u8> {
    let lower: Vec<u8> = html.iter().map(|b| b.to_ascii_lowercase()).collect();
    let script = SAME_ORIGIN_SCRIPT.as_bytes();
    let pos = find(&lower, b"<head")
        .and_then(|i| find(&lower[i..], b">").map(|j| i + j + 1))
        .or_else(|| find(&lower, b"<html").and_then(|i| find(&lower[i..], b">").map(|j| i + j + 1)))
        .unwrap_or(0);
    let mut out = Vec::with_capacity(html.len() + script.len());
    out.extend_from_slice(&html[..pos]);
    out.extend_from_slice(script);
    out.extend_from_slice(&html[pos..]);
    out
}

fn find(hay: &[u8], needle: &[u8]) -> Option<usize> {
    hay.windows(needle.len()).position(|w| w == needle)
}

fn wants_html(headers: &HeaderMap) -> bool {
    headers
        .get(header::ACCEPT)
        .and_then(|v| v.to_str().ok())
        .map(|a| a.contains("text/html"))
        .unwrap_or(false)
}

fn is_websocket(req: &Request<Incoming>) -> bool {
    let h = req.headers();
    let upgrade = h
        .get(header::UPGRADE)
        .and_then(|v| v.to_str().ok())
        .map(|v| v.eq_ignore_ascii_case("websocket"))
        .unwrap_or(false);
    let conn = h
        .get(header::CONNECTION)
        .and_then(|v| v.to_str().ok())
        .map(|v| v.to_ascii_lowercase().contains("upgrade"))
        .unwrap_or(false);
    upgrade && conn
}

/// 프록시가 앱에 부탁하는 일 (오류 페이지의 '설정 열기' 버튼 등)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProxyAction {
    OpenSettings,
    ShowSetup,
}

pub type ActionHandler = Arc<dyn Fn(ProxyAction) + Send + Sync>;

pub struct ProxyState {
    pub port: u16,
    pub session_key: String,
    config: RwLock<Option<ProxyConfig>>,
    http: reqwest::Client,
    on_action: RwLock<Option<ActionHandler>>,
}

impl ProxyState {
    pub fn local_origin(&self) -> String {
        format!("http://127.0.0.1:{}", self.port)
    }
    pub fn boot_url(&self) -> String {
        format!("{}/__onair/boot?k={}", self.local_origin(), self.session_key)
    }
    pub fn set_config(&self, cfg: Option<ProxyConfig>) {
        *self.config.write().unwrap() = cfg;
    }
    pub fn config(&self) -> Option<ProxyConfig> {
        self.config.read().unwrap().clone()
    }
    pub fn set_action_handler(&self, h: ActionHandler) {
        *self.on_action.write().unwrap() = Some(h);
    }
    pub fn http(&self) -> &reqwest::Client {
        &self.http
    }
}

pub fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(10))
        .build()
        .expect("http client")
}

fn random_key() -> String {
    use rand::Rng;
    let bytes: [u8; 24] = rand::thread_rng().gen();
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// 프록시 시작. preferred 포트를 먼저 시도하고(지난번 포트 → 웹뷰 저장소 유지), 안 되면 아무 빈 포트.
pub async fn start(preferred_port: Option<u16>) -> std::io::Result<Arc<ProxyState>> {
    let listener = match preferred_port {
        Some(p) if p != 0 => match TcpListener::bind(("127.0.0.1", p)).await {
            Ok(l) => l,
            Err(_) => TcpListener::bind(("127.0.0.1", 0)).await?,
        },
        _ => TcpListener::bind(("127.0.0.1", 0)).await?,
    };
    let port = listener.local_addr()?.port();
    let state = Arc::new(ProxyState {
        port,
        session_key: random_key(),
        config: RwLock::new(None),
        http: http_client(),
        on_action: RwLock::new(None),
    });
    let st = state.clone();
    tokio::spawn(async move {
        loop {
            let (stream, _peer): (_, SocketAddr) = match listener.accept().await {
                Ok(x) => x,
                Err(e) => {
                    log::warn!("proxy accept 실패: {e}");
                    tokio::time::sleep(Duration::from_millis(100)).await;
                    continue;
                }
            };
            let st = st.clone();
            tokio::spawn(async move {
                let svc = service_fn(move |req| {
                    let st = st.clone();
                    async move { Ok::<_, Infallible>(handle(st, req).await) }
                });
                if let Err(e) = hyper::server::conn::http1::Builder::new()
                    .serve_connection(TokioIo::new(stream), svc)
                    .with_upgrades()
                    .await
                {
                    log::debug!("proxy 연결 종료: {e}");
                }
            });
        }
    });
    log::info!("로컬 프록시 시작: 127.0.0.1:{port}");
    Ok(state)
}

fn full(b: impl Into<Bytes>) -> ProxyBody {
    Full::new(b.into()).map_err(|e| match e {}).boxed()
}

fn html_response(status: StatusCode, html: String) -> Response<ProxyBody> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
        .header(header::CACHE_CONTROL, "no-store")
        .body(full(html))
        .unwrap()
}

fn plain(status: StatusCode, msg: &'static str) -> Response<ProxyBody> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .body(full(msg))
        .unwrap()
}

/// Host 가 우리 로컬 주소인지 (DNS 리바인딩 방지)
fn host_ok(headers: &HeaderMap, port: u16) -> bool {
    let Some(h) = headers.get(header::HOST).and_then(|v| v.to_str().ok()) else { return false };
    h == format!("127.0.0.1:{port}") || h == format!("localhost:{port}")
}

pub async fn handle(st: Arc<ProxyState>, req: Request<Incoming>) -> Response<ProxyBody> {
    if !host_ok(req.headers(), st.port) {
        return plain(StatusCode::FORBIDDEN, "bad host");
    }
    let path = req.uri().path().to_string();

    // 웹뷰 처음 진입: 세션 키 확인 → 쿠키 심고 / 로
    if path == "/__onair/boot" {
        let ok = req
            .uri()
            .query()
            .map(|q| q.split('&').any(|kv| kv == format!("k={}", st.session_key)))
            .unwrap_or(false);
        if !ok {
            return plain(StatusCode::FORBIDDEN, "bad key");
        }
        return Response::builder()
            .status(StatusCode::FOUND)
            .header(header::LOCATION, "/")
            .header(
                header::SET_COOKIE,
                format!("{GATE_COOKIE}={}; Path=/; HttpOnly; SameSite=Strict", st.session_key),
            )
            .header(header::CACHE_CONTROL, "no-store")
            .body(full(""))
            .unwrap();
    }

    let gate_ok = req
        .headers()
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok())
        .any(|c| gate_cookie_value(c) == Some(st.session_key.as_str()));
    if !gate_ok {
        return plain(StatusCode::FORBIDDEN, "ONAIR 앱 안에서만 열 수 있어요.");
    }

    // 오류 페이지 버튼 → 앱 동작
    if let Some(name) = path.strip_prefix("/__onair/action/") {
        if req.method() != Method::POST {
            return plain(StatusCode::METHOD_NOT_ALLOWED, "POST only");
        }
        let action = match name {
            "settings" => ProxyAction::OpenSettings,
            "setup" => ProxyAction::ShowSetup,
            _ => return plain(StatusCode::NOT_FOUND, "unknown action"),
        };
        if let Some(h) = st.on_action.read().unwrap().clone() {
            h(action);
        }
        return plain(StatusCode::NO_CONTENT, "");
    }

    let Some(cfg) = st.config() else {
        return html_response(StatusCode::SERVICE_UNAVAILABLE, pages::not_configured());
    };

    let pq = req
        .uri()
        .path_and_query()
        .map(|p| p.as_str().to_string())
        .unwrap_or_else(|| "/".into());
    let upstream = cfg.route(&path).clone();
    let target = join_upstream(&upstream, &pq);
    let local_origin = st.local_origin();

    if is_websocket(&req) {
        return proxy_websocket(req, &cfg, target, &local_origin).await;
    }
    proxy_http(&st, req, &cfg, &upstream, target, &local_origin).await
}

async fn proxy_http(
    st: &ProxyState,
    req: Request<Incoming>,
    cfg: &ProxyConfig,
    upstream: &Url,
    target: Url,
    local_origin: &str,
) -> Response<ProxyBody> {
    let navigation = wants_html(req.headers()) && req.method() == Method::GET;
    let inject = navigation && cfg.is_control(upstream);
    let mut headers = forward_headers(req.headers(), cfg, local_origin, false);
    if inject {
        // HTML 에 스크립트를 넣어야 하니 압축 없이 받는다
        headers.insert(header::ACCEPT_ENCODING, HeaderValue::from_static("identity"));
    }
    let method = req.method().clone();
    let body_stream = req.into_body().into_data_stream();
    let rb = st
        .http
        .request(method, target.clone())
        .headers(headers)
        .body(reqwest::Body::wrap_stream(body_stream));

    let resp = match rb.send().await {
        Ok(r) => r,
        Err(e) => {
            log::warn!("업스트림 연결 실패 {target}: {e}");
            if navigation {
                return html_response(StatusCode::BAD_GATEWAY, pages::unreachable(&origin_of(upstream), &e.to_string()));
            }
            return plain(StatusCode::BAD_GATEWAY, "upstream unreachable");
        }
    };

    let status = resp.status();
    if navigation && is_cf_access_block(status, resp.headers()) {
        log::warn!("Cloudflare Access 거부: {status} {target}");
        return html_response(StatusCode::FORBIDDEN, pages::access_denied(&origin_of(&cfg.control)));
    }

    let mut out = Response::builder().status(status);
    let is_html = resp
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|c| c.starts_with("text/html"))
        .unwrap_or(false);
    let encoded = resp
        .headers()
        .get(header::CONTENT_ENCODING)
        .and_then(|v| v.to_str().ok())
        .map(|v| !v.eq_ignore_ascii_case("identity"))
        .unwrap_or(false);
    let do_inject = inject && is_html && !encoded;

    for (name, value) in resp.headers().iter() {
        let n = name.as_str();
        if HOP_BY_HOP.contains(&n) || (do_inject && n == "content-length") {
            continue;
        }
        if n == "location" {
            let v = rewrite_location(value.to_str().unwrap_or(""), cfg, local_origin);
            if let Ok(hv) = HeaderValue::from_str(&v) {
                out = out.header(name, hv);
            }
            continue;
        }
        if n == "set-cookie" {
            let v = rewrite_set_cookie(value.to_str().unwrap_or(""));
            if let Ok(hv) = HeaderValue::from_str(&v) {
                out = out.header(name, hv);
            }
            continue;
        }
        out = out.header(name, value);
    }

    if do_inject {
        match resp.bytes().await {
            Ok(b) => out.body(full(inject_same_origin(&b))).unwrap(),
            Err(e) => html_response(StatusCode::BAD_GATEWAY, pages::unreachable(&origin_of(upstream), &e.to_string())),
        }
    } else {
        let stream = resp.bytes_stream().map_ok(Frame::data).map_err(|e| Box::new(e) as BoxError);
        out.body(BodyExt::boxed(StreamBody::new(stream))).unwrap()
    }
}

/// WebSocket: 서버 쪽에 CF 헤더를 붙여 먼저 연결하고, 성공하면 웹뷰에 101 을 돌려 양쪽을 잇는다.
async fn proxy_websocket(
    mut req: Request<Incoming>,
    cfg: &ProxyConfig,
    target: Url,
    local_origin: &str,
) -> Response<ProxyBody> {
    use tungstenite::client::IntoClientRequest;
    use tungstenite::handshake::derive_accept_key;
    use tungstenite::protocol::Role;

    let Some(key) = req.headers().get("sec-websocket-key").cloned() else {
        return plain(StatusCode::BAD_REQUEST, "missing websocket key");
    };
    let mut ws_url = target.clone();
    let scheme = if target.scheme() == "https" { "wss" } else { "ws" };
    let _ = ws_url.set_scheme(scheme);

    let mut up_req = match ws_url.as_str().into_client_request() {
        Ok(r) => r,
        Err(e) => {
            log::warn!("ws 요청 만들기 실패: {e}");
            return plain(StatusCode::BAD_GATEWAY, "bad upstream url");
        }
    };
    for (name, value) in forward_headers(req.headers(), cfg, local_origin, true).iter() {
        up_req.headers_mut().insert(name.clone(), value.clone());
    }

    let (upstream_ws, up_resp) = match tokio_tungstenite::connect_async(up_req).await {
        Ok(x) => x,
        Err(e) => {
            log::warn!("ws 업스트림 연결 실패 {ws_url}: {e}");
            return plain(StatusCode::BAD_GATEWAY, "upstream websocket failed");
        }
    };
    let protocol = up_resp.headers().get("sec-websocket-protocol").cloned();

    let on_upgrade = hyper::upgrade::on(&mut req);
    tokio::spawn(async move {
        let upgraded = match on_upgrade.await {
            Ok(u) => u,
            Err(e) => {
                log::warn!("ws 업그레이드 실패: {e}");
                return;
            }
        };
        let client_ws =
            tokio_tungstenite::WebSocketStream::from_raw_socket(TokioIo::new(upgraded), Role::Server, None).await;
        pipe_ws(client_ws, upstream_ws).await;
    });

    let mut resp = Response::builder()
        .status(StatusCode::SWITCHING_PROTOCOLS)
        .header(header::CONNECTION, "Upgrade")
        .header(header::UPGRADE, "websocket")
        .header("sec-websocket-accept", derive_accept_key(key.as_bytes()));
    if let Some(p) = protocol {
        resp = resp.header("sec-websocket-protocol", p);
    }
    resp.body(full("")).unwrap()
}

async fn pipe_ws<A, B>(a: tokio_tungstenite::WebSocketStream<A>, b: tokio_tungstenite::WebSocketStream<B>)
where
    A: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin,
    B: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin,
{
    let (mut a_tx, mut a_rx) = a.split();
    let (mut b_tx, mut b_rx) = b.split();
    let a_to_b = async {
        while let Some(Ok(msg)) = a_rx.next().await {
            let close = msg.is_close();
            if b_tx.send(msg).await.is_err() || close {
                break;
            }
        }
        let _ = b_tx.close().await;
    };
    let b_to_a = async {
        while let Some(Ok(msg)) = b_rx.next().await {
            let close = msg.is_close();
            if a_tx.send(msg).await.is_err() || close {
                break;
            }
        }
        let _ = a_tx.close().await;
    };
    tokio::select! {
        _ = a_to_b => {},
        _ = b_to_a => {},
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use std::sync::Mutex;

    fn cfg(control: &str, api: &str) -> ProxyConfig {
        ProxyConfig::new(
            Url::parse(control).unwrap(),
            Url::parse(api).unwrap(),
            "id-123.access".into(),
            "top-secret".into(),
        )
    }

    // ---------- 순수 함수 ----------

    #[test]
    fn routes_by_prefix_on_segment_boundary() {
        let mut c = cfg("http://ui:3001", "http://api:8000");
        c.routes.push(Route { prefix: "/api/display/ws".into(), upstream: Url::parse("http://ws:9000").unwrap() });
        assert_eq!(c.route("/").as_str(), "http://ui:3001/");
        assert_eq!(c.route("/_next/static/x.js").as_str(), "http://ui:3001/");
        assert_eq!(c.route("/api").as_str(), "http://api:8000/");
        assert_eq!(c.route("/api/members/me").as_str(), "http://api:8000/");
        assert_eq!(c.route("/apix").as_str(), "http://ui:3001/");
        // 더 긴 접두사가 이긴다
        assert_eq!(c.route("/api/display/ws").as_str(), "http://ws:9000/");
    }

    #[test]
    fn default_routes_send_ws_under_api_to_api() {
        let c = cfg("https://onair.example", "http://10.0.0.1:8000");
        assert_eq!(c.route("/api/display/ws").as_str(), "http://10.0.0.1:8000/");
        assert_eq!(c.route("/api/halls/1/ws").as_str(), "http://10.0.0.1:8000/");
        assert_eq!(c.route("/media").as_str(), "https://onair.example/");
    }

    #[test]
    fn joins_upstream_with_base_path() {
        let u = Url::parse("https://x.example/onair/").unwrap();
        assert_eq!(join_upstream(&u, "/api/a?b=1&c=2").as_str(), "https://x.example/onair/api/a?b=1&c=2");
        let u = Url::parse("http://x:8000").unwrap();
        assert_eq!(join_upstream(&u, "/").as_str(), "http://x:8000/");
    }

    #[test]
    fn injects_cf_headers_and_strips_spoofed_and_hop_headers() {
        let c = cfg("https://onair.example", "https://onair.example");
        let mut h = HeaderMap::new();
        h.insert("cf-access-client-id", "evil".parse().unwrap());
        h.insert("cf-access-client-secret", "evil".parse().unwrap());
        h.insert("host", "127.0.0.1:5000".parse().unwrap());
        h.insert("connection", "keep-alive".parse().unwrap());
        h.insert("cookie", "a=1; onair_gate=k; b=2".parse().unwrap());
        h.insert("origin", "http://127.0.0.1:5000".parse().unwrap());
        h.insert("referer", "http://127.0.0.1:5000/media?x=1".parse().unwrap());
        h.insert("accept", "application/json".parse().unwrap());
        let out = forward_headers(&h, &c, "http://127.0.0.1:5000", false);
        assert_eq!(out.get(CF_ID).unwrap(), "id-123.access");
        assert_eq!(out.get(CF_SECRET).unwrap(), "top-secret");
        assert_eq!(out.get_all(CF_ID).iter().count(), 1);
        assert!(out.get("host").is_none());
        assert!(out.get("connection").is_none());
        assert_eq!(out.get("cookie").unwrap(), "a=1; b=2");
        assert_eq!(out.get("origin").unwrap(), "https://onair.example");
        assert_eq!(out.get("referer").unwrap(), "https://onair.example/media?x=1");
        assert_eq!(out.get("accept").unwrap(), "application/json");
    }

    #[test]
    fn websocket_forward_drops_handshake_headers() {
        let c = cfg("https://onair.example", "https://onair.example");
        let mut h = HeaderMap::new();
        h.insert("sec-websocket-key", "abc".parse().unwrap());
        h.insert("sec-websocket-version", "13".parse().unwrap());
        h.insert("sec-websocket-extensions", "permessage-deflate".parse().unwrap());
        h.insert("sec-websocket-protocol", "chat".parse().unwrap());
        h.insert("upgrade", "websocket".parse().unwrap());
        let out = forward_headers(&h, &c, "http://127.0.0.1:5000", true);
        assert!(out.get("sec-websocket-key").is_none());
        assert!(out.get("sec-websocket-extensions").is_none());
        assert!(out.get("upgrade").is_none());
        assert_eq!(out.get("sec-websocket-protocol").unwrap(), "chat");
        assert_eq!(out.get(CF_ID).unwrap(), "id-123.access");
    }

    #[test]
    fn gate_cookie_helpers() {
        assert_eq!(strip_gate_cookie("onair_gate=x"), None);
        assert_eq!(strip_gate_cookie("a=1;onair_gate=x;  b=2").as_deref(), Some("a=1; b=2"));
        assert_eq!(gate_cookie_value("a=1; onair_gate=abc"), Some("abc"));
        assert_eq!(gate_cookie_value("a=1"), None);
    }

    #[test]
    fn rewrites_location_and_cookies() {
        let c = cfg("https://onair.example", "http://api.example:8000");
        let local = "http://127.0.0.1:5000";
        assert_eq!(rewrite_location("https://onair.example/login?next=%2F#x", &c, local), "http://127.0.0.1:5000/login?next=%2F#x");
        assert_eq!(rewrite_location("http://api.example:8000/api/x", &c, local), "http://127.0.0.1:5000/api/x");
        assert_eq!(rewrite_location("/relative", &c, local), "/relative");
        assert_eq!(rewrite_location("https://other.example/", &c, local), "https://other.example/");
        assert_eq!(rewrite_set_cookie("a=b; Domain=onair.example; Secure; Path=/; HttpOnly"), "a=b; Path=/; HttpOnly");
    }

    #[test]
    fn detects_cloudflare_access_block() {
        let mut h = HeaderMap::new();
        h.insert("location", "https://bssm.cloudflareaccess.com/cdn-cgi/access/login/x".parse().unwrap());
        assert!(is_cf_access_block(StatusCode::FOUND, &h));
        let mut h = HeaderMap::new();
        h.insert("location", "/somewhere".parse().unwrap());
        assert!(!is_cf_access_block(StatusCode::FOUND, &h));
        let mut h = HeaderMap::new();
        h.insert("cf-ray", "1".parse().unwrap());
        h.insert("server", "cloudflare".parse().unwrap());
        h.insert("content-type", "text/html".parse().unwrap());
        assert!(is_cf_access_block(StatusCode::FORBIDDEN, &h));
        // 앱 자체 403(JSON)은 막힘으로 안 본다
        h.insert("content-type", "application/json".parse().unwrap());
        assert!(!is_cf_access_block(StatusCode::FORBIDDEN, &h));
    }

    #[test]
    fn injects_script_after_head() {
        let out = String::from_utf8(inject_same_origin(b"<!DOCTYPE html><html lang=\"ko\"><HEAD data-x=1><title>t</title></head></html>")).unwrap();
        assert!(out.contains(&format!("<HEAD data-x=1>{SAME_ORIGIN_SCRIPT}<title>")));
        let out = String::from_utf8(inject_same_origin(b"<html><body>x</body></html>")).unwrap();
        assert!(out.starts_with(&format!("<html>{SAME_ORIGIN_SCRIPT}")));
        let out = String::from_utf8(inject_same_origin(b"plain")).unwrap();
        assert!(out.starts_with(SAME_ORIGIN_SCRIPT));
    }

    // ---------- 실제 소켓으로: 가짜 서버 ↔ 프록시 ↔ 클라이언트 ----------

    const HTML: &[u8] = b"<html><head><title>x</title></head><body></body></html>";

    /// 받은 요청을 JSON 으로 돌려주는 가짜 업스트림
    pub(crate) async fn mock_http() -> u16 {
        let l = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let port = l.local_addr().unwrap().port();
        tokio::spawn(async move {
            loop {
                let (s, _) = l.accept().await.unwrap();
                tokio::spawn(async move {
                    let svc = service_fn(move |req: Request<Incoming>| async move {
                        let path = req.uri().path().to_string();
                        let query = req.uri().query().unwrap_or("").to_string();
                        let method = req.method().to_string();
                        let headers: serde_json::Map<String, serde_json::Value> = req
                            .headers()
                            .iter()
                            .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").into()))
                            .collect();
                        let body = req.into_body().collect().await.unwrap().to_bytes();
                        let resp = match path.as_str() {
                            "/" => Response::builder()
                                .header("content-type", "text/html; charset=utf-8")
                                // 원래 길이 그대로 → 프록시가 스크립트를 넣으면서 길이를 바르게 고쳐야 한다
                                .header("content-length", HTML.len().to_string())
                                .body(Full::new(Bytes::from_static(HTML)))
                                .unwrap(),
                            "/redirect" => Response::builder()
                                .status(302)
                                .header("location", format!("http://127.0.0.1:{port}/login"))
                                .body(Full::new(Bytes::new()))
                                .unwrap(),
                            "/cf-login" => Response::builder()
                                .status(302)
                                .header("location", "https://team.cloudflareaccess.com/cdn-cgi/access/login")
                                .body(Full::new(Bytes::new()))
                                .unwrap(),
                            "/cookie" => Response::builder()
                                .header("set-cookie", "sid=1; Domain=example.com; Secure; Path=/")
                                .body(Full::new(Bytes::new()))
                                .unwrap(),
                            _ => {
                                let j = serde_json::json!({
                                    "path": path, "query": query, "method": method,
                                    "headers": headers, "body": String::from_utf8_lossy(&body),
                                });
                                Response::builder()
                                    .header("content-type", "application/json")
                                    .body(Full::new(Bytes::from(j.to_string())))
                                    .unwrap()
                            }
                        };
                        Ok::<_, Infallible>(resp)
                    });
                    let _ = hyper::server::conn::http1::Builder::new().serve_connection(TokioIo::new(s), svc).await;
                });
            }
        });
        port
    }

    /// 받은 핸드셰이크 헤더를 기록하고 "echo:" 를 붙여 돌려주는 가짜 WebSocket 서버
    async fn mock_ws(seen: Arc<Mutex<Option<(String, HeaderMap)>>>) -> u16 {
        use tungstenite::handshake::server::{Request as WsReq, Response as WsResp};
        let l = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let port = l.local_addr().unwrap().port();
        tokio::spawn(async move {
            loop {
                let (s, _) = l.accept().await.unwrap();
                let seen = seen.clone();
                tokio::spawn(async move {
                    let cb = |req: &WsReq, resp: WsResp| {
                        *seen.lock().unwrap() = Some((req.uri().to_string(), req.headers().clone()));
                        Ok(resp)
                    };
                    let mut ws = tokio_tungstenite::accept_hdr_async(s, cb).await.unwrap();
                    while let Some(Ok(m)) = ws.next().await {
                        if let tungstenite::Message::Text(t) = m {
                            let reply = format!("echo:{}", t.as_str());
                            ws.send(tungstenite::Message::Text(reply.into())).await.unwrap();
                        } else if m.is_close() {
                            break;
                        }
                    }
                });
            }
        });
        port
    }

    struct Rig {
        st: Arc<ProxyState>,
        client: reqwest::Client,
        base: String,
        cookie: String,
        ui_port: u16,
        api_port: u16,
        ws_seen: Arc<Mutex<Option<(String, HeaderMap)>>>,
        actions: Arc<Mutex<Vec<ProxyAction>>>,
    }

    async fn rig() -> Rig {
        let ui_port = mock_http().await;
        let api_port = mock_http().await;
        let ws_seen = Arc::new(Mutex::new(None));
        let ws_port = mock_ws(ws_seen.clone()).await;
        let st = start(None).await.unwrap();
        let mut c = cfg(&format!("http://127.0.0.1:{ui_port}"), &format!("http://127.0.0.1:{api_port}"));
        c.routes.push(Route { prefix: "/api/display/ws".into(), upstream: Url::parse(&format!("http://127.0.0.1:{ws_port}")).unwrap() });
        st.set_config(Some(c));
        let actions = Arc::new(Mutex::new(vec![]));
        let a2 = actions.clone();
        st.set_action_handler(Arc::new(move |a| a2.lock().unwrap().push(a)));
        let client = http_client();
        let base = st.local_origin();
        Rig { cookie: format!("{GATE_COOKIE}={}", st.session_key), st, client, base, ui_port, api_port, ws_seen, actions }
    }

    #[tokio::test]
    async fn gate_blocks_without_session_cookie_and_bad_host() {
        let r = rig().await;
        let res = r.client.get(format!("{}/api/x", r.base)).send().await.unwrap();
        assert_eq!(res.status(), 403);
        let res = r.client.get(format!("{}/api/x", r.base)).header("cookie", "onair_gate=wrong").send().await.unwrap();
        assert_eq!(res.status(), 403);
        let res = r.client.get(format!("{}/api/x", r.base)).header("cookie", &r.cookie).header("host", "evil.example").send().await.unwrap();
        assert_eq!(res.status(), 403);
        // 부트: 틀린 키는 거부, 맞는 키는 쿠키 + / 로
        let res = r.client.get(format!("{}/__onair/boot?k=nope", r.base)).send().await.unwrap();
        assert_eq!(res.status(), 403);
        let res = r.client.get(r.st.boot_url()).send().await.unwrap();
        assert_eq!(res.status(), 302);
        assert_eq!(res.headers()["location"], "/");
        let sc = res.headers()["set-cookie"].to_str().unwrap();
        assert!(sc.starts_with(&r.cookie) && sc.contains("HttpOnly") && sc.contains("SameSite=Strict"));
    }

    #[tokio::test]
    async fn forwards_api_to_api_upstream_with_cf_headers() {
        let r = rig().await;
        let res = r
            .client
            .post(format!("{}/api/members/register?x=1", r.base))
            .header("cookie", format!("theme=dark; {}", r.cookie))
            .header("cf-access-client-id", "spoofed")
            .header("origin", &r.base)
            .body("{\"name\":\"홍길동\"}")
            .send()
            .await
            .unwrap();
        assert_eq!(res.status(), 200);
        let j: serde_json::Value = serde_json::from_slice(&res.bytes().await.unwrap()).unwrap();
        assert_eq!(j["path"], "/api/members/register");
        assert_eq!(j["query"], "x=1");
        assert_eq!(j["method"], "POST");
        assert_eq!(j["body"], "{\"name\":\"홍길동\"}");
        let h = &j["headers"];
        assert_eq!(h["host"], format!("127.0.0.1:{}", r.api_port));
        assert_eq!(h["cf-access-client-id"], "id-123.access");
        assert_eq!(h["cf-access-client-secret"], "top-secret");
        assert_eq!(h["cookie"], "theme=dark");
        assert_eq!(h["origin"], format!("http://127.0.0.1:{}", r.ui_port));
    }

    #[tokio::test]
    async fn forwards_pages_to_control_and_injects_same_origin_flag() {
        let r = rig().await;
        let res = r
            .client
            .get(format!("{}/", r.base))
            .header("cookie", &r.cookie)
            .header("accept", "text/html,application/xhtml+xml")
            .header("accept-encoding", "gzip, br")
            .send()
            .await
            .unwrap();
        assert_eq!(res.status(), 200);
        let body = res.text().await.unwrap();
        assert!(body.contains(&format!("<head>{SAME_ORIGIN_SCRIPT}<title>")), "{body}");
        // 그 밖의 경로는 컨트롤 서버로 그대로
        let res = r.client.get(format!("{}/_next/static/a.js", r.base)).header("cookie", &r.cookie).send().await.unwrap();
        let j: serde_json::Value = serde_json::from_slice(&res.bytes().await.unwrap()).unwrap();
        assert_eq!(j["headers"]["host"], format!("127.0.0.1:{}", r.ui_port));
        assert_eq!(j["headers"]["cf-access-client-id"], "id-123.access");
    }

    #[tokio::test]
    async fn rewrites_redirects_cookies_and_shows_fallbacks() {
        let r = rig().await;
        let res = r.client.get(format!("{}/redirect", r.base)).header("cookie", &r.cookie).send().await.unwrap();
        assert_eq!(res.status(), 302);
        assert_eq!(res.headers()["location"], format!("{}/login", r.base));
        let res = r.client.get(format!("{}/cookie", r.base)).header("cookie", &r.cookie).send().await.unwrap();
        assert_eq!(res.headers()["set-cookie"], "sid=1; Path=/");
        // Cloudflare 로그인으로 돌리면 → 접속 키 거부 화면
        let res = r
            .client
            .get(format!("{}/cf-login", r.base))
            .header("cookie", &r.cookie)
            .header("accept", "text/html")
            .send()
            .await
            .unwrap();
        assert_eq!(res.status(), 403);
        assert!(res.text().await.unwrap().contains("접속 키가 거부됐어요"));
        // 서버가 꺼져 있으면 → 연결 실패 화면
        r.st.set_config(Some(cfg("http://127.0.0.1:1", "http://127.0.0.1:1")));
        let res = r.client.get(format!("{}/", r.base)).header("cookie", &r.cookie).header("accept", "text/html").send().await.unwrap();
        assert_eq!(res.status(), 502);
        assert!(res.text().await.unwrap().contains("서버에 연결할 수 없어요"));
        // 등록 안 됨
        r.st.set_config(None);
        let res = r.client.get(format!("{}/", r.base)).header("cookie", &r.cookie).send().await.unwrap();
        assert_eq!(res.status(), 503);
    }

    #[tokio::test]
    async fn fallback_page_buttons_reach_the_app() {
        let r = rig().await;
        let res = r.client.post(format!("{}/__onair/action/settings", r.base)).header("cookie", &r.cookie).send().await.unwrap();
        assert_eq!(res.status(), 204);
        let res = r.client.post(format!("{}/__onair/action/setup", r.base)).header("cookie", &r.cookie).send().await.unwrap();
        assert_eq!(res.status(), 204);
        // 쿠키 없으면 안 됨
        let res = r.client.post(format!("{}/__onair/action/settings", r.base)).send().await.unwrap();
        assert_eq!(res.status(), 403);
        assert_eq!(*r.actions.lock().unwrap(), vec![ProxyAction::OpenSettings, ProxyAction::ShowSetup]);
    }

    #[tokio::test]
    async fn proxies_websocket_with_cf_headers() {
        use tungstenite::client::IntoClientRequest;
        let r = rig().await;
        let url = format!("ws://127.0.0.1:{}/api/display/ws?channel=2&role=control", r.st.port);
        let mut req = url.into_client_request().unwrap();
        req.headers_mut().insert("cookie", r.cookie.parse().unwrap());
        req.headers_mut().insert("origin", r.base.parse().unwrap());
        let (mut ws, resp) = tokio_tungstenite::connect_async(req).await.unwrap();
        assert_eq!(resp.status(), 101);
        ws.send(tungstenite::Message::Text("안녕".into())).await.unwrap();
        let got = tokio::time::timeout(Duration::from_secs(5), ws.next()).await.unwrap().unwrap().unwrap();
        assert_eq!(got.into_text().unwrap().as_str(), "echo:안녕");
        let (uri, h) = r.ws_seen.lock().unwrap().clone().unwrap();
        assert_eq!(uri, "/api/display/ws?channel=2&role=control");
        assert_eq!(h["cf-access-client-id"], "id-123.access");
        assert_eq!(h["cf-access-client-secret"], "top-secret");
        assert!(h.get("cookie").is_none());
        assert_eq!(h["origin"], format!("http://127.0.0.1:{}", r.ui_port));
        let _ = ws.close(None).await;

        // 쿠키 없는 WebSocket 은 거부
        let url = format!("ws://127.0.0.1:{}/api/display/ws", r.st.port);
        assert!(tokio_tungstenite::connect_async(url).await.is_err());
    }
}
