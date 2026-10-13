/**
 * 꽉 찬 소리 고리 — CUE 가 생각하는 중·로딩 표시.
 * 로고(반쪽 고리)가 일할 때 펼쳐진 모양. 막대 길이가 소리처럼 출렁이며 천천히 돈다.
 */

const N = 18;
const R0 = 19;
const MAX = 20;

export default function CueRing({ size = 16, className, spin = true }: { size?: number; className?: string; spin?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <style>{`
        .cue-ring { transform-origin: 50px 50px; animation: cue-spin 2.4s linear infinite; }
        .cue-bar { transform-box: fill-box; transform-origin: 50% 100%; animation: cue-pulse 0.9s ease-in-out infinite alternate; }
        @keyframes cue-spin { to { transform: rotate(360deg); } }
        @keyframes cue-pulse { from { transform: scaleY(0.35); } to { transform: scaleY(1); } }
        @media (prefers-reduced-motion: reduce) { .cue-ring, .cue-bar { animation: none; } }
      `}</style>
      <g className={spin ? "cue-ring" : undefined}>
        {Array.from({ length: N }, (_, k) => (
          <g key={k} transform={`rotate(${(k / N) * 360} 50 50)`}>
            <line
              className={spin ? "cue-bar" : undefined}
              x1="50" y1={50 - R0} x2="50" y2={50 - R0 - 4 - MAX}
              stroke="currentColor" strokeWidth="6" strokeLinecap="round"
              style={{ animationDelay: `${-((k * 7) % N) * 0.11}s` }}
            />
          </g>
        ))}
      </g>
    </svg>
  );
}
