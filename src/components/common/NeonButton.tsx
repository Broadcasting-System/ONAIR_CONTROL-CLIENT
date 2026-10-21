"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/**
 * 계단 컷 네온 — 공용 강조 버튼.
 * 평소엔 계단 없는 둥근 네온 버튼(몸통 + 네온 테두리 + 빛). 마우스 올림·키보드 초점·누름이면
 * 자른 선이 왼쪽에서 스르륵 미끄러져 들어오며 벌어져 계단 세 칸이 생기고, 글자는 계단을 뺀 칸 가운데로 밀린다.
 * 자르기는 SVG mask 안의 검은 선(stroke-width 0 → 틈)으로 — 몸통 테두리까지 같이 잘린다.
 * 모양은 실제 픽셀 폭·높이로 path 를 계산한다(viewBox 로 늘리면 찌그러진다).
 * 시안: Desktop/ONAIR-버튼-시안/anim.html (.nb CSS + make()). 움직임 CSS 는 globals.css 의 .neon-btn.
 */

export type NeonTone = "red" | "white" | "violet";
export type NeonSize = "md" | "lg";

const TONE: Record<NeonTone, { rgb: string; glow: string; badge: string }> = {
  red: { rgb: "255,74,67", glow: "rgba(255,59,59,.8)", badge: "#ff3b3b" },
  white: { rgb: "255,255,255", glow: "rgba(255,255,255,.75)", badge: "rgba(255,255,255,.2)" },
  violet: { rgb: "196,181,253", glow: "rgba(196,181,253,.85)", badge: "rgba(255,255,255,.2)" },
};

// 높이는 크기로 정한다. md 는 폰에서 44(손가락), PC 에서 42.
const SIZE: Record<NeonSize, { cls: string; fallback: number; text: string; gap: string; badge: string }> = {
  md: { cls: "h-11 md:h-[42px]", fallback: 42, text: "text-[14px]", gap: "gap-2", badge: "h-[19px] min-w-[19px] px-1.5 text-[10.5px]" },
  lg: { cls: "h-14", fallback: 56, text: "text-[18px]", gap: "gap-2.5", badge: "h-[22px] min-w-[22px] px-[7px] text-[12px]" },
};

const pill = (w: number, h: number, R: number) =>
  `M${R} 0 H${w - R} A${R} ${R} 0 0 1 ${w} ${R} V${h - R} A${R} ${R} 0 0 1 ${w - R} ${h} H${R} A${R} ${R} 0 0 1 0 ${h - R} V${R} A${R} ${R} 0 0 1 ${R} 0 Z`;

const geo = (h: number) => {
  const g = h * 0.085;
  const slope = h * 0.2;
  const xs = [h * 0.5, h * 0.78, h * 1.06]; // 자른 선 가운데 x
  return { g, slope, xs, stepsEnd: xs[2] + slope + g };
};

const TINT = [0.22, 0.12, 0.06];
const OPS = [1, 0.7, 0.45, 1]; // 앞 조각부터 점점 옅게, 몸통은 그대로

