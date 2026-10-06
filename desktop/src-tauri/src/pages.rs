//! 프록시가 직접 보여주는 대체 화면 (서버 연결 실패, 접속 키 거부 등).
//! 서버에서 오는 페이지가 아니라서 폰트는 시스템 폰트로 대신한다.

fn esc(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

fn page(title: &str, lead: &str, detail: &str, primary: (&str, &str)) -> String {
    format!(
        r#"<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ONAIR</title>
<style>
:root{{--red:#FF3B3B;--line:rgba(255,255,255,.1)}}
*{{box-sizing:border-box}}html,body{{margin:0;height:100%}}
body{{background:radial-gradient(ellipse 70% 55% at 55% 35%,rgba(120,10,10,.32),transparent 70%),#101010;color:#fff;
font-family:"Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;display:grid;place-items:center;padding:24px}}
.card{{width:min(520px,100%);border-radius:24px;border:1px solid var(--line);background:rgba(32,32,32,.6);padding:30px 32px;
box-shadow:0 25px 50px -12px rgba(0,0,0,.6)}}
.logo{{font-weight:800;letter-spacing:.18em;font-size:18px;margin-bottom:22px}}.logo em{{font-style:normal;color:var(--red);text-shadow:0 0 14px rgba(255,59,59,.6)}}
h1{{font-size:24px;margin:0 0 10px;font-weight:700}}p{{color:rgba(255,255,255,.6);font-size:14px;line-height:1.65;margin:0}}
code{{display:block;margin-top:14px;padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.45);color:rgba(255,255,255,.55);
font:12px/1.5 ui-monospace,Menlo,monospace;word-break:break-all}}
.row{{display:flex;gap:10px;margin-top:24px;flex-wrap:wrap}}
button{{font:inherit;height:44px;padding:0 20px;border-radius:14px;cursor:pointer;border:1px solid rgba(255,255,255,.08);
background:linear-gradient(180deg,#1d1d21,#131316);color:rgba(255,255,255,.85);font-size:15px}}
button.primary{{background:var(--red);border-color:var(--red);color:#fff;box-shadow:0 0 22px rgba(255,59,59,.4)}}
</style></head><body><div class="card">
<div class="logo">ON<em>AIR</em></div>
<h1>{title}</h1><p>{lead}</p>{detail}
<div class="row">
<button class="primary" onclick="{action}">{label}</button>
<button onclick="fetch('/__onair/action/settings',{{method:'POST'}})">설정 열기</button>
</div></div></body></html>"#,
        title = title,
        lead = lead,
        detail = detail,
        action = primary.0,
        label = primary.1,
    )
}

pub fn unreachable(server: &str, err: &str) -> String {
    page(
        "서버에 연결할 수 없어요",
        "서버가 꺼져 있거나, 인터넷(또는 학교망)에 연결되지 않았을 수 있어요. 잠시 후 다시 시도해 주세요.",
        &format!("<code>{}<br>{}</code>", esc(server), esc(err)),
        ("location.reload()", "다시 시도"),
    )
}

pub fn access_denied(server: &str) -> String {
    page(
        "접속 키가 거부됐어요",
        "이 컴퓨터에 저장된 접속 키가 만료됐거나 취소됐어요. 방송부 관리자에게 새 등록 QR 을 받아 다시 등록해 주세요.",
        &format!("<code>{}</code>", esc(server)),
        ("fetch('/__onair/action/setup',{method:'POST'})", "다시 등록하기"),
    )
}

pub fn not_configured() -> String {
    page(
        "아직 등록하지 않았어요",
        "처음 한 번, 방송부 관리자에게 받은 등록 링크(QR)로 이 컴퓨터를 등록해 주세요.",
        "",
        ("fetch('/__onair/action/setup',{method:'POST'})", "등록하기"),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn escapes_error_text() {
        let html = unreachable("http://x", "<script>alert(1)</script>");
        assert!(!html.contains("<script>alert"));
        assert!(html.contains("&lt;script&gt;"));
    }
}
