"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { backendBase } from "@/lib/backend";
import { cn } from "@/lib/utils";
import { COLOR_PRESETS } from "@/types/lighting";
import type { CardBg } from "@/types/member";

/* 프로필 카드 배경 (시안 v2 crew-bg ①·③) — 부원마다 고른다.
   ① 소리 파형: 이름을 씨앗으로 그린 가로 파형 줄. 같은 사람은 늘 같은 그림, 흑백 + 빨간 줄 하나.
   ③ 본인 사진: 흑백 고대비로 어둡게 + 기수 색을 'color' 섞기로 얹는다. 사진이 없으면 ①. */

const RED = "#FF3B3B";

/** 기수 색 — 조명 9색 팔레트에서. 2~7기는 정해 두었고, 그 밖은 팔레트를 기수 순서로 돈다 */
const COHORT_COLORS: Record<number, string> = {
  2: "#4C6FE0",
  3: "#3DB9CF",
  4: "#8E5BD9",
  5: "#F2A65A",
  6: "#E5484D",
  7: "#D6409F",
};

export function cohortColor(cohort: number | null | undefined): string {
  const n = Number.isInteger(cohort) ? Math.abs(cohort as number) : 0;
  return COHORT_COLORS[n] ?? COLOR_PRESETS[n % COLOR_PRESETS.length].swatch;
}

/** 이름 → 씨앗 (시안 그대로) */
const seedOf = (s: string) => [...s].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);

