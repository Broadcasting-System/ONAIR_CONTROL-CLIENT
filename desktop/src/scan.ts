// 모바일: 카메라로 등록 QR 찍기 (tauri-plugin-barcode-scanner).
// windowed 모드: 웹뷰를 투명하게 하고 그 뒤에 카메라를 깐다 → 위에 우리 화면(네모 틀·취소)을 그린다.
import { Format, cancel, checkPermissions, openAppSettings, requestPermissions, scan } from "@tauri-apps/plugin-barcode-scanner";

export type ScanResult = { text: string } | { error: "denied" | "failed"; detail?: string } | { cancelled: true };

let overlay: HTMLElement | null = null;

// 취소 버튼 → 플러그인 cancel 이 scan 을 끝내 주지 않을 때도(Android 2.5.2 는 scan 약속을 버림) 바로 닫히게
function showOverlay(onCancel: () => void) {
  document.documentElement.classList.add("scanning");
  overlay = document.createElement("div");
  overlay.className = "scan-ui";
  overlay.innerHTML = `
    <div class="scan-top">QR 찍기</div>
    <div class="scan-box" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <button class="btn" type="button" data-cancel>취소</button>`;
  overlay.querySelector<HTMLButtonElement>("[data-cancel]")!.onclick = () => {
    onCancel();
    void cancel().catch(() => {});
  };
  document.body.appendChild(overlay);
}

function hideOverlay() {
  document.documentElement.classList.remove("scanning");
  overlay?.remove();
  overlay = null;
}

export async function scanQr(): Promise<ScanResult> {
  try {
    let p = await checkPermissions();
    if (p !== "granted") p = await requestPermissions();
    if (p !== "granted") return { error: "denied" };
  } catch (e) {
    return { error: "failed", detail: String(e) };
  }
  let cancelled!: (r: ScanResult) => void;
  const cancelledByUser = new Promise<ScanResult>((res) => (cancelled = res));
  showOverlay(() => cancelled({ cancelled: true }));
  try {
    const scanned = scan({ windowed: true, formats: [Format.QRCode], cameraDirection: "back" }).then(
      (r): ScanResult => ({ text: (r.content ?? "").trim() }),
    );
    scanned.catch(() => {}); // 취소 뒤에 늦게 오는 거절은 무시
    return await Promise.race([scanned, cancelledByUser]);
  } catch (e) {
    const s = typeof e === "string" ? e : ((e as { message?: string })?.message ?? JSON.stringify(e));
    if (/cancel/i.test(s)) return { cancelled: true };
    console.warn("QR 찍기 실패", e);
    return { error: "failed", detail: s };
  } finally {
    hideOverlay();
  }
}

export const openCameraSettings = () => openAppSettings().catch(() => {});
