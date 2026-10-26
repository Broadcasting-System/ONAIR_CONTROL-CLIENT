"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 앱을 켤 때 한 번 나오는 시작 화면.
 * TV 잡음이 걷히고 → 배경 그림의 빨간 입자가 소용돌이치며 모여 덩어리가 되고 → 육각형이 번쩍이며 자리 잡고 → 가운데 마크(반쪽 소리 고리).
 * 입자는 public/onair_background.png 의 빨간 점을 그 자리에서 뽑는다. 누르거나 키를 치면 건너뛴다.
 * 같은 창(세션)에서는 한 번만, 움직임 줄이기 설정이면 나오지 않는다.
 */

const SEEN_KEY = "onair.splash.seen";
const END = 3.6;
const FADE = 0.45;
const IMG_W = 1920;
const IMG_H = 1093;
const MAX_POINTS = 20000;
// 배경 그림의 육각형 [x, y, 반지름] (그림 픽셀)
const HEX: [number, number, number][] = [
  [986, 249, 25], [905, 316, 33], [475, 441, 22], [1009, 468, 30],
  [1210, 531, 27], [1290, 580, 30], [908, 588, 32], [964, 643, 20],
];

type Pt = { x: number; y: number; k: number; r1: number; r2: number; r3: number; i: number };

function mulberry(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const eOutExpo = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
const eOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);

function shouldShow(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    return sessionStorage.getItem(SEEN_KEY) !== "1";
  } catch {
    return true;
  }
}

/** 배경 그림에서 빨간 점을 뽑는다 */
async function loadPoints(): Promise<Pt[]> {
  const img = new Image();
  img.src = "/onair_background.png";
  await img.decode();
  const c = document.createElement("canvas");
  c.width = IMG_W; c.height = IMG_H;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, IMG_W, IMG_H);
  const x0 = 380, y0 = 60, w = 1100, h = 700;
  const d = g.getImageData(x0, y0, w, h).data;
  const raw: [number, number, number][] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, r = d[o], gg = d[o + 1], b = d[o + 2];
      if (r > 65 && r > gg * 1.9 && r > b * 1.6) raw.push([(x + x0) / IMG_W, (y + y0) / IMG_H, Math.min(1, (r - 55) / 170)]);
    }
  }
  const R = mulberry(7);
  for (let i = raw.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [raw[i], raw[j]] = [raw[j], raw[i]]; }
  const R2 = mulberry(11);
  return raw.slice(0, MAX_POINTS).map(([x, y, k], i) => ({ x, y, k, r1: R2(), r2: R2(), r3: R2(), i }));
}