/** 씨앗으로 도는 간단한 난수 (LCG) — 0 이상 1 미만 */
function rng(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

/** ① 소리 파형 — 26줄의 사인 합, 가운데 줄일수록 크게·밝게, 한 줄만 빨갛게 빛나고 옅은 주사선 */
function drawWave(g: CanvasRenderingContext2D, w: number, h: number, name: string) {
  const R = rng(seedOf(name));
  g.fillStyle = "#060607";
  g.fillRect(0, 0, w, h);
  const lines = 26;
  const hot = Math.floor(R() * lines);
  const f = [1 + R() * 3, 3 + R() * 6, 8 + R() * 10];
  const ph = [R() * 6, R() * 6, R() * 6];
  const amp = [0.5 + R(), 0.3 + R() * 0.5, 0.1 + R() * 0.3];
  for (let l = 0; l < lines; l++) {
    const y0 = h * 0.08 + (l / lines) * h * 0.8;
    const k = 1 - Math.abs(l - lines / 2) / (lines / 2);
    g.beginPath();
    for (let x = 0; x <= w; x += 3) {
      const t = x / w;
      let v = 0;
      for (let j = 0; j < 3; j++) v += amp[j] * Math.sin(t * f[j] * 6.28 + ph[j] + l * 0.18 * (j + 1));
      const env = Math.sin(t * Math.PI) ** 1.5; // 양 끝은 잔잔하게
      const y = y0 - v * env * (10 + 26 * k);
      if (x) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    const isHot = l === hot;
    g.strokeStyle = isHot ? "rgba(255,59,59,.95)" : `rgba(255,255,255,${0.06 + 0.22 * k})`;
    g.lineWidth = isHot ? 1.8 : 1;
    g.shadowColor = RED;
    g.shadowBlur = isHot ? 12 : 0;
    g.stroke();
  }
  g.shadowBlur = 0;
  g.fillStyle = "rgba(0,0,0,.18)";
  for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
}

/** ① 소리 파형 캔버스 — 화면 배율(DPR)에 맞춰 그리고, 크기가 바뀌면 다시 그린다 (움직임은 없다) */
export function WaveCanvas({ name, className }: { name: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const draw = () => {
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (!w || !h) return;
      const d = window.devicePixelRatio || 1;
      c.width = Math.round(w * d);
      c.height = Math.round(h * d);
      const g = c.getContext("2d");
      if (!g) return;
      g.setTransform(d, 0, 0, d, 0, 0);
      drawWave(g, w, h, name);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [name]);
  return <canvas ref={ref} aria-hidden className={cn("absolute inset-0 h-full w-full", className)} />;
}

/** 서버가 준 /api/... 사진 주소 → 지금 백엔드 주소 (고른 파일 미리보기 blob: 은 그대로) */
export const photoSrc = (url: string) => (/^(https?:|blob:|data:)/.test(url) ? url : `${backendBase()}${url}`);

/** 카드 사진으로 올릴 수 있는 파일 (서버와 같은 한도) */
export const PHOTO_MAX_MB = 5;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** 올리기 전에 고른 파일 확인 — 안 되면 짧은 오류 문구 */
export function photoProblem(file: File): string | null {
  if (!PHOTO_TYPES.includes(file.type)) return "JPG·PNG·WEBP 만 올릴 수 있어요";
  if (file.size > PHOTO_MAX_MB * 1024 * 1024) return `사진은 ${PHOTO_MAX_MB}MB 까지예요`;
  return null;
}

/** ③ 본인 사진 — 흑백·고대비·어둡게 + 기수 색 (사진을 못 불러오면 onError) */
export function PhotoLayer({ url, cohort, onError }: { url: string; cohort: number | null; onError?: () => void }) {
  return (
    <>
      {/* 학교마다 주소가 다른 ONAIR 서버의 이미지 — next/image 원격 도메인 설정을 둘 수 없어 <img> 사용 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoSrc(url)}
        alt=""
        aria-hidden
        draggable={false}
        onError={onError}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ filter: "grayscale(1) contrast(1.3) brightness(0.7)" }}
      />
      <div className="absolute inset-0 opacity-55 mix-blend-color" style={{ background: cohortColor(cohort) }} />
    </>
  );
}

/** 카드 배경 — 사진을 골랐고 사진이 있으면 ③, 아니면(불러오기 실패 포함) ① */
export function CardBackground({
  name,
  cohort,
  cardBg,
  photoUrl,
}: {
  name: string;
  cohort: number | null;
  cardBg: CardBg;
  photoUrl: string;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  const photo = cardBg === "photo" && !!photoUrl && broken !== photoUrl;
  return (
    <>
      {photo ? <PhotoLayer url={photoUrl} cohort={cohort} onError={() => setBroken(photoUrl)} /> : <WaveCanvas name={name} />}
      {/* 비네팅 — 사진은 지금처럼 가장자리까지, 파형은 시안처럼 아래만 어둡게 */}
      <div
        className="absolute inset-0"
        style={{
          background: photo
            ? "radial-gradient(ellipse at 70% 30%, transparent, rgba(0,0,0,0.85) 75%), linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.85))"
            : "linear-gradient(180deg, transparent 35%, rgba(0,0,0,0.85))",
        }}
      />
    </>
  );
}

/** 카드 배경 고르기 타일 하나 — 16:10 미리보기, 고르면 빨간 테두리 (등록 화면도 같이 쓴다) */
export function BgTile({
  label,
  on,
  onPick,
  disabled,
  children,
  actions,
}: {
  label: string;
  on: boolean;
  onPick: () => void;
  disabled?: boolean;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <button
        type="button"
        aria-pressed={on}
        disabled={disabled}
        onClick={onPick}
        className={cn(
          "relative aspect-[16/10] overflow-hidden rounded-xl border bg-[#060607] text-left transition-colors disabled:cursor-default",
          on ? "border-red-400/70 shadow-[0_0_0_1px_rgba(255,59,59,0.5)]" : "border-white/10 enabled:hover:border-white/30",
        )}
      >
        {children}
        <span className="absolute bottom-2 left-2.5 flex items-center gap-1.5 font-pretendard text-[13px] font-bold text-white [text-shadow:0_1px_4px_#000]">
          <span className={cn("h-2 w-2 rounded-full", on ? "bg-[#FF3B3B]" : "bg-white/30")} />
          {label}
        </span>
      </button>
      {actions && <div className="flex gap-1.5">{actions}</div>}
    </div>
  );
}

export const tileBtn =
  "flex h-8 flex-1 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] font-pretendard text-[13px] font-semibold text-white/75 transition-colors enabled:hover:bg-white/10 enabled:hover:text-white disabled:opacity-40";
