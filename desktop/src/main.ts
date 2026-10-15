// ONAIR 앱 — 앱에 들어 있는 등록(#setup)·설정(#settings) 화면 (데스크탑·모바일 같이)
import "@fontsource/orbitron/500.css";
import "@fontsource/orbitron/700.css";
import "./styles.css";
import { call } from "./api";
import type { AppStateView, ParsedLink, SaveResult } from "./api";
import { decodeQrFromBlob } from "./qr";
import { openCameraSettings, scanQr } from "./scan";

const app = document.getElementById("app")!;
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => app.querySelector(sel) as T | null;

const isMobile = (platform: string) => platform === "ios" || platform === "android";
const OS_NAME: Record<string, string> = { windows: "Windows", macos: "macOS", ios: "iOS", android: "Android" };

function fmtDate(sec?: number | null) {
  if (!sec) return "";
  const d = new Date(sec * 1000);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/* ---------------- 등록 화면 ---------------- */

type Tab = "link" | "qr" | "code" | "manual";

async function renderSetup() {
  const params = new URLSearchParams(location.search);
  const reason = params.get("r");
  const state = await call<AppStateView>("get_state");
  const pending = await call<string | null>("pending_link");
  const mobile = isMobile(state.platform);
  document.documentElement.classList.toggle("mobile", mobile);
  // 받은 링크가 있으면 링크, 아니면 코드가 먼저 (모바일은 카메라로 QR 찍기가 먼저)
  let tab: Tab = pending ? "link" : mobile ? "qr" : "code";
  let parsed: ParsedLink | null = null;
  // 8자리 코드는 한 번만 쓸 수 있어서, 받은 접속 정보는 앱(Rust)에 두고 같은 코드로 다시 부르지 않는다
  let redeemedFor: string | null = null;
  let forceable = false;

  const notices: Record<string, [string, string]> = {
    link: ["", "등록 링크를 받았어요."],
    cleared: ["red", mobile ? "이 기기의 접속 키를 지웠어요." : "이 컴퓨터의 접속 키를 지웠어요."],
    denied: ["red", "접속 키가 거부됐어요."],
  };
  const notice = pending ? notices.link : reason ? notices[reason] : undefined;
  const reenter = state.configured;

  const os = OS_NAME[state.platform] ?? state.platform;
  const ticks = Array.from({ length: 41 }, (_, i) => `<i style="left:${i * 2.5}%;height:${i % 5 ? 8 : 14}px"></i>`).join("");

  // 시안 A · 라디오 튜너 — 이 화면은 '키 연결' 단계. #st2(키 연결)·#st3(프로필) 표시가 바뀌면 바늘이 따라간다
  app.innerHTML = `
  <div class="reg-stage"><div class="reg">
    <div class="reg-top">
      <div class="reg-logo">ONAIR<small>DEVICE REGISTRATION</small></div>
      <span class="tally">OFF AIR</span>
    </div>
    <section class="reg-panel">
      <div class="tuner">
        <div class="tuner-status">
          <span class="k">${mobile ? "이 기기" : "이 컴퓨터"} · ${esc(os)}</span>
          <span class="v"><span class="v-idle">${reenter ? "키 재등록" : "등록 대기"}</span><span class="v-busy">키 확인 중…</span></span>
        </div>
        <div class="scale" aria-hidden="true">${ticks}<b class="needle"></b></div>
        <ol class="marks"><li id="st2" class="on">키 연결</li><li id="st3">프로필</li><li>승인</li><li>ON AIR</li></ol>
      </div>
      ${reenter ? `<div class="muted">서버 <span class="selectable mono">${esc(state.server)}</span></div>` : ""}
      ${notice ? `<div class="notice ${notice[0]}">${esc(notice[1])}</div>` : ""}
      ${state.storeError ? `<div class="notice red">${esc(state.storeError)}</div>` : ""}

      <div>
        <div class="tabs" role="tablist">
          ${mobile
            ? `<button data-tab="qr">QR</button><button data-tab="code">코드</button><button data-tab="link">링크</button>`
            : `<button data-tab="code">코드</button><button data-tab="link">링크 붙여넣기</button><button data-tab="qr">QR 사진</button>`}
          <button data-tab="manual">직접 입력</button>
        </div>

        <div data-pane="link">
          <label class="f" for="link">등록 링크</label>
          <textarea class="in" id="link" spellcheck="false" placeholder="onair://register?d=…"></textarea>
          <div id="parsed"></div>
        </div>

        <div data-pane="qr" class="hidden">
          ${mobile ? `<button class="btn primary scan-btn" id="scan" type="button">QR 찍기</button>` : ""}
          <label class="drop" id="drop" tabindex="0">
            <div><b>QR 사진</b><u>${mobile ? "사진 고르기" : "파일 고르기"}</u></div>
            <input type="file" id="file" accept="image/*" class="hidden">
          </label>
          <div id="qrmsg" class="muted" style="margin-top:6px"></div>
        </div>

        <div data-pane="code" class="hidden">
          <label class="f" for="code">초대 코드</label>
          <input class="in code-in" id="code" spellcheck="false" autocomplete="one-time-code" autocapitalize="characters" maxlength="9" placeholder="XXXX-XXXX">
          <details><summary>고급</summary>
            <label class="f" for="cserver">서버 주소</label>
            <input class="in" id="cserver" type="url" inputmode="url" spellcheck="false" autocapitalize="none" autocorrect="off" autocomplete="off" placeholder="https://onair.bssmcast.com" value="${esc(state.server ?? "https://onair.bssmcast.com")}">
            <label class="f" for="capi">API 주소</label>
            <input class="in" id="capi" type="url" inputmode="url" spellcheck="false" autocapitalize="none" autocorrect="off" autocomplete="off" placeholder="http://100.95.97.82:8000">
          </details>
          <div id="codeparsed"></div>
        </div>

        <div data-pane="manual" class="hidden">
          <label class="f" for="server">서버 주소</label>
          <input class="in" id="server" type="url" inputmode="url" spellcheck="false" autocapitalize="none" autocorrect="off" autocomplete="off" placeholder="https://onair.bssmcast.com" value="${esc(state.server ?? "")}">
          <label class="f" for="cid">접속 키 ID</label>
          <input class="in" id="cid" spellcheck="false" autocomplete="off" placeholder="xxxx.access">
          <label class="f" for="csec">비밀 키</label>
          <input class="in" id="csec" type="password" autocomplete="off" placeholder="••••••••">
          <details><summary>고급</summary>
            <label class="f" for="api">API 주소</label>
            <input class="in" id="api" type="url" inputmode="url" spellcheck="false" autocapitalize="none" autocorrect="off" autocomplete="off" placeholder="http://100.95.97.82:8000">
          </details>
        </div>
      </div>

      <div class="foot">
        <div class="foot-l">
          <span class="status" id="status"></span>
        </div>
        ${reenter ? `<button class="btn ghost" id="cancel">취소</button>` : ""}
        <button class="btn hidden" id="force">그래도 저장</button>
        <button class="btn primary" id="go">연결</button>
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
  setTab(tab);

  const parsedBox = (p: ParsedLink) => `<dl class="parsed">
        <dt>서버</dt><dd>${esc(p.server)}</dd>
        ${p.api ? `<dt>API</dt><dd>${esc(p.api)}</dd>` : ""}
        <dt>접속 키 ID</dt><dd>${esc(p.clientIdHint)}</dd>
        <dt>비밀 키</dt><dd>●●●●●●●●</dd>
        ${p.exp ? `<dt>유효 기간</dt><dd class="ok">${fmtDate(p.exp)}까지</dd>` : ""}
      </dl>`;

  async function showParsed() {
    const box = $("#parsed")!;
    const v = linkEl.value.trim();
    parsed = null;
    if (!v) return void (box.innerHTML = "");
    try {
      parsed = await call<ParsedLink>("parse_link", { link: v });
      box.innerHTML = parsedBox(parsed);
    } catch (e) {
      box.innerHTML = `<div class="notice red">${esc(e)}</div>`;
    }
  }
  linkEl.addEventListener("input", showParsed);

  // QR 글자 → 링크 칸
  async function fromQrText(text: string | null) {
    const msg = $("#qrmsg")!;
    if (!text) return void (msg.innerHTML = `<span class="err">QR 을 찾지 못했어요.</span>`);
    if (!text.startsWith("onair:")) return void (msg.innerHTML = `<span class="err">ONAIR 등록 QR 이 아니에요.</span>`);
    msg.innerHTML = "";
    linkEl.value = text;
    setTab("link");
    await showParsed();
  }
  // QR 이미지 → 링크
  async function fromImage(blob: Blob) {
    $("#qrmsg")!.innerHTML = "QR 읽는 중…";
    await fromQrText(await decodeQrFromBlob(blob));
  }
  // 모바일: 카메라로 찍기 → 바로 연결 확인
  $("#scan")?.addEventListener("click", async () => {
    const msg = $("#qrmsg")!;
    msg.innerHTML = "";
    const r = await scanQr();
    if ("cancelled" in r) return;
    if ("error" in r) {
      if (r.error === "denied") {
        msg.innerHTML = `<span class="err">카메라 권한이 꺼져 있어요.</span> <button class="btn small" id="camset" type="button">설정 열기</button>`;
        $("#camset")!.onclick = () => openCameraSettings();
      } else {
        msg.innerHTML = `<span class="err">카메라를 열 수 없어요.</span>`;
      }
      return;
    }
    await fromQrText(r.text);
    if (parsed) await submit(false);
  });
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

  const codeEl = $<HTMLInputElement>("#code")!;
  const codeKey = () =>
    [codeEl.value, $<HTMLInputElement>("#cserver")!.value, $<HTMLInputElement>("#capi")!.value].map((v) => v.trim()).join("|");
  // 코드 칸: 대문자로, 4자리 뒤 '-'
  codeEl.addEventListener("input", () => {
    const raw = codeEl.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    codeEl.value = raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
  });

  /** 코드 탭: 코드 → 접속 정보 (한 번만). 실패하면 화면에 서버 문구를 그대로 */
  async function redeem(): Promise<boolean> {
    if (redeemedFor === codeKey()) return true;
    const box = $("#codeparsed")!;
    box.innerHTML = "";
    if (codeEl.value.replace(/[^A-Za-z0-9]/g, "").length !== 8) {
      setStatus(`<span class="err">코드는 8자리예요.</span>`);
      return false;
    }
    setStatus("코드 확인 중…");
    try {
      const p = await call<ParsedLink>("redeem_code", {
        server: $<HTMLInputElement>("#cserver")!.value,
        api: $<HTMLInputElement>("#capi")!.value || null,
        code: codeEl.value,
      });
      redeemedFor = codeKey();
      box.innerHTML = parsedBox(p);
      return true;
    } catch (e) {
      setStatus(`<span class="err">${esc(e)}</span>`);
      return false;
    }
  }

  function input(force: boolean) {
    if (tab === "code") return { redeemed: true, force };
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
    if ((tab === "link" || tab === "qr") && !linkEl.value.trim()) {
      setStatus(`<span class="err">등록 링크가 비어 있어요.</span>`);
      return;
    }
    if (tab === "code") {
      goBtn.disabled = true;
      const ok = await redeem();
      goBtn.disabled = false;
      if (!ok) return;
    }
    goBtn.disabled = forceBtn.disabled = true;
    $("#st2")!.className = "done";
    $("#st3")!.className = "on";
    setStatus("연결 확인 중…");
    try {
      const r = await call<SaveResult>("verify_and_save", { input: input(force) });
      if (r.saved) {
        setStatus(`<span class="ok">● ${esc(r.message)}</span>`);
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
  const mobile = isMobile(s.platform);
  document.documentElement.classList.toggle("mobile", mobile);
  app.innerHTML = `
  <div class="settings">
    <div class="top">
      <h2>설정</h2>
      ${s.configured ? `<span class="chip"><span class="dot"></span>REGISTERED</span>` : `<span class="chip"><span class="dot red"></span>NOT REGISTERED</span>`}
      ${mobile ? `<button class="btn small" id="close">닫기</button>` : ""}
    </div>
    <div class="panel">
      <div class="setrow"><div class="k">서버 주소<small>SERVER</small></div>
        <div class="v selectable">${s.server ? esc(s.server) : `<span class="muted">없음</span>`}</div>
        <button class="btn small" id="copy" ${s.server ? "" : "disabled"}>복사</button></div>
      ${s.api && s.server && !s.api.startsWith(s.server) ? `<div class="setrow"><div class="k">API 주소<small>API</small></div><div class="v selectable">${esc(s.api)}</div><span></span></div>` : ""}
      <div class="setrow"><div class="k">접속 키<small>ACCESS TOKEN</small></div>
        <div class="v">${s.configured ? `${esc(s.clientIdHint)}${s.savedAt ? ` · ${fmtDate(s.savedAt)} 등록` : ""}` : `<span class="muted">없음</span>`}</div>
        <button class="btn small" id="reenter">${s.configured ? "다시 입력" : "등록하기"}</button></div>
      ${mobile ? "" : `<div class="setrow"><div class="k">기록<small>LOGS</small></div>
        <div class="v selectable">${esc(s.logDir ?? "")}</div>
        <button class="btn small" id="logs">폴더 열기</button></div>`}
      <div class="setrow"><div class="k">토큰 지우기<small>RESET</small></div>
        <div class="v plain"></div>
        <button class="btn small danger" id="clear" ${s.configured ? "" : "disabled"}>토큰 지우기</button></div>
    </div>
    ${s.storeError ? `<div class="notice red">${esc(s.storeError)}</div>` : ""}
    <div class="meta">ONAIR ${mobile ? esc(OS_NAME[s.platform]) : "데스크탑"} ${esc(s.version)} · 프록시 127.0.0.1:${s.proxyPort}</div>
  </div>`;

  $("#copy")!.onclick = async () => {
    await navigator.clipboard.writeText(s.server ?? "");
    $("#copy")!.textContent = "복사됨";
    setTimeout(() => ($("#copy")!.textContent = "복사"), 1200);
  };
  $("#reenter")!.onclick = () => call("show_setup");
  if ($("#logs")) $("#logs")!.onclick = () => call("open_logs").catch((e) => alert(e));
  // 모바일은 설정도 메인 창에서 열려서 '닫기' → 컨트롤 화면 (등록 전이면 등록 화면)
  $("#close")?.addEventListener("click", () => call(s.configured ? "open_control" : "show_setup"));
  $("#clear")!.onclick = () => {
    const m = document.createElement("div");
    m.className = "modal";
    m.innerHTML = `<div class="box" role="dialog" aria-modal="true">
      <h3>토큰을 지울까요?</h3>
      <div class="muted">되돌릴 수 없어요.</div>
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