export default function Splash() {
  // 처음 그릴 때는 검은 막으로 덮어 두고(앱이 잠깐 비쳤다 사라지지 않게), 띄울지 정해지면 바꾼다
  const [show, setShow] = useState(true);
  const [decided, setDecided] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const cvRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!shouldShow()) setShow(false);
    setDecided(true);
  }, []);

  useEffect(() => {
    if (!show || !decided) return;
    const cv = cvRef.current;
    if (!cv) return;
    const g = cv.getContext("2d")!;
    let raf = 0, alive = true, t0 = 0;
    let W = 0, H = 0, DPR = 1, ZS = 1, ZX = 0, ZY = 0;
    let P: Pt[] = [];
    let bb = { x0: 0.2, y0: 0.1, x1: 0.77, y1: 0.66 };

    const finish = () => {
      if (!alive) return;
      alive = false;
      cancelAnimationFrame(raf);
      try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* 저장 못 해도 그냥 넘어감 */ }
      setLeaving(true);
      window.setTimeout(() => setShow(false), FADE * 1000);
    };

    const resize = () => {
      DPR = Math.min(2, window.devicePixelRatio || 1);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * DPR; cv.height = H * DPR;
      const bw = (bb.x1 - bb.x0) * IMG_W, bh = (bb.y1 - bb.y0) * IMG_H;
      ZS = Math.min((W * 0.9) / bw, (H * 0.86) / bh);
      ZX = W / 2 - ((bb.x0 + bb.x1) / 2) * IMG_W * ZS;
      ZY = H / 2 - ((bb.y0 + bb.y1) / 2) * IMG_H * ZS;
    };
    const mx = (x: number) => ZX + x * IMG_W * ZS;
    const my = (y: number) => ZY + y * IMG_H * ZS;

    const hexes = (t: number, start: number) => {
      HEX.forEach(([x, y, r], i) => {
        const s = start + i * 0.09, p = seg(t, s, s + 0.32);
        if (p <= 0) return;
        const cx = mx(x / IMG_W), cy = my(y / IMG_H);
        const pop = p < 1 ? 1 + Math.sin(p * Math.PI) * 0.35 : 1;
        const rr = r * ZS * pop * (0.4 + 0.6 * eOutCubic(p));
        const flash = Math.max(0, 1 - Math.abs(p - 0.7) * 4);
        const pulse = 0.5 + 0.5 * Math.sin((t - s) * 4 + i);
        g.save();
        g.globalCompositeOperation = "lighter";
        g.shadowColor = flash > 0.2 ? `rgba(255,255,255,${flash})` : "rgba(255,60,75,0.95)";
        g.shadowBlur = 10 + flash * 30 + pulse * 8;
        g.strokeStyle = `rgba(255,${70 + 185 * flash},${80 + 175 * flash},1)`;
        g.lineWidth = (2.2 + flash * 2.5) * Math.max(1, ZS * 1.4);
        g.fillStyle = `rgba(229,57,70,${0.1 + 0.25 * flash})`;
        g.beginPath();
        const steps = 6 * eOutCubic(clamp(p * 1.25));
        for (let k = 0; k <= Math.ceil(steps); k++) {
          const a = Math.PI / 6 + (Math.min(k, steps) / 6) * Math.PI * 2;
          const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
          if (k) g.lineTo(px, py); else g.moveTo(px, py);
        }
        if (steps >= 6) { g.closePath(); g.fill(); }
        g.stroke();
        if (p > 0.6 && p < 1) {
          const rp = (p - 0.6) / 0.4, R2 = rr * (1 + rp * 0.9);
          g.shadowBlur = 0; g.lineWidth = 1.5; g.strokeStyle = `rgba(255,120,130,${0.6 * (1 - rp)})`;
          g.beginPath();
          for (let k = 0; k <= 6; k++) {
            const a = Math.PI / 6 + (k / 6) * Math.PI * 2;
            if (k) g.lineTo(cx + Math.cos(a) * R2, cy + Math.sin(a) * R2); else g.moveTo(cx + Math.cos(a) * R2, cy + Math.sin(a) * R2);
          }
          g.stroke();
        }
        g.restore();
      });
    };

    // 마크(반쪽 소리 고리) — 가운데 점이 톡 튀어나오고 막대가 왼쪽부터 차례로 솟아남. 앱 아이콘과 같은 모양
    const D_LENS = [0.4, 0.7, 0.55, 0.9, 0.6, 1, 0.6, 0.9, 0.55, 0.7, 0.4];
    const mark = (t: number, start: number) => {
      const dim = eOutCubic(seg(t, start - 0.15, start + 0.25));
      if (dim > 0) { g.fillStyle = `rgba(4,5,7,${0.5 * dim})`; g.fillRect(0, 0, W, H); }
      const dp = seg(t, start, start + 0.35);
      if (dp <= 0) return;
      const u = (Math.min(W, H) / 100) * 0.42 * 1.16, cx = W / 2, cy = H / 2 + 12 * u;
      const pop = dp < 1 ? 1 + Math.sin(dp * Math.PI) * 0.5 : 1;
      g.save();
      g.shadowColor = "rgba(255,255,255,.6)"; g.shadowBlur = 5 * u;
      g.fillStyle = "#fff";
      g.beginPath(); g.arc(cx, cy, 7.5 * u * pop * eOutCubic(dp), 0, 7); g.fill();
      g.shadowBlur = 3 * u; g.shadowColor = "rgba(255,255,255,.55)";
      g.strokeStyle = "#fff"; g.lineCap = "round"; g.lineWidth = 5.2 * u;
      D_LENS.forEach((L, k) => {
        const s0 = start + 0.12 + k * 0.045, bp = seg(t, s0, s0 + 0.32);
        if (bp <= 0) return;
        const over = bp < 1 ? eOutCubic(bp) * (1 + Math.sin(bp * Math.PI) * 0.25) : 1;
        const a = Math.PI + ((k + 0.5) / 11) * Math.PI, r0 = 16.5 * u, r1 = r0 + (3 + L * 21 * over) * u;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        g.stroke();
      });
      g.restore();
    };

    const render = (t: number) => {
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      g.fillStyle = "#040507"; g.fillRect(0, 0, W, H);
      const frame = Math.floor(t * 30), rr = mulberry(frame + 1);
      // TV 잡음
      const st = 1 - seg(t, 0.3, 0.75);
      if (st > 0) {
        for (let i = 0; i < 12000 * st; i++) {
          const v = (90 + rr() * 165) | 0;
          g.fillStyle = `rgba(${v},${v},${v},${0.6 * st})`;
          g.fillRect(rr() * W, rr() * H, 2, 2);
        }
        g.fillStyle = `rgba(255,255,255,${0.07 * st})`;
        g.fillRect(0, ((t * 1.7) % 1) * H, W, H * 0.12);
      }
      // 소용돌이치며 모이는 입자
      const cx = W / 2, cy = H / 2, size = Math.max(1, ZS * 0.8);
      g.globalCompositeOperation = "lighter";
      for (const q of P) {
        const d = 0.3 + q.r1 * 0.5, p = eOutExpo(seg(t, d, d + 1.15));
        if (p <= 0) continue;
        const tx = mx(q.x), ty = my(q.y);
        const ang = q.r2 * Math.PI * 2, rad = Math.max(W, H) * (0.6 + q.r3 * 0.5);
        const sx = cx + Math.cos(ang) * rad, sy = cy + Math.sin(ang) * rad;
        const sw = (1 - p) * 2.2;
        const x0 = sx + (tx - sx) * p - cx, y0 = sy + (ty - sy) * p - cy;
        const x = cx + x0 * Math.cos(sw) - y0 * Math.sin(sw) + Math.sin(t * 1.7 + q.i * 0.37) * 0.8 * p;
        const y = cy + x0 * Math.sin(sw) + y0 * Math.cos(sw) + Math.cos(t * 1.3 + q.i * 0.21) * 0.8 * p;
        const a = Math.min(1, 0.35 + 0.85 * q.k) * clamp(p * 1.5);
        if (a <= 0.01) continue;
        g.fillStyle = `rgba(229,${40 + 40 * q.k},${55 + 30 * q.k},${a})`;
        const s = (1.2 + q.k * 1.2) * size;
        g.fillRect(x, y, s, s);
      }
      // 번짐
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.filter = "blur(7px)"; g.globalAlpha = 0.75; g.drawImage(cv, 0, 0); g.restore();
      g.globalCompositeOperation = "source-over";
      hexes(t, 1.45);
      // 잡음이 걷힐 때 가로 찢김
      const gl = Math.max(0, 1 - Math.abs(t - 0.62) * 7);
      if (gl > 0) {
        const rg = mulberry(frame * 7 + 3);
        for (let i = 0; i < 7; i++) {
          const y = rg() * H, h = 6 + rg() * 40, dx = (rg() - 0.5) * 70 * gl;
          g.drawImage(cv, 0, y * DPR, W * DPR, h * DPR, dx, y, W, h);
        }
      }
      mark(t, 2.25);
    };

    const loop = (now: number) => {
      if (!alive) return;
      if (!t0) t0 = now;
      const t = (now - t0) / 1000;
      // 창 크기가 0(숨긴 탭·아직 배치 전)이면 그리지 않고 시간만 흘린다 — 크기 0 캔버스를 drawImage 하면 오류가 나서
      // 반복이 멈추고, 시작 화면이 앱을 덮은 채 남았다(Sentry 로 찾음). 그 밖의 오류도 앱을 막지 않게 바로 넘어간다
      if (W > 0 && H > 0) {
        try {
          render(Math.min(t, END));
        } catch {
          finish();
          return;
        }
      }
      if (t >= END) { finish(); return; }
      raf = requestAnimationFrame(loop);
    };

    (async () => {
      try {
        const pts = await loadPoints();
        P = pts;
        if (P.length) {
          let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
          for (const q of P) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
          bb = { x0, y0, x1, y1 };
        }
      } catch {
        finish();  // 그림을 못 읽으면 바로 앱으로
        return;
      }
      if (!alive) return;
      resize();
      raf = requestAnimationFrame(loop);
    })();

    const skip = () => finish();
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", skip);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", skip);
    };
  }, [show, decided]);

  if (!show) return null;
  return (
    <div
      aria-hidden
      onPointerDown={() => {
        try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* 무시 */ }
        setLeaving(true);
        window.setTimeout(() => setShow(false), FADE * 1000);
      }}
      className="fixed inset-0 z-[1000] cursor-pointer bg-[#040507] transition-opacity ease-out"
      style={{ opacity: leaving ? 0 : 1, transitionDuration: `${FADE * 1000}ms` }}
    >
      <canvas ref={cvRef} className="block h-full w-full" />
    </div>
  );
}