function NeonShape({ w, h, tone, uid }: { w: number; h: number; tone: NeonTone; uid: string }) {
  const c = TONE[tone].rgb;
  const R = h * 0.36;
  const body = pill(w, h, R);
  const { g, slope, xs, stepsEnd } = geo(h);
  // 자른 선 (위아래로 넉넉히 늘려 둔다)
  const line = (x: number, dx = 0) => `M${x + slope + dx + slope * 0.6} ${-h * 0.3} L${x - slope + dx - slope * 0.6} ${h * 1.3}`;
  // 조각 i 영역(자른 선 사이) — 옅게 칠할 띠
  const band = (x0: number, x1: number) => `M${x0 + slope} 0 L${x1 + slope} 0 L${x1 - slope} ${h} L${x0 - slope} ${h} Z`;
  const bands: [number, number][] = [
    [-h, xs[0]],
    [xs[0], xs[1]],
    [xs[1], xs[2]],
  ];

  return (
    <>
      <defs>
        <linearGradient id={`d${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#211416" />
          <stop offset="1" stopColor="#0f0a0b" />
        </linearGradient>
        <clipPath id={`p${uid}`}>
          <path d={body} />
        </clipPath>
        <mask id={`m${uid}`} maskUnits="userSpaceOnUse" x={-20} y={-20} width={w + 40} height={h + 40}>
          <rect x={-20} y={-20} width={w + 40} height={h + 40} fill="#fff" />
          {xs.map((x, i) => (
            <path key={i} className={`nb-cut nb-k${i + 1}`} d={line(x)} />
          ))}
        </mask>
      </defs>
      <g mask={`url(#m${uid})`}>
        <path d={body} fill={`url(#d${uid})`} stroke={`rgb(${c})`} strokeWidth={1.5} />
        <g clipPath={`url(#p${uid})`}>
          {bands.map(([a, b], i) => (
            <path key={i} className={`nb-tint nb-k${i + 1}`} d={band(a, b)} fill={`rgba(${c},${TINT[i]})`} />
          ))}
        </g>
        <path d={`M${stepsEnd + 6} 1.6 H${w - R}`} stroke="rgba(255,255,255,.12)" strokeWidth={1} />
      </g>
      {/* 자른 면에도 네온 선 (끊긴 자리가 빛나게) */}
      <g clipPath={`url(#p${uid})`}>
        {xs.map((x, i) => (
          <g key={i}>
            <path className={`nb-edge nb-k${i + 1}`} style={{ "--o": OPS[i] } as CSSProperties} stroke={`rgb(${c})`} d={line(x, -g / 2)} />
            <path className={`nb-edge nb-k${i + 1}`} style={{ "--o": OPS[i + 1] } as CSSProperties} stroke={`rgb(${c})`} d={line(x, g / 2)} />
          </g>
        ))}
      </g>
    </>
  );
}

export interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 네온 색. 기본 빨강 */
  tone?: NeonTone;
  /** md = 높이 42(폰 44), lg = 56 */
  size?: NeonSize;
  /** 글자 앞 아이콘 (lucide 등, 크기는 글자에 맞춰진다) */
  icon?: ReactNode;
  /** 글자 뒤 숫자 배지. 0·없음이면 안 보인다 */
  count?: number;
  /** CUE 튜토리얼 이름표 */
  "data-tour"?: string;
}

/** 터치로 뗀 뒤 갈라진 모습을 잠깐 남겨 두는 시간 */
const TOUCH_HOLD = 300;

const NeonButton = forwardRef<HTMLButtonElement, NeonButtonProps>(function NeonButton(
  { tone = "red", size = "md", icon, count, className, style, children, type = "button", onPointerDown, onPointerUp, onPointerCancel, ...rest },
  forwarded,
) {
  const sz = SIZE[size];
  const t = TONE[tone];
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = useRef<HTMLButtonElement | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [split, setSplit] = useState(false);
  const holdTimer = useRef<number | undefined>(undefined);

  const setRef = useCallback(
    (el: HTMLButtonElement | null) => {
      ref.current = el;
      if (typeof forwarded === "function") forwarded(el);
      else if (forwarded) forwarded.current = el;
    },
    [forwarded],
  );

  // 실제 픽셀 크기를 잰다 (transform 영향 없는 offset 크기)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      setBox((b) => (b && b.w === w && b.h === h ? b : w > 0 && h > 0 ? { w, h } : null));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => () => window.clearTimeout(holdTimer.current), []);

  // 터치·펜: 누르는 동안 갈라지고, 떼고 잠깐 유지했다가 돌아간다 (마우스는 CSS hover·active)
  const press = (e: PointerEvent<HTMLButtonElement>) => {
    onPointerDown?.(e);
    if (e.pointerType === "mouse") return;
    window.clearTimeout(holdTimer.current);
    setSplit(true);
  };
  const release = (e: PointerEvent<HTMLButtonElement>, fn?: (e: PointerEvent<HTMLButtonElement>) => void) => {
    fn?.(e);
    if (e.pointerType === "mouse") return;
    window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => setSplit(false), TOUCH_HOLD);
  };

  const h = box?.h ?? sz.fallback;
  const w = box?.w ?? 0;
  const { g, xs } = geo(h);
  // 글자는 평소 버튼 가운데, 갈라지면 [셋째 자른 선 + 틈, 폭 - 반지름×0.35] 칸의 가운데로 밀린다
  const left = xs[2] + g;
  const right = w - h * 0.36 * 0.35;
  const shift = (left + right) / 2 - w / 2;
  // 밀려도 양옆이 모자라지 않게 여백에 shift 만큼 더 둔다
  const pad = shift + h * 0.34;

  return (
    <button
      ref={setRef}
      type={type}
      {...rest}
      data-split={split || undefined}
      onPointerDown={press}
      onPointerUp={(e) => release(e, onPointerUp)}
      onPointerCancel={(e) => release(e, onPointerCancel)}
      style={
        {
          paddingLeft: pad,
          paddingRight: pad,
          borderRadius: h * 0.36,
          "--nb-gap": `${g}px`,
          "--nb-g0": `${h * 0.15}px`,
          "--nb-g1": `${h * 0.3}px`,
          "--nb-shift": `${shift}px`,
          "--nb-slide": `${h * 0.9}px`,
          // 못 누르는 버튼은 빛을 끈다 — 빛나면 누를 수 있는 것처럼 보인다
          "--nb-glow": rest.disabled ? "transparent" : t.glow,
          ...style,
        } as CSSProperties
      }
      className={cn(
        "neon-btn relative inline-flex select-none items-center justify-center whitespace-nowrap font-pretendard font-bold text-white outline-none [-webkit-tap-highlight-color:transparent]",
        "focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-white/80",
        "disabled:cursor-not-allowed disabled:opacity-35",
        sz.cls,
        className,
      )}
    >
      {box && (
        <svg aria-hidden width={box.w} height={box.h}>
          <NeonShape w={box.w} h={box.h} tone={tone} uid={uid} />
        </svg>
      )}
      <span className={cn("nb-t relative z-[1] inline-flex min-w-0 items-center", sz.gap, sz.text)}>
        {icon && <span className="inline-flex shrink-0 [&>svg]:h-[1.05em] [&>svg]:w-[1.05em]">{icon}</span>}
        <span className="min-w-0 truncate">{children}</span>
        {!!count && (
          <i
            className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-orbitron font-bold not-italic leading-none text-white", sz.badge)}
            style={{ background: t.badge }}
          >
            {count}
          </i>
        )}
      </span>
    </button>
  );
});

export default NeonButton;
