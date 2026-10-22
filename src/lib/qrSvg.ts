import QRCode from "qrcode";

/** QR 을 SVG 로 — 칸마다 채운 사각형.
 *  qrcode 의 기본 SVG 는 줄마다 선(stroke)을 긋고 crispEdges 로 픽셀에 맞춰서, 칸 수의 정수배가 아닌 크기로 줄이면
 *  줄 굵기가 들쭉날쭉해 비뚤어 보이고 맨 끝 줄이 잘렸다 (맥 앱 웹뷰에서 특히). 사각형은 크기대로 정확히 그려진다. */
export function qrSvg(text: string, dark = "#111111", light = "#ffffff"): string {
  // 비밀값이 길어 QR 이 촘촘하다 — 노트북 카메라로 찍기 쉽게 오류 정정은 낮게(L)
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "L" });
  const n = modules.size;
  let d = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (modules.get(y, x)) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="geometricPrecision">` +
    `<rect width="${n}" height="${n}" fill="${light}"/><path fill="${dark}" d="${d}"/></svg>`
  );
}
