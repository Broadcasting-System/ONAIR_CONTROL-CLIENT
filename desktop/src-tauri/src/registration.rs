//! 등록 정보: QR/링크 풀기, 서버 주소 정리, 서버에 연결 확인.

use base64::Engine;
use serde::{Deserialize, Serialize};
use url::Url;

use crate::proxy::{self, ProxyConfig};

/// 키체인에 저장하는 내용
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Credentials {
    pub server: String,
    pub client_id: String,
    pub client_secret: String,
    /// API 서버를 따로 둘 때만 (비우면 자동)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub api: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub invite: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub saved_at: Option<u64>,
}

/// 등록 링크 안의 JSON {v:1, server, clientId, clientSecret, invite, exp}
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Payload {
    v: u32,
    server: String,
    client_id: String,
    client_secret: String,
    #[serde(default)]
    invite: Option<String>,
    #[serde(default)]
    exp: Option<f64>,
    #[serde(default)]
    api: Option<String>,
}

/// 화면에 보여줄 풀린 링크 (비밀 키는 안 내보냄)
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ParsedLink {
    pub server: String,
    pub client_id: String,
    pub client_id_hint: String,
    pub api: Option<String>,
    pub invite: Option<String>,
    /// 만료 시각 (unix 초)
    pub exp: Option<u64>,
    #[serde(skip)]
    pub client_secret: String,
}

impl ParsedLink {
    pub fn into_credentials(self) -> Credentials {
        Credentials {
            server: self.server,
            client_id: self.client_id,
            client_secret: self.client_secret,
            api: self.api,
            invite: self.invite,
            saved_at: None,
        }
    }
}

pub fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// 앞 4글자…뒤 6글자 처럼 일부만
pub fn hint(id: &str) -> String {
    let chars: Vec<char> = id.chars().collect();
    if chars.len() <= 12 {
        return id.chars().take(4).collect::<String>() + "…";
    }
    let head: String = chars[..4].iter().collect();
    let tail: String = chars[chars.len() - 6..].iter().collect();
    format!("{head}…{tail}")
}

/// onair://register?d=<base64url JSON>  (d 값만 붙여넣어도 됨)
pub fn parse_link(input: &str, now: u64) -> Result<ParsedLink, String> {
    let input = input.trim();
    if input.is_empty() {
        return Err("링크가 비어 있어요.".into());
    }
    let data = if let Ok(u) = Url::parse(input) {
        u.query_pairs()
            .find(|(k, _)| k == "d")
            .map(|(_, v)| v.into_owned())
            .ok_or("링크에 등록 정보(d=…)가 없어요.")?
    } else {
        input.to_string()
    };
    let raw = decode_b64(&data).ok_or("등록 정보를 풀 수 없어요. 링크를 끝까지 복사했는지 확인해 주세요.")?;
    let p: Payload = serde_json::from_slice(&raw).map_err(|_| "등록 정보 형식이 맞지 않아요.".to_string())?;
    if p.v != 1 {
        return Err(format!("이 앱이 모르는 등록 정보 버전이에요 (v{}). 앱을 업데이트해 주세요.", p.v));
    }
    let exp = p.exp.map(|e| if e > 1e12 { (e / 1000.0) as u64 } else { e as u64 });
    if let Some(e) = exp {
        if e < now {
            return Err("등록 링크 유효 기간이 지났어요. 관리자에게 새로 받아 주세요.".into());
        }
    }
    let server = normalize_server(&p.server)?;
    let api = match p.api.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(a) => Some(normalize_server(a)?),
        None => None,
    };
    if p.client_id.trim().is_empty() || p.client_secret.trim().is_empty() {
        return Err("등록 정보에 접속 키가 없어요.".into());
    }
    Ok(ParsedLink {
        client_id_hint: hint(p.client_id.trim()),
        server,
        client_id: p.client_id.trim().into(),
        client_secret: p.client_secret.trim().into(),
        api,
        invite: p.invite.filter(|s| !s.is_empty()),
        exp,
    })
}

fn decode_b64(s: &str) -> Option<Vec<u8>> {
    let s = s.trim().trim_end_matches('=');
    let url = base64::engine::general_purpose::URL_SAFE_NO_PAD;
    let std = base64::engine::general_purpose::STANDARD_NO_PAD;
    url.decode(s).or_else(|_| std.decode(s)).ok()
}

