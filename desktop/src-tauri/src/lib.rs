//! ONAIR 데스크탑 앱.
//! 서버의 컨트롤 UI 를 로컬 프록시(127.0.0.1)로 띄우는 얇은 껍데기.
//! 처음 실행(접속 키 없음) → 앱에 들어 있는 등록 화면, 등록 후 → 프록시로 컨트롤 화면.

pub mod pages;
pub mod proxy;
pub mod registration;
pub mod store;

use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use url::Url;

use proxy::{ProxyAction, ProxyState};
use registration::{Credentials, ParsedLink, VerifyResult};

const MAIN: &str = "main";
const SETTINGS: &str = "settings";

/// 웹뷰가 페이지를 읽기 전에 넣는 스크립트 (프록시 경유 컨트롤 UI → /api 를 같은 주소로)
const INIT_SCRIPT: &str = "window.__ONAIR_SAME_ORIGIN__ = true; window.__ONAIR_DESKTOP__ = true;";

pub struct AppState {
    pub proxy: Arc<ProxyState>,
    /// 딥링크로 받은 등록 링크 (등록 화면이 읽어 감)
    pub pending_link: Mutex<Option<String>>,
}

/// 비밀이 아닌 앱 설정 (지난번 프록시 포트 → 웹뷰 저장소가 포트마다 따로라 유지)
#[derive(Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LocalPrefs {
    proxy_port: Option<u16>,
}

fn prefs_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("desktop.json"))
}

fn load_prefs(app: &AppHandle) -> LocalPrefs {
    prefs_path(app)
        .and_then(|p| std::fs::read(p).ok())
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

fn save_prefs(app: &AppHandle, prefs: &LocalPrefs) {
    if let Some(p) = prefs_path(app) {
        if let Some(dir) = p.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let _ = std::fs::write(p, serde_json::to_vec_pretty(prefs).unwrap_or_default());
    }
}

/// 앱에 들어 있는 화면 주소 (index.html + 쿼리/해시)
fn local_page(app: &AppHandle, rest: &str) -> Url {
    let base = if tauri::is_dev() {
        app.config().build.dev_url.clone()
    } else {
        None
    };
    let base = base.unwrap_or_else(|| {
        let s = if cfg!(any(windows, target_os = "android")) { "http://tauri.localhost/" } else { "tauri://localhost/" };
        Url::parse(s).unwrap()
    });
    base.join(&format!("index.html{rest}")).unwrap()
}

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(MAIN)
}

fn show(w: &WebviewWindow) {
    let _ = w.unminimize();
    let _ = w.show();
    let _ = w.set_focus();
}

/// 메인 창을 컨트롤 화면(프록시)으로
fn go_control(app: &AppHandle) {
    let st = app.state::<AppState>();
    if let (Some(w), Ok(u)) = (main_window(app), Url::parse(&st.proxy.boot_url())) {
        let _ = w.navigate(u);
        show(&w);
    }
}

/// 메인 창을 등록 화면으로
fn go_setup(app: &AppHandle, reason: &str) {
    if let Some(w) = main_window(app) {
        let nonce = registration::now_secs();
        let _ = w.navigate(local_page(app, &format!("?r={reason}&t={nonce}#setup")));
        show(&w);
    }
    if let Some(s) = app.get_webview_window(SETTINGS) {
        let _ = s.close();
    }
}

fn open_settings_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(SETTINGS) {
        show(&w);
        return;
    }
    let b = WebviewWindowBuilder::new(app, SETTINGS, WebviewUrl::App("index.html#settings".into()))
        .title("ONAIR 설정")
        .inner_size(640.0, 600.0)
        .min_inner_size(520.0, 480.0)
        .resizable(true);
    if let Err(e) = b.build() {
        log::error!("설정 창 열기 실패: {e}");
    }
}

fn open_logs_dir(app: &AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let dir = app.path().app_log_dir().map_err(|e| e.to_string())?;
    let _ = std::fs::create_dir_all(&dir);
    app.opener()
        .open_path(dir.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| e.to_string())
}

