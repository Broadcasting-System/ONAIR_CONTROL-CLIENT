// QR 이미지(캡처·파일) → 글자. jsQR 로 캔버스 픽셀을 읽는다.
import jsQR from "jsqr";

export async function decodeQrFromBlob(blob: Blob): Promise<string | null> {
  const bmp = await createImageBitmap(blob).catch(() => null);
  if (!bmp) return null;
  // 너무 큰 이미지는 줄여서 (속도), 작은 건 그대로
  for (const maxSide of [1600, 800, 2400]) {
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const res = jsQR(img.data, w, h, { inversionAttempts: "attemptBoth" });
    if (res?.data) return res.data.trim();
  }
  return null;
}