/// 서버 주소 정리: 스킴 없으면 https, 끝 / 제거, 경로 허용
pub fn normalize_server(s: &str) -> Result<String, String> {
    let s = s.trim();
    if s.is_empty() {
        return Err("서버 주소가 비어 있어요.".into());
    }
    let with_scheme = if s.contains("://") { s.to_string() } else { format!("https://{s}") };
    let u = Url::parse(&with_scheme).map_err(|_| format!("서버 주소가 올바르지 않아요: {s}"))?;
    if u.scheme() != "http" && u.scheme() != "https" {
        return Err("서버 주소는 http:// 또는 https:// 로 시작해야 해요.".into());
    }
    if u.host_str().is_none() {
        return Err("서버 주소에 호스트가 없어요.".into());
    }
    let mut out = format!("{}://{}", u.scheme(), u.host_str().unwrap());
    if let Some(p) = u.port() {
        out.push_str(&format!(":{p}"));
    }
    let path = u.path().trim_end_matches('/');
    out.push_str(path);
    Ok(out)
}

/// API 업스트림 정하기.
/// - 따로 적었으면 그것
/// - 서버 주소에 포트가 있으면(예: http://100.95.97.82:3001) 지금 구조 → 같은 호스트 :8000
/// - 포트가 없으면(예: https://onair.bssmcast.com) Cloudflare 구조 → 같은 주소 /api
pub fn api_upstream(server: &Url, api: Option<&str>) -> Url {
    if let Some(a) = api.and_then(|a| Url::parse(a).ok()) {
        return a;
    }
    if server.port().is_some() {
        let mut u = server.clone();
        let _ = u.set_port(Some(8000));
        u.set_path("/");
        return u;
    }
    server.clone()
}

pub fn proxy_config(c: &Credentials) -> Result<ProxyConfig, String> {
    let server = Url::parse(&normalize_server(&c.server)?).map_err(|e| e.to_string())?;
    let api = api_upstream(&server, c.api.as_deref());
    Ok(ProxyConfig::new(server, api, c.client_id.clone(), c.client_secret.clone()))
}

/// 서버 연결 확인 결과
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyResult {
    pub ok: bool,
    /// 실패해도 '그래도 저장' 을 허용할지 (서버가 잠깐 꺼진 경우 등)
    pub can_force: bool,
    pub http_status: Option<u16>,
    pub message: String,
    pub member: Option<serde_json::Value>,
}

/// GET <api>/api/members/me 를 CF 헤더와 함께 불러 본다. (프록시와 같은 헤더 규칙)
pub async fn verify(client: &reqwest::Client, c: &Credentials) -> VerifyResult {
    let cfg = match proxy_config(c) {
        Ok(cfg) => cfg,
        Err(e) => {
            return VerifyResult { ok: false, can_force: false, http_status: None, message: e, member: None }
        }
    };
    let target = proxy::join_upstream(cfg.route("/api/members/me"), "/api/members/me");
    let mut h = reqwest::header::HeaderMap::new();
    h.insert(reqwest::header::ACCEPT, "application/json".parse().unwrap());
    let headers = proxy::forward_headers(&h, &cfg, "", false);
    let res = client
        .get(target.clone())
        .headers(headers)
        .timeout(std::time::Duration::from_secs(12))
        .send()
        .await;
    let resp = match res {
        Ok(r) => r,
        Err(e) => {
            log::warn!("연결 확인 실패 {target}: {e}");
            return VerifyResult {
                ok: false,
                can_force: true,
                http_status: None,
                message: format!("서버에 연결할 수 없어요. 주소와 인터넷 연결을 확인해 주세요. ({})", short_err(&e)),
                member: None,
            };
        }
    };
    let status = resp.status();
    if proxy::is_cf_access_block(status, resp.headers())
        || status == reqwest::StatusCode::UNAUTHORIZED
        || status == reqwest::StatusCode::FORBIDDEN
    {
        return VerifyResult {
            ok: false,
            can_force: false,
            http_status: Some(status.as_u16()),
            message: "접속 키가 거부됐어요. 관리자에게 새 등록 QR 을 받아 주세요.".into(),
            member: None,
        };
    }
    if status == reqwest::StatusCode::NOT_FOUND {
        return VerifyResult {
            ok: true,
            can_force: true,
            http_status: Some(404),
            message: "서버에 연결됐어요. (회원 확인 기능은 아직 서버에 없어요)".into(),
            member: None,
        };
    }
    if status.is_success() {
        let member = resp.bytes().await.ok().and_then(|b| serde_json::from_slice::<serde_json::Value>(&b).ok());
        return VerifyResult {
            ok: true,
            can_force: true,
            http_status: Some(status.as_u16()),
            message: "서버에 연결됐어요.".into(),
            member,
        };
    }
    VerifyResult {
        ok: false,
        can_force: true,
        http_status: Some(status.as_u16()),
        message: format!("서버가 응답했지만 확인하지 못했어요 (HTTP {}).", status.as_u16()),
        member: None,
    }
}

