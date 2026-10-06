// ONAIR 데스크탑 — 앱에 들어 있는 등록(#setup)·설정(#settings) 화면
import "@fontsource/orbitron/500.css";
import "@fontsource/orbitron/700.css";
import "./styles.css";
import { call } from "./api";
import type { AppStateView, ParsedLink, SaveResult } from "./api";
import { decodeQrFromBlob } from "./qr";

const app = document.getElementById("app")!;
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => app.querySelector(sel) as T | null;

function fmtDate(sec?: number | null) {
  if (!sec) return "";
  const d = new Date(sec * 1000);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/* ---------------- 등록 화면 ---------------- */

type Tab = "link" | "qr" | "manual";

async function renderSetup() {
  const params = new URLSearchParams(location.search);
  const reason = params.get("r");
  const state = await call<AppStateView>("get_state");
  const pending = await call<string | null>("pending_link");
  let tab: Tab = "link";
  let parsed: ParsedLink | null = null;
  let forceable = false;

  const notices: Record<string, [string, string]> = {
    link: ["", "등록 링크를 받았어요. 내용을 확인하고 '연결 확인하고 시작'을 눌러 주세요."],
    cleared: ["red", "이 컴퓨터의 접속 키를 지웠어요. 다시 쓰려면 새 등록 링크로 등록해 주세요."],
    denied: ["red", "접속 키가 거부됐어요. 관리자에게 새 등록 QR 을 받아 다시 등록해 주세요."],
  };
  const notice = pending ? notices.link : reason ? notices[reason] : undefined;
  const reenter = state.configured;

  app.innerHTML = `
  <div class="setup-wrap"><div class="setup">
    <aside class="left">
      <div class="brand"><div class="logo">ON<em>AIR</em></div><div class="sub">DESKTOP · BSSM BROADCAST</div></div>
      <ol class="steps">
        <li class="done"><span class="n">1</span><div><div class="t">등록 링크 받기</div><div class="d">방송부 관리자에게 '앱 등록 QR'을 받아요. 링크로 받아도 돼요.</div></div></li>
        <li class="on" id="st2"><span class="n">2</span><div><div class="t">이 앱에 넣기</div><div class="d">링크를 붙여넣거나 QR 이미지를 넣어요. 링크를 클릭하면 자동으로 채워져요.</div></div></li>
        <li id="st3"><span class="n">3</span><div><div class="t">연결 확인</div><div class="d">서버에 붙어 보고 이 컴퓨터에 안전하게 저장해요. 다음부턴 바로 열려요.</div></div></li>
      </ol>
      <div class="lock">접속 키는 이 컴퓨터의 ${state.platform === "windows" ? "자격 증명 관리자" : "키체인"}에만 저장되고, 서버에서 오는 화면(웹페이지)에는 전달되지 않아요.</div>
    </aside>
    <section class="right">
      <h2>${reenter ? "접속 키 다시 입력" : "이 컴퓨터 등록하기"}</h2>
      <div class="muted">${reenter ? `지금 서버: <span class="selectable">${esc(state.server)}</span>` : "처음 한 번만 하면 돼요."}</div>
      ${notice ? `<div class="notice ${notice[0]}">${esc(notice[1])}</div>` : ""}
      ${state.storeError ? `<div class="notice red">${esc(state.storeError)}</div>` : ""}
      <div class="tabs" role="tablist">
        <button data-tab="link" class="on">링크 붙여넣기</button>
        <button data-tab="qr">QR 이미지</button>
        <button data-tab="manual">직접 입력</button>
      </div>

      <div data-pane="link">
        <label class="f" for="link">등록 링크</label>
        <textarea class="in" id="link" spellcheck="false" placeholder="onair://register?d=… 를 여기에 붙여넣어 주세요"></textarea>
        <div id="parsed"></div>
      </div>

      <div data-pane="qr" class="hidden">
        <label class="drop" id="drop" tabindex="0">
          <div><b>QR 이미지를 끌어다 놓기</b>또는 ${state.platform === "macos" ? "⌘V" : "Ctrl+V"} 로 캡처 붙여넣기 · <u>파일 고르기</u></div>
          <input type="file" id="file" accept="image/*" class="hidden">
        </label>
        <div class="muted" style="margin-top:8px">휴대폰으로 받은 QR 을 캡처해서 넣어도 돼요. 이미지는 저장하지 않아요.</div>
        <div id="qrmsg" class="muted" style="margin-top:6px"></div>
      </div>

      <div data-pane="manual" class="hidden">
        <label class="f" for="server">서버 주소</label>
        <input class="in" id="server" spellcheck="false" placeholder="https://onair.bssmcast.com" value="${esc(state.server ?? "")}">
        <label class="f" for="cid">접속 키 ID <small>CF-Access-Client-Id</small></label>
        <input class="in" id="cid" spellcheck="false" autocomplete="off" placeholder="xxxx.access">
        <label class="f" for="csec">비밀 키 <small>CF-Access-Client-Secret</small></label>
        <input class="in" id="csec" type="password" autocomplete="off" placeholder="••••••••">
        <details><summary>고급 — API 주소 따로 쓰기</summary>
          <label class="f" for="api">API 주소 <small>비우면 자동 (포트 있는 주소 → 같은 호스트 :8000, 없으면 같은 주소 /api)</small></label>
          <input class="in" id="api" spellcheck="false" placeholder="http://100.95.97.82:8000">
          <div class="muted" style="margin-top:6px">Cloudflare 없이 학교망에서 바로 붙을 땐 접속 키를 둘 다 비워도 돼요.</div>
        </details>
      </div>

      <div class="foot">
        <span class="status" id="status"></span>
        ${reenter ? `<button class="btn" id="cancel">취소</button>` : ""}
        <button class="btn hidden" id="force">그래도 저장</button>
        <button class="btn primary" id="go">연결 확인하고 시작</button>
      </div>
    </section>
  </div></div>`;

  const status = $("#status")!;
  const setStatus = (html: string) => (status.innerHTML = html);
  const linkEl = $<HTMLTextAreaElement>("#link")!;
  const forceBtn = $<HTMLButtonElement>("#force")!;
  const goBtn = $<HTMLButtonElement>("#go")!;

  function setTab(t: Tab) {
    tab = t;
    app.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
    app.querySelectorAll<HTMLElement>("[data-pane]").forEach((p) => p.classList.toggle("hidden", p.dataset.pane !== t));
    forceBtn.classList.add("hidden");
    setStatus("");
  }
  app.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((b) => (b.onclick = () => setTab(b.dataset.tab as Tab)));

  async function showParsed() {
    const box = $("#parsed")!;
    const v = linkEl.value.trim();
    parsed = null;
    if (!v) return void (box.innerHTML = "");
    try {
      parsed = await call<ParsedLink>("parse_link", { link: v });
      box.innerHTML = `<dl class="parsed">
        <dt>서버</dt><dd>${esc(parsed.server)}</dd>
        ${parsed.api ? `<dt>API</dt><dd>${esc(parsed.api)}</dd>` : ""}
        <dt>접속 키 ID</dt><dd>${esc(parsed.clientIdHint)}</dd>
        <dt>비밀 키</dt><dd>●●●●●●●● (화면에 안 보임)</dd>
        ${parsed.exp ? `<dt>유효 기간</dt><dd class="ok">${fmtDate(parsed.exp)}까지</dd>` : ""}
      </dl>`;
    } catch (e) {
      box.innerHTML = `<div class="notice red">${esc(e)}</div>`;
    }
  }
  linkEl.addEventListener("input", showParsed);

  // QR 이미지 → 링크
  async function fromImage(blob: Blob) {
    const msg = $("#qrmsg")!;
    msg.innerHTML = "QR 읽는 중…";
    const text = await decodeQrFromBlob(blob);
    if (!text) return void (msg.innerHTML = `<span class="err">QR 을 찾지 못했어요. 더 크게·선명하게 캡처해 주세요.</span>`);
    if (!text.startsWith("onair:")) return void (msg.innerHTML = `<span class="err">ONAIR 등록 QR 이 아니에요.</span>`);
    msg.innerHTML = "";
    linkEl.value = text;
    setTab("link");
    await showParsed();
  }
  const drop = $("#drop")!;
  const file = $<HTMLInputElement>("#file")!;
  file.onchange = () => file.files?.[0] && fromImage(file.files[0]);
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("over");
    const f = e.dataTransfer?.files?.[0];
    if (f) fromImage(f);
  });
  // 어디서든 붙여넣기: 이미지면 QR, onair:// 글자면 링크 칸
  document.onpaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items ?? [];
    for (const it of Array.from(items)) {
      if (it.type.startsWith("image/")) {
        const f = it.getAsFile();
        if (f) { e.preventDefault(); setTab("qr"); fromImage(f); return; }
      }
    }
    const t = e.clipboardData?.getData("text") ?? "";
    if (t.trim().startsWith("onair:") && document.activeElement !== linkEl) {
      e.preventDefault();
      linkEl.value = t.trim();
      setTab("link");
      showParsed();
    }
  };

  function input(force: boolean) {
    if (tab === "manual") {
      return {
        server: $<HTMLInputElement>("#server")!.value,
        clientId: $<HTMLInputElement>("#cid")!.value,
        clientSecret: $<HTMLInputElement>("#csec")!.value,
        api: $<HTMLInputElement>("#api")!.value,
        force,
      };
    }
    return { link: linkEl.value, force };
  }

  async function submit(force: boolean) {
    if (tab !== "manual" && !linkEl.value.trim()) {
      setStatus(`<span class="err">등록 링크를 먼저 넣어 주세요.</span>`);
      return;
    }
    goBtn.disabled = forceBtn.disabled = true;
    $("#st2")!.className = "done";
    $("#st3")!.className = "on";
    setStatus("연결 확인 중…");
    try {
      const r = await call<SaveResult>("verify_and_save", { input: input(force) });
      if (r.saved) {
        setStatus(`<span class="ok">● ${esc(r.message)} 컨트롤 화면을 여는 중…</span>`);
        setTimeout(() => call("open_control").catch((e) => setStatus(`<span class="err">${esc(e)}</span>`)), 700);
        return;
      }
      setStatus(`<span class="err">${esc(r.message)}</span>`);
      forceable = r.canForce;
      forceBtn.classList.toggle("hidden", !forceable);
    } catch (e) {
      setStatus(`<span class="err">${esc(e)}</span>`);
    }
    $("#st2")!.className = "on";
    $("#st3")!.className = "";
    goBtn.disabled = forceBtn.disabled = false;
  }
  goBtn.onclick = () => submit(false);
  forceBtn.onclick = () => submit(true);
  $("#cancel")?.addEventListener("click", () => {
    call("dismiss_pending_link");
    call("open_control").catch((e) => setStatus(`<span class="err">${esc(e)}</span>`));
  });

  if (pending) {
    linkEl.value = pending;
    await showParsed();
  }
}

