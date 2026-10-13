/** ONAIR 로고 — 반쪽 고리 막대 + 가운데 점 (public/onair-mark.svg 와 같은 모양). 색은 currentColor */
const BARS =
  "M33.67 47.65L22.38 46.03M34.99 43.15L18.89 35.79M37.53 39.19L26.53 29.67M41.08 36.12L29.24 17.70M45.35 34.17L40.96 19.20M50.00 33.50L50.00 9.50M54.65 34.17L59.04 19.20M58.92 36.12L70.76 17.70M62.47 39.19L73.47 29.67M65.01 43.15L81.11 35.79M66.33 47.65L77.62 46.03";

export default function OnairMark({ size = 24, className, dot }: { size?: number; className?: string; dot?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <g transform="translate(50 68) scale(1.16) translate(-50 -50)">
        <path d={BARS} stroke="currentColor" strokeWidth="5.2" strokeLinecap="round" fill="none" />
        <circle cx="50" cy="50" r="7.5" fill={dot ?? "currentColor"} />
      </g>
    </svg>
  );
}