fn short_err(e: &reqwest::Error) -> String {
    if e.is_timeout() {
        "시간 초과".into()
    } else if e.is_connect() {
        "연결 거부".into()
    } else {
        e.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn link(json: &str) -> String {
        format!("onair://register?d={}", base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(json))
    }

    #[test]
    fn parses_register_link() {
        let l = link(r#"{"v":1,"server":"https://onair.bssmcast.com/","clientId":"abcd1234.access","clientSecret":"s3cr3t","invite":"K3-7Q9","exp":4102444800}"#);
        let p = parse_link(&l, 1_700_000_000).unwrap();
        assert_eq!(p.server, "https://onair.bssmcast.com");
        assert_eq!(p.client_id, "abcd1234.access");
        assert_eq!(p.client_secret, "s3cr3t");
        assert_eq!(p.invite.as_deref(), Some("K3-7Q9"));
        assert_eq!(p.exp, Some(4102444800));
        // 비밀 키는 화면용 JSON 에 안 나간다
        let js = serde_json::to_string(&p).unwrap();
        assert!(!js.contains("s3cr3t"));
    }

    #[test]
    fn accepts_bare_data_and_padding_and_ms_exp() {
        let json = r#"{"v":1,"server":"100.95.97.82:3001","clientId":"id","clientSecret":"sec","exp":4102444800000}"#;
        let d = base64::engine::general_purpose::URL_SAFE.encode(json);
        let p = parse_link(&d, 0).unwrap();
        assert_eq!(p.server, "https://100.95.97.82:3001");
        assert_eq!(p.exp, Some(4102444800));
    }

    #[test]
    fn rejects_expired_and_bad() {
        let l = link(r#"{"v":1,"server":"https://a.b","clientId":"id","clientSecret":"s","exp":1000}"#);
        assert!(parse_link(&l, 2000).unwrap_err().contains("유효 기간"));
        assert!(parse_link("onair://register", 0).is_err());
        assert!(parse_link("onair://register?d=!!!", 0).is_err());
        let v2 = link(r#"{"v":2,"server":"https://a.b","clientId":"id","clientSecret":"s"}"#);
        assert!(parse_link(&v2, 0).unwrap_err().contains("v2"));
    }

    #[test]
    fn api_upstream_rules() {
        let cf = Url::parse("https://onair.bssmcast.com").unwrap();
        assert_eq!(api_upstream(&cf, None).as_str(), "https://onair.bssmcast.com/");
        let lan = Url::parse("http://100.95.97.82:3001").unwrap();
        assert_eq!(api_upstream(&lan, None).as_str(), "http://100.95.97.82:8000/");
        assert_eq!(api_upstream(&lan, Some("http://10.0.0.2:9000")).as_str(), "http://10.0.0.2:9000/");
    }

    #[test]
    fn normalizes_server() {
        assert_eq!(normalize_server(" http://localhost:3000/ ").unwrap(), "http://localhost:3000");
        assert_eq!(normalize_server("onair.bssmcast.com").unwrap(), "https://onair.bssmcast.com");
        assert!(normalize_server("ftp://x").is_err());
    }

    #[test]
    fn hint_hides_middle() {
        assert_eq!(hint("0123456789abcdef.access"), "0123…access");
        assert_eq!(hint("short"), "shor…");
    }

    fn creds(server: String, api: Option<String>) -> Credentials {
        Credentials { server, client_id: "cid".into(), client_secret: "sec".into(), api, invite: None, saved_at: None }
    }

    #[tokio::test]
    async fn verify_calls_members_me_with_cf_headers() {
        let port = crate::proxy::tests::mock_http().await;
        let client = crate::proxy::http_client();
        // 가짜 서버는 받은 요청을 JSON 으로 돌려준다 → 200 = 연결 성공
        let r = verify(&client, &creds(format!("http://127.0.0.1:{port}"), Some(format!("http://127.0.0.1:{port}")))).await;
        assert!(r.ok, "{}", r.message);
        let m = r.member.unwrap();
        assert_eq!(m["path"], "/api/members/me");
        assert_eq!(m["headers"]["cf-access-client-id"], "cid");
        assert_eq!(m["headers"]["cf-access-client-secret"], "sec");
        // 서버가 꺼져 있으면 실패지만 '그래도 저장' 은 가능
        let r = verify(&client, &creds("http://127.0.0.1:1".into(), None)).await;
        assert!(!r.ok && r.can_force);
    }
}