/* ---------------- 설정 화면 ---------------- */

async function renderSettings() {
  const s = await call<AppStateView>("get_state");
  app.innerHTML = `
  <div class="settings">
    <div class="top">
      <h2>설정</h2>
      ${s.configured ? `<span class="chip"><span class="dot"></span>REGISTERED</span>` : `<span class="chip"><span class="dot red"></span>NOT REGISTERED</span>`}
    </div>
    <div class="panel">
      <div class="setrow"><div class="k">서버 주소<small>SERVER</small></div>
        <div class="v selectable">${s.server ? esc(s.server) : `<span class="muted">아직 없음</span>`}</div>
        <button class="btn small" id="copy" ${s.server ? "" : "disabled"}>복사</button></div>
      ${s.api && s.server && !s.api.startsWith(s.server) ? `<div class="setrow"><div class="k">API 주소<small>API</small></div><div class="v selectable">${esc(s.api)}</div><span></span></div>` : ""}
      <div class="setrow"><div class="k">접속 키<small>ACCESS TOKEN</small></div>
        <div class="v">${s.configured ? `${esc(s.clientIdHint)}${s.savedAt ? ` · ${fmtDate(s.savedAt)} 등록` : ""}` : `<span class="muted">없음</span>`}</div>
        <button class="btn small" id="reenter">${s.configured ? "다시 입력" : "등록하기"}</button></div>
      <div class="setrow"><div class="k">기록<small>LOGS</small></div>
        <div class="v selectable">${esc(s.logDir ?? "")}</div>
        <button class="btn small" id="logs">폴더 열기</button></div>
      <div class="setrow"><div class="k">토큰 지우기<small>RESET</small></div>
        <div class="v plain">이 컴퓨터 등록을 해제해요.</div>
        <button class="btn small danger" id="clear" ${s.configured ? "" : "disabled"}>토큰 지우기</button></div>
    </div>
    ${s.storeError ? `<div class="notice red">${esc(s.storeError)}</div>` : ""}
    <div class="meta">ONAIR 데스크탑 ${esc(s.version)} · 프록시 127.0.0.1:${s.proxyPort}</div>
  </div>`;

  $("#copy")!.onclick = async () => {
    await navigator.clipboard.writeText(s.server ?? "");
    $("#copy")!.textContent = "복사됨";
    setTimeout(() => ($("#copy")!.textContent = "복사"), 1200);
  };
  $("#reenter")!.onclick = () => call("show_setup");
  $("#logs")!.onclick = () => call("open_logs").catch((e) => alert(e));
  $("#clear")!.onclick = () => {
    const m = document.createElement("div");
    m.className = "modal";
    m.innerHTML = `<div class="box" role="dialog" aria-modal="true">
      <h3>토큰을 지울까요?</h3>
      <div class="muted">이 컴퓨터에 저장된 접속 키가 지워지고 등록 화면으로 돌아가요. 다시 쓰려면 관리자에게 새 등록 QR 을 받아야 해요.</div>
      <div class="row" style="margin-top:18px;justify-content:flex-end">
        <button class="btn small" data-no>취소</button><button class="btn small primary" data-yes>지우기</button>
      </div></div>`;
    document.body.appendChild(m);
    m.querySelector<HTMLButtonElement>("[data-no]")!.onclick = () => m.remove();
    m.querySelector<HTMLButtonElement>("[data-yes]")!.onclick = async () => {
      try {
        await call("clear_token");
      } catch (e) {
        m.remove();
        alert(e);
      }
    };
  };
}

function route() {
  if (location.hash === "#settings") renderSettings();
  else renderSetup();
}
window.addEventListener("hashchange", route);
route();