fn handle_deep_link(app: &AppHandle, url: &str) {
    if !url.starts_with("onair:") {
        return;
    }
    log::info!("등록 링크 받음 (딥링크)");
    *app.state::<AppState>().pending_link.lock().unwrap() = Some(url.to_string());
    go_setup(app, "link");
}

fn apply_credentials(app: &AppHandle, c: Option<&Credentials>) -> Result<(), String> {
    let st = app.state::<AppState>();
    match c {
        Some(c) => st.proxy.set_config(Some(registration::proxy_config(c)?)),
        None => st.proxy.set_config(None),
    }
    Ok(())
}

// ---------- 화면에서 부르는 명령 ----------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StateView {
    configured: bool,
    server: Option<String>,
    api: Option<String>,
    client_id_hint: Option<String>,
    saved_at: Option<u64>,
    proxy_port: u16,
    version: String,
    log_dir: Option<String>,
    platform: &'static str,
    store_error: Option<String>,
}

#[tauri::command]
fn get_state(app: AppHandle) -> StateView {
    let st = app.state::<AppState>();
    let (creds, store_error) = match store::load() {
        Ok(c) => (c, None),
        Err(e) => (None, Some(e)),
    };
    let api = creds.as_ref().and_then(|c| {
        let s = Url::parse(&c.server).ok()?;
        Some(registration::api_upstream(&s, c.api.as_deref()).to_string())
    });
    StateView {
        configured: creds.is_some(),
        server: creds.as_ref().map(|c| c.server.clone()),
        api,
        client_id_hint: creds.as_ref().map(|c| {
            if c.client_id.is_empty() { "(없음)".into() } else { registration::hint(&c.client_id) }
        }),
        saved_at: creds.as_ref().and_then(|c| c.saved_at),
        proxy_port: st.proxy.port,
        version: app.package_info().version.to_string(),
        log_dir: app.path().app_log_dir().ok().map(|p| p.to_string_lossy().to_string()),
        platform: std::env::consts::OS,
        store_error,
    }
}

