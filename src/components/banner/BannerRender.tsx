"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { displayAppBase, resolveMediaUrl } from "@/lib/backend";
import { cn } from "@/lib/utils";
import {
  type BannerOverlay,
  type BannerScene,
  type DefaultBannerPayload,
  type GifPayload,
  type ImagePayload,
  type ScoreboardPayload,
  type TimerPayload,
} from "@/lib/bannerApi";

/** 현수막 실제 크기 (강당 LED) */
export const BANNER_W = 6845;
export const BANNER_H = 552;
export const BANNER_RATIO = `${BANNER_W} / ${BANNER_H}`;

/** LED 점 무늬 (실제 전광판처럼 보이게 위에 덮는다). 폰은 띠가 작아 점도 잘게 */
const LED_DOTS =
  "bg-[radial-gradient(rgba(0,0,0,0.5)_35%,transparent_36%)] bg-[length:3px_3px] md:bg-[length:4px_4px]";

/** 폭을 재서 6845×552 그림을 맞게 줄인다 */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** LED 띠 한 줄 — 6845:552 비율, 점 무늬, 안쪽은 children */
export function LedStrip({ children, className, dots = true }: { children?: ReactNode; className?: string; dots?: boolean }) {
  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-lg bg-[radial-gradient(120%_140%_at_50%_0%,#1b0a0c,#070708_70%)]", className)}
      style={{ aspectRatio: BANNER_RATIO }}
    >
      {children}
      {dots && <div aria-hidden className={cn("pointer-events-none absolute inset-0", LED_DOTS)} />}
    </div>
  );
}

/** 서버에 보내기 전 초안을 송출 화면과 비슷하게 그린다 (송출 화면 앱의 장면을 옮긴 간단한 판) */
export function BannerDraftRender({ scene, payload }: { scene: BannerScene; payload: Record<string, unknown> }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const s = w / BANNER_W;
  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      {w > 0 && (
        <div
          style={{ width: BANNER_W, height: BANNER_H, transform: `scale(${s})`, transformOrigin: "top left" }}
          className="pointer-events-none select-none"
        >
          <Scene scene={scene} payload={payload} />
        </div>
      )}
    </div>
  );
}

function Scene({ scene, payload }: { scene: BannerScene; payload: Record<string, unknown> }) {
  switch (scene) {
    case "default":
      return <DefaultScene {...(payload as unknown as DefaultBannerPayload)} />;
    case "scoreboard":
      return <ScoreScene {...(payload as unknown as ScoreboardPayload)} />;
    case "image":
      return <ImageScene {...(payload as unknown as ImagePayload)} />;
    case "gif":
      return <GifScene {...(payload as unknown as GifPayload)} />;
    case "timer":
      return <TimerScene {...(payload as unknown as TimerPayload)} />;
    default:
      return <div className="h-full w-full bg-black" />;
  }
}