#[tauri::command]
fn parse_link(link: String) -> Result<ParsedLink, String> {
    registration::parse_link(&link, registration::now_secs())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveInput {
    link: Option<String>,
    server: Option<String>,
    client_id: Option<String>,
    client_secret: Option<String>,
    api: Option<String>,
    #[serde(default)]
    force: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveResult {
    saved: bool,
    #[serde(flatten)]
    verify: VerifyResult,
}

#[tauri::command]
async fn verify_and_save(app: AppHandle, input: SaveInput) -> Result<SaveResult, String> {
    let mut creds = if let Some(link) = input.link.as_deref().filter(|l| !l.trim().is_empty()) {
        registration::parse_link(link, registration::now_secs())?.into_credentials()
    } else {
        let id = input.client_id.unwrap_or_default().trim().to_string();
        let secret = input.client_secret.unwrap_or_default().trim().to_string();
        if id.is_empty() != secret.is_empty() {
            return Err("접속 키 ID 와 비밀 키는 둘 다 적거나 둘 다 비워 주세요.".into());
        }
        Credentials {
            server: registration::normalize_server(input.server.as_deref().unwrap_or(""))?,
            client_id: id,
            client_secret: secret,
            api: match input.api.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
                Some(a) => Some(registration::normalize_server(a)?),
                None => None,
            },
            invite: None,
            saved_at: None,
        }
    };
    let client = app.state::<AppState>().proxy.http().clone();
    let verify = registration::verify(&client, &creds).await;
    let save = verify.ok || (input.force && verify.can_force);
    if save {
        creds.saved_at = Some(registration::now_secs());
        store::save(&creds)?;
        apply_credentials(&app, Some(&creds))?;
        *app.state::<AppState>().pending_link.lock().unwrap() = None;
        log::info!("접속 정보 저장: {}", creds.server);
    }
    Ok(SaveResult { saved: save, verify })
}

#[tauri::command]
fn open_control(app: AppHandle) -> Result<(), String> {
    if app.state::<AppState>().proxy.config().is_none() {
        return Err("아직 등록하지 않았어요.".into());
    }
    go_control(&app);
    if let Some(s) = app.get_webview_window(SETTINGS) {
        let _ = s.close();
    }
    Ok(())
}

#[tauri::command]
fn show_setup(app: AppHandle) {
    go_setup(&app, "reenter");
}

#[tauri::command]
fn open_settings(app: AppHandle) {
    open_settings_window(&app);
}

#[tauri::command]
fn clear_token(app: AppHandle) -> Result<(), String> {
    store::clear()?;
    apply_credentials(&app, None)?;
    log::info!("접속 정보 삭제");
    go_setup(&app, "cleared");
    Ok(())
}

#[tauri::command]
fn open_logs(app: AppHandle) -> Result<(), String> {
    open_logs_dir(&app)
}

#[tauri::command]
fn pending_link(app: AppHandle) -> Option<String> {
    let link = app.state::<AppState>().pending_link.lock().unwrap().clone();
    log::info!("등록 화면 열림 (받은 링크 {})", if link.is_some() { "있음" } else { "없음" });
    link
}

#[tauri::command]
fn dismiss_pending_link(app: AppHandle) {
    *app.state::<AppState>().pending_link.lock().unwrap() = None;
}

// ---------- 메뉴 ----------

#[cfg(desktop)]
fn build_menu(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use tauri::menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
    let settings = MenuItemBuilder::with_id("settings", "설정…").accelerator("CmdOrCtrl+,").build(app)?;
    let logs = MenuItemBuilder::with_id("logs", "기록 폴더 열기").build(app)?;
    let home = MenuItemBuilder::with_id("home", "컨트롤 화면 처음으로").accelerator("CmdOrCtrl+Shift+H").build(app)?;
    let reload = MenuItemBuilder::with_id("reload", "새로고침").accelerator("CmdOrCtrl+R").build(app)?;

    let mut app_menu = SubmenuBuilder::new(app, "ONAIR");
    app_menu = app_menu
        .item(&PredefinedMenuItem::about(app, Some("ONAIR 정보"), Some(AboutMetadata::default()))?)
        .separator()
        .item(&settings)
        .item(&logs)
        .separator();
    #[cfg(target_os = "macos")]
    {
        app_menu = app_menu
            .item(&PredefinedMenuItem::hide(app, Some("ONAIR 가리기"))?)
            .item(&PredefinedMenuItem::hide_others(app, None)?)
            .item(&PredefinedMenuItem::show_all(app, None)?)
            .separator();
    }
    let app_menu = app_menu.item(&PredefinedMenuItem::quit(app, Some("ONAIR 종료"))?).build()?;

    let edit = SubmenuBuilder::new(app, "편집")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;
    let view = SubmenuBuilder::new(app, "보기")
        .item(&reload)
        .item(&home)
        .separator()
        .item(&PredefinedMenuItem::fullscreen(app, Some("전체 화면"))?)
        .build()?;
    let window = SubmenuBuilder::new(app, "창")
        .item(&PredefinedMenuItem::minimize(app, Some("최소화"))?)
        .item(&PredefinedMenuItem::maximize(app, Some("확대/축소"))?)
        .separator()
        .item(&PredefinedMenuItem::close_window(app, Some("창 닫기"))?)
        .build()?;
    MenuBuilder::new(app).items(&[&app_menu, &edit, &view, &window]).build()
}

#[cfg(desktop)]
fn on_menu(app: &AppHandle, id: &str) {
    match id {
        "settings" => open_settings_window(app),
        "logs" => {
            if let Err(e) = open_logs_dir(app) {
                log::warn!("기록 폴더 열기 실패: {e}");
            }
        }
        "reload" => {
            if let Some(w) = main_window(app) {
                let _ = w.eval("location.reload()");
            }
        }
        "home" => {
            if app.state::<AppState>().proxy.config().is_some() {
                go_control(app);
            } else {
                go_setup(app, "menu");
            }
        }
        _ => {}
    }
}

// ---------- 시작 ----------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        // 두 번째 실행(딥링크 클릭 포함) → 이미 떠 있는 창으로. 딥링크 URL 은 deep-link 플러그인이 넘겨 준다.
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = main_window(app) {
                show(&w);
            }
        }));
    }

    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .clear_targets()
                .level(log::LevelFilter::Info)
                .level_for("hyper", log::LevelFilter::Warn)
                .level_for("hyper_util", log::LevelFilter::Warn)
                .level_for("reqwest", log::LevelFilter::Warn)
                .level_for("rustls", log::LevelFilter::Warn)
                .level_for("tungstenite", log::LevelFilter::Warn)
                .level_for("tokio_tungstenite", log::LevelFilter::Warn)
                .target(tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir { file_name: None }))
                .target(tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout))
                .max_file_size(2_000_000)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            get_state,
            parse_link,
            verify_and_save,
            open_control,
            show_setup,
            open_settings,
            clear_token,
            open_logs,
            pending_link,
            dismiss_pending_link,
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // 1) 로컬 프록시
            let mut prefs = load_prefs(&handle);
            let proxy = tauri::async_runtime::block_on(proxy::start(prefs.proxy_port))?;
            if prefs.proxy_port != Some(proxy.port) {
                prefs.proxy_port = Some(proxy.port);
                save_prefs(&handle, &prefs);
            }
            let h2 = handle.clone();
            proxy.set_action_handler(Arc::new(move |a| {
                let h = h2.clone();
                let _ = h2.run_on_main_thread(move || match a {
                    ProxyAction::OpenSettings => open_settings_window(&h),
                    ProxyAction::ShowSetup => go_setup(&h, "denied"),
                });
            }));
            app.manage(AppState { proxy: proxy.clone(), pending_link: Mutex::new(None) });

            // 2) 저장된 접속 정보
            let creds = match store::load() {
                Ok(c) => c,
                Err(e) => {
                    log::error!("{e}");
                    None
                }
            };
            if let Some(c) = creds.as_ref() {
                if let Err(e) = apply_credentials(&handle, Some(c)) {
                    log::error!("저장된 서버 주소가 이상해요: {e}");
                }
            }

            // 3) 딥링크 (onair://register?d=…)
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                #[cfg(any(windows, target_os = "linux"))]
                if let Err(e) = app.deep_link().register_all() {
                    log::warn!("onair:// 등록 실패: {e}");
                }
                if let Ok(Some(urls)) = app.deep_link().get_current() {
                    if let Some(u) = urls.iter().find(|u| u.scheme() == "onair") {
                        *app.state::<AppState>().pending_link.lock().unwrap() = Some(u.to_string());
                    }
                }
                let h = handle.clone();
                app.deep_link().on_open_url(move |event| {
                    for u in event.urls() {
                        handle_deep_link(&h, u.as_str());
                    }
                });
            }

            // 4) 메인 창
            let has_link = app.state::<AppState>().pending_link.lock().unwrap().is_some();
            let start_url = if proxy.config().is_some() && !has_link {
                WebviewUrl::External(Url::parse(&proxy.boot_url())?)
            } else {
                WebviewUrl::App("index.html#setup".into())
            };
            // 주의: macOS 는 on_navigation 이 iframe 에도 걸려서 외부 주소 가로채기는 안 한다
            let mut b = WebviewWindowBuilder::new(app, MAIN, start_url)
                .title("ONAIR")
                .initialization_script(INIT_SCRIPT);
            #[cfg(desktop)]
            {
                b = b
                    .inner_size(1440.0, 900.0)
                    .min_inner_size(960.0, 640.0)
                    .center()
                    // HTML 로 QR 이미지 끌어놓기를 받으려고 기본 파일 드롭 처리 끔
                    .disable_drag_drop_handler();
            }
            b.build()?;

            #[cfg(desktop)]
            {
                let menu = build_menu(&handle)?;
                app.set_menu(menu)?;
                app.on_menu_event(|app, e| on_menu(app, e.id().as_ref()));
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("ONAIR 앱 실행 실패");
}