/** 송출 화면 앱의 배경 그림 (못 불러오면 숨기고 아래 색이 보인다) */
function Bg({ file, fit }: { file: string; fit: "fill" | "cover" }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${displayAppBase()}/${file}`}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: fit }}
    />
  );
}

const nowrap: CSSProperties = { whiteSpace: "nowrap", lineHeight: 1, position: "absolute" };

function DefaultScene({ mainText, subText1, subText2 }: Partial<DefaultBannerPayload>) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "linear-gradient(90deg,#f4f7ff,#e9eefb 60%,#dfe6f7)" }}>
      <Bg file="default-banner-bg.png" fit="fill" />
      {mainText?.trim() ? (
        <div
          style={{
            ...nowrap,
            left: "15%",
            top: "51%",
            transform: "translateY(-50%)",
            fontFamily: "Pretendard, sans-serif",
            fontWeight: 900,
            fontSize: 235,
            backgroundImage: "linear-gradient(90deg,#16225f 0%,#3a2d86 55%,#8a2a86 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {mainText}
        </div>
      ) : null}
      {subText1?.trim() ? (
        <div style={{ ...nowrap, left: "72.5%", top: "40%", transform: "translateY(-50%)", fontFamily: "Pretendard, sans-serif", fontWeight: 600, fontSize: 72, color: "#20366b" }}>
          {subText1}
        </div>
      ) : null}
      {subText2?.trim() ? (
        <div style={{ ...nowrap, left: "71.4%", top: "58.3%", transform: "translate(-50%,-50%)", fontFamily: "Pretendard, sans-serif", fontWeight: 600, fontSize: 52, color: "#fff", textShadow: "0 0 12px rgba(20,40,110,0.9)" }}>
          {subText2}
        </div>
      ) : null}
    </div>
  );
}

const num = (v: unknown) => (Number.isFinite(v as number) ? (v as number) : 0);

function Digits({ value, digits, scale }: { value: number; digits: number; scale: number }) {
  const max = 10 ** digits - 1;
  const chars = String(Math.max(0, Math.min(max, value))).padStart(digits, "0").split("");
  const W = 300 * scale;
  const H = 440 * scale;
  return (
    <div style={{ display: "flex", gap: 22 * scale }}>
      {chars.map((d, i) => (
        <div
          key={i}
          style={{
            width: W,
            height: H,
            borderRadius: 28 * scale,
            background: "linear-gradient(#ffffff 0%,#f1f1f1 49.6%,#c9c9c9 49.6%,#c9c9c9 50.4%,#e8e8e8 50.4%,#f7f7f7 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-orbitron), Orbitron, sans-serif",
            fontWeight: 900,
            fontSize: 320 * scale,
            color: "#0f0f0f",
            letterSpacing: "-0.04em",
            boxShadow: "0 14px 30px rgba(0,0,0,0.55)",
          }}
        >
          {d}
        </div>
      ))}
    </div>
  );
}

function ScoreScene(p: Partial<ScoreboardPayload>) {
  const showSet = p.showSet ?? true;
  const a = p.teamA;
  const b = p.teamB;
  const subtitle = a?.name && b?.name ? `${a.name} VS ${b.name}` : (p.subtitle ?? "");
  const titleSize = num(p.titleSize) || 160;
  const subtitleSize = num(p.subtitleSize) || 76;
  const cluster = (t: typeof a, side: "left" | "right") => {
    const main = <Digits key="m" value={num(t?.score)} digits={2} scale={1} />;
    const set = showSet ? <Digits key="s" value={num(t?.set)} digits={1} scale={0.62} /> : null;
    return <div style={{ display: "flex", alignItems: "flex-start", gap: 40 }}>{side === "left" ? [main, set] : [set, main]}</div>;
  };
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        color: "#fff",
        background: "radial-gradient(ellipse at center,#0d4a2c 0%,#051a10 70%,#020a06 100%)",
        overflow: "hidden",
      }}
    >
      <Bg file="banner-bg.png" fit="cover" />
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 200px",
        }}
      >
        {cluster(a, "left")}
        <div style={{ flex: 1, textAlign: "center", padding: "0 40px", fontFamily: "Pretendard, sans-serif" }}>
          <div style={{ fontSize: titleSize, fontWeight: 800, lineHeight: 1.05, marginBottom: subtitleSize * 0.5, whiteSpace: "nowrap", textShadow: "0 4px 18px rgba(0,0,0,0.75)" }}>
            {p.title}
          </div>
          <div style={{ fontSize: subtitleSize, fontWeight: 500, letterSpacing: "0.06em", whiteSpace: "nowrap", textShadow: "0 2px 10px rgba(0,0,0,0.6)" }}>
            {subtitle}
          </div>
        </div>
        {cluster(b, "right")}
      </div>
      {p.victory ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 80,
            background: "rgba(0,0,0,0.55)",
            fontFamily: "var(--font-orbitron), Orbitron, sans-serif",
            fontWeight: 900,
          }}
        >
          <span style={{ fontSize: 260, color: "#ffe14d", textShadow: "0 0 60px rgba(255,200,40,0.7)" }}>WIN</span>
          <span style={{ fontFamily: "Pretendard, sans-serif", fontSize: 200, fontWeight: 900 }}>{p.victory.name}</span>
        </div>
      ) : null}
    </div>
  );
}

const DEFAULT_OVERLAY: BannerOverlay = {
  title: "",
  subtitle: "",
  titleSize: 240,
  subtitleSize: 120,
  showSubtitle: true,
  color: "#ffffff",
  position: "center",
  visible: true,
};

function ImageScene({ url, fit = "cover", overlay }: Partial<ImagePayload>) {
  const ov = { ...DEFAULT_OVERLAY, ...overlay };
  const hasTitle = !!ov.title?.trim();
  const hasSub = ov.showSubtitle && !!ov.subtitle?.trim();
  const showText = !!overlay && ov.visible && (hasTitle || hasSub);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#000" }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolveMediaUrl(url)} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: fit, display: "block" }} />
      ) : null}
      {showText ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: ov.position === "top" ? "flex-start" : ov.position === "center" ? "center" : "flex-end",
            alignItems: "center",
            padding: "40px 120px",
            textAlign: "center",
            color: ov.color || "#fff",
            fontFamily: "Pretendard, sans-serif",
          }}
        >
          {hasTitle ? (
            <div style={{ fontSize: num(ov.titleSize) || 240, fontWeight: 800, lineHeight: 1.05, marginBottom: hasSub ? (num(ov.subtitleSize) || 120) * 0.5 : 0, whiteSpace: "nowrap" }}>
              {ov.title}
            </div>
          ) : null}
          {hasSub ? (
            <div style={{ fontSize: num(ov.subtitleSize) || 120, fontWeight: 500, letterSpacing: "0.06em", lineHeight: 1.1, whiteSpace: "nowrap" }}>{ov.subtitle}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function GifScene({ url }: Partial<GifPayload>) {
  return (
    <div style={{ width: "100%", height: "100%", background: "#000" }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolveMediaUrl(url)} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : null}
    </div>
  );
}

export function fmtDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function TimerScene({ durationSec = 0, label, mode = "down", color = "#ffffff" }: Partial<TimerPayload>) {
  return (
    <div style={{ width: "100%", height: "100%", background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, color }}>
      {label ? <div style={{ fontFamily: "var(--font-mbc), Pretendard, sans-serif", fontSize: 96, lineHeight: 1 }}>{label}</div> : null}
      <div style={{ fontFamily: "var(--font-orbitron), Orbitron, sans-serif", fontWeight: 800, fontSize: label ? 330 : 400, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {fmtDuration(mode === "up" ? 0 : durationSec)}
      </div>
    </div>
  );
}
