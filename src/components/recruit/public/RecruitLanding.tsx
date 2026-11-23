"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import NeonButton from "@/components/common/NeonButton";
import { Horizon, Warp } from "@/components/recruit/public/Stage";
import { useNow } from "@/components/recruit/ui";
import { countdown, dotMd, md, mdhm } from "@/lib/recruitFormat";
import { cn } from "@/lib/utils";
import type { RecruitPublic } from "@/types/recruit";

/**
 * 공고 페이지 — 확정 시안 D-1 (RecruitPage.dc.html).
 * 첫 화면 소리 워프 → 스크롤하면 빨간 지평선이 올라오고 가운데 공고가 아래에서 올라온다 →
 * 첫 화면을 지나면 위에 작은 지원 줄 → 숫자 문장이 한 줄씩 밝아짐 → 역대 경쟁률 별자리(도착하면 재생, 끝날 때까지 못 넘어감)
 * → 자주 묻는 질문 → 마지막 지평선 + 지원하기.
 * 스크롤은 이 상자 안에서 한다 (부장 미리 보기 창에서도 같은 화면).
 */

const HERO_RUN = 1400; // 첫 화면 스크롤 길이 (시안 2300 - 900)
const STATS_RUN = 1300;
const SKY_RUN = 1100;

type Entry = { label: string; applied: number; quota: number; ratio: number; now: boolean };

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

function useSky() {
  return useMemo(() => {
    const out: CSSProperties[] = [];
    for (let i = 0; i < 90; i++) {
      const sz = 1 + ((i * 7) % 3);
      out.push({
        left: `${(((i * 397) % 1440) / 1440) * 100}%`,
        top: `${(((i * 263) % 900) / 900) * 100}%`,
        width: sz,
        height: sz,
        animationDuration: `${(2 + ((i * 13) % 30) / 10).toFixed(1)}s`,
        animationDelay: `${(-((i * 11) % 40) / 10).toFixed(1)}s`,
      });
    }
    return out;
  }, []);
}

function ApplyButton({
  label,
  disabled,
  onClick,
  small,
  className,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  small?: boolean;
  className?: string;
}) {
  return (
    <NeonButton
      size={small ? "md" : "lg"}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        small
          ? "h-11 w-[150px] md:h-11 md:w-[180px] [&_.nb-t]:text-[16px]"
          : "h-[60px] w-[280px] max-w-full",
        className,
      )}
    >
      {label}
    </NeonButton>
  );
}

export default function RecruitLanding({
  data,
  applied,
  preview,
  className,
}: {
  data: RecruitPublic;
  /** 이미 지원했으면 버튼이 '내 지원 보기' */
  applied?: boolean;
  /** 부장 미리 보기 — 버튼은 눌러도 아무 데도 안 간다 */
  preview?: boolean;
  className?: string;
}) {
  const r = data.recruit!;
  const now = useNow(1000);
  const box = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);
  const [y, setY] = useState(0);
  const [vh, setVh] = useState(900);
  const [open, setOpen] = useState(-1);
  const [played, setPlayed] = useState(false);
  const playAt = useRef(0);
  const sky = useSky();

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setVh(el.clientHeight || 900);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 역대 경쟁률 — 마지막 다섯 기수 (지난 기수 + 지금)
  const entries: Entry[] = useMemo(() => {
    const past = [...data.history]
      .filter((h) => h.cohort !== r.cohort && !!h.quota)
      .sort((a, b) => a.cohort - b.cohort)
      .slice(-4)
      .map((h) => ({
        label: `${h.cohort}기`,
        applied: h.applied,
        quota: h.quota!,
        ratio: h.applied / h.quota!,
        now: false,
      }));
    const applied = r.applied ?? 0;
    const quota = r.quota ?? 0;
    return [
      ...past,
      { label: `${r.cohort}기`, applied, quota, ratio: quota ? applied / quota : 0, now: true },
    ];
  }, [data.history, r]);

  const n = entries.length;
  const capDelay = 0.3 + (n - 1) * 0.95 + 0.1;
  const holdMs = (capDelay + 1.4) * 1000;

  const onScroll = useCallback(() => {
    const el = box.current;
    const skyEl = skyRef.current;
    if (!el || !skyEl) return;
    let yy = el.scrollTop;
    const skyTop = skyEl.offsetTop;
    if (yy >= skyTop - 100 && !played) {
      playAt.current = Date.now();
      setPlayed(true);
    }
    // 별자리가 다 그려질 때까지는 그 화면에 붙잡아 둔다
    const hold = skyTop + SKY_RUN;
    if (playAt.current && Date.now() - playAt.current < holdMs && yy > hold) {
      el.scrollTop = hold;
      yy = hold;
    }
    setY(yy);
  }, [played, holdMs]);

  useEffect(() => {
    onScroll();
  }, [onScroll]);

  // 날짜
  const start = r.applyStart ? Date.parse(r.applyStart) : 0;
  const end = r.applyEnd ? Date.parse(r.applyEnd) : 0;
  const before = r.phase === "upcoming" || (!!start && now > 0 && now < start);
  const closed =
    r.phase === "closed" || r.phase === "announced" || (!!end && now > 0 && now >= end);
  const cd = countdown(end && now ? end - now : 0);
  const ratio = r.quota ? ((r.applied ?? 0) / r.quota).toFixed(1) : "0.0";

  const goApply = () => {
    if (preview) return;
    // 페이지째 이동 — 모집 주소에서는 지원·내 지원 화면이 Cloudflare 학교 메일 로그인 뒤에 있어서
    // 화면 안 이동(router.push)으로는 로그인 화면으로 넘어가지 못한다
    window.location.assign(applied ? "/recruit/me" : "/recruit/apply");
  };
  const applyLabel = applied
    ? "내 지원 보기"
    : closed
      ? "마감했어요"
      : before
        ? "곧 열려요"
        : "지원하기";
  const applyDisabled = !applied && (closed || before);

  // 첫 화면 진행도
  const p = clamp(y / HERO_RUN);
  const t = clamp((p - 0.25) / 0.35);
  const hz = clamp(p / 0.6);
  const barOn = y > HERO_RUN + 100;
  // 숫자 문장
  const statsTop = statsRef.current?.offsetTop ?? HERO_RUN + vh;
  const q = clamp((y - statsTop) / STATS_RUN);
  // 숫자 문장 — 서버가 실제 기록(시보·방송·녹음·행사 지원)으로 센 stats 만. 없으면 이 칸을 통째로 숨긴다
  const stats = (data.stats?.items ?? []).filter(
    (x) => x && typeof x.value === "number" && x.value > 0,
  );
  const lines: { key: string; node: React.ReactNode }[] = stats.map((x, i) => {
    const n = (
      <span className="font-pretendard font-extrabold tabular-nums">
        {x.value.toLocaleString("ko-KR")}
      </span>
    );
    // 첫 줄 앞에 '올해' (센 첫 날이 학년 시작보다 뒤면 그 날짜부터)
    const head =
      i === 0
        ? x.from && data.stats?.since && x.from !== data.stats.since
          ? `${md(`${x.from}T00:00:00`)}부터 `
          : "올해 "
        : "";
    const more = i < stats.length - 1;
    const node =
      x.key === "bells" ? (
        <>
          {head}종이 {n}번 {more && i === 0 ? "울렸고" : "울렸어요"}
        </>
      ) : x.key === "broadcasts" ? (
        <>
          {head}방송은 {n}번 나갔어요
        </>
      ) : x.key === "recordings" ? (
        <>
          {head}녹음·녹화는 {n}번 했어요
        </>
      ) : x.key === "events" ? (
        <>
          {head}행사 {n}번을 맡았어요
        </>
      ) : (
        <>
          {head}
          {x.label} {n}
          {x.unit}
        </>
      );
    return { key: x.key, node };
  });
  if (lines.length) lines.push({ key: "you", node: <>이번엔 당신 차례예요</> });
  const lit = (i: number, last: boolean): CSSProperties => {
    const on = clamp((q - i * 0.22) / 0.12);
    const a = (0.15 + on * 0.85).toFixed(2);
    return {
      color: last ? `rgba(255,59,59,${a})` : `rgba(255,255,255,${a})`,
      transform: `translateY(${Math.round((1 - on) * 30)}px)`,
      transition: "color .2s",
    };
  };

  // 별자리 자리 (1440×900 기준)
  const rs = entries.map((e) => e.ratio);
  const lo = Math.min(...rs);
  const hi = Math.max(...rs);
  const stars = entries.map((e, i) => {
    const x = n === 1 ? 705 : 230 + (i * 950) / (n - 1);
    const yy = hi === lo ? 390 : 560 - ((e.ratio - lo) / (hi - lo)) * 340;
    const rad = 3 + e.ratio * 1.6;
    return { ...e, x, y: yy, r: e.now ? rad + 2 : rad, halo: e.now ? rad * 5 : rad * 3.2 };
  });

  const deadline = (
    <>
      {cd.dd} <span className="text-[16px] font-medium text-white/50 md:text-[20px]">{cd.hms}</span>
    </>
  );

  return (
    <div
      ref={box}
      onScroll={onScroll}
      className={cn(
        "no-scrollbar relative h-[100dvh] w-full overflow-y-auto overflow-x-hidden break-keep bg-black font-pretendard text-white",
        className,
      )}
    >
      {/* 첫 화면을 지나면 위에 작은 지원 줄 */}
      <div
        className="sticky top-0 z-20 -mb-[72px] flex h-[72px] items-center justify-between gap-4 border-b border-white/[0.08] bg-black/[0.82] px-5 backdrop-blur-md transition-opacity duration-300 md:px-14"
        style={{ opacity: barOn ? 1 : 0, pointerEvents: barOn ? "auto" : "none" }}
      >
        <span className="font-orbitron text-[16px] font-bold tracking-[0.22em]">ONAIR</span>
        <div className="flex items-center gap-3 md:gap-6">
          <span className="hidden text-[16px] font-semibold sm:inline">
            방송부 {r.cohort}기 모집
          </span>
          {!closed && !!end && (
            <span className="hidden text-[16px] text-[#FF3B3B] tabular-nums md:inline">
              {cd.dd} {cd.hms}
            </span>
          )}
          <ApplyButton small label={applyLabel} disabled={applyDisabled} onClick={goApply} />
        </div>
      </div>

      {/* 1. 첫 화면 — 워프 → 지평선 → 공고 */}
      <section className="relative" style={{ height: vh + HERO_RUN }}>
        <div className="sticky top-0 overflow-clip" style={{ height: vh }}>
          <div className="absolute inset-x-0 top-0 z-[5] flex h-[72px] items-center justify-between px-5 md:px-14">
            <span className="font-orbitron text-[16px] font-bold tracking-[0.22em]">ONAIR</span>
            {data.email && <span className="truncate text-[15px] text-white/50">{data.email}</span>}
          </div>
          <div
            className="absolute inset-0"
            style={{
              transform: `scale(${(1 + p * 1.4).toFixed(3)})`,
              opacity: +(1 - t * 0.82).toFixed(2),
            }}
          >
            <Warp core />
          </div>
          <Horizon top={Math.round(vh + 250 - hz * 520)} inner />
          <div
            className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-1.5"
            style={{ opacity: +(1 - clamp(p / 0.15)).toFixed(2) }}
          >
            <span className="font-orbitron text-[12px] tracking-[0.3em] text-white/50">SCROLL</span>
            <ChevronDown size={22} className="rc-bob text-white" />
          </div>
          <div
            className="absolute inset-x-0 flex flex-col items-center gap-[18px] px-5 text-center"
            style={{
              top: Math.max(110, Math.round(vh * 0.19)),
              opacity: +t.toFixed(2),
              transform: `translateY(${Math.round((1 - t) * 120)}px)`,
            }}
          >
            <span className="font-orbitron text-[12px] tracking-[0.3em] text-[#FF3B3B] md:text-[14px]">
              BSSM BROADCAST · RECRUIT
            </span>
            <h1 className="m-0 font-mbc text-[44px] font-normal leading-[1.15] md:text-[84px]">
              {r.title || `방송부 ${r.cohort}기 모집`}
            </h1>
            <span className="text-[17px] text-white/70 tabular-nums md:text-[22px]">
              {md(r.applyStart)}부터 {mdhm(r.applyEnd)}까지
            </span>
            <div className="grid grid-cols-2 gap-y-5 pb-2.5 pt-[22px] md:flex">
              {[
                { k: "모집", v: <>{r.quota ?? 0}명</> },
                { k: "경쟁률", v: <span className="text-[#FF3B3B]">{ratio} : 1</span> },
                { k: "마감", v: closed ? <>마감</> : deadline },
                {
                  k: (r.announceAt ?? r.announcePlanned) ? "면접 · 발표" : "면접",
                  v: (
                    <>
                      {[
                        r.interview.date ? dotMd(`${r.interview.date}T00:00:00`) : "",
                        dotMd(r.announceAt ?? r.announcePlanned),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </>
                  ),
                },
              ].map((c, i) => (
                <div
                  key={c.k}
                  className={cn(
                    "flex flex-col items-center gap-2 px-5 md:px-9",
                    i > 0 && "md:border-l md:border-white/[0.14]",
                    i % 2 === 1 && "max-md:border-l max-md:border-white/[0.14]",
                  )}
                >
                  <span className="text-[15px] text-white/50">{c.k}</span>
                  <span className="text-[22px] font-bold tabular-nums md:text-[30px]">{c.v}</span>
                </div>
              ))}
            </div>
            <ApplyButton label={applyLabel} disabled={applyDisabled} onClick={goApply} />
          </div>
        </div>
      </section>

      {/* 2. 숫자 문장 (서버 기록이 있을 때만) */}
      <section
        ref={statsRef}
        className={cn("relative", !lines.length && "hidden")}
        style={{ height: lines.length ? vh + STATS_RUN : 0 }}
      >
        <div
          className="sticky top-0 flex flex-col justify-center gap-[30px] overflow-clip px-6 md:px-[140px]"
          style={{ height: vh }}
        >
          {lines.map((l, i) => (
            <div
              key={l.key}
              className="font-mbc text-[34px] leading-[1.3] md:text-[66px]"
              style={lit(i, i === lines.length - 1)}
            >
              {l.node}
            </div>
          ))}
        </div>
      </section>

      {/* 3. 역대 경쟁률 별자리 */}
      <section ref={skyRef} className="relative" style={{ height: vh + SKY_RUN }}>
        <div className="sticky top-0 overflow-clip" style={{ height: vh }}>
          {sky.map((s, i) => (
            <i key={i} aria-hidden className="rc-tw" style={s} />
          ))}
          <div className="absolute left-6 top-[110px] z-[2] flex flex-col gap-2.5 md:left-[140px]">
            <span className="font-orbitron text-[13px] tracking-[0.3em] text-white/45">
              CONSTELLATION
            </span>
            <h2 className="m-0 font-mbc text-[36px] font-normal md:text-[52px]">역대 경쟁률</h2>
          </div>
          {played && (
            <>
              <svg
                viewBox="0 0 1440 900"
                preserveAspectRatio="xMidYMid meet"
                className="absolute inset-0 h-full w-full"
                role="img"
                aria-label={entries.map((e) => `${e.label} ${e.ratio.toFixed(1)} 대 1`).join(", ")}
              >
                {stars.slice(1).map((s, i) => {
                  const a = stars[i];
                  const now = s.now;
                  return (
                    <line
                      key={`l${i}`}
                      className="rc-ln"
                      x1={a.x}
                      y1={a.y}
                      x2={s.x}
                      y2={s.y}
                      stroke={now ? "rgba(255,59,59,.85)" : "rgba(255,255,255,.45)"}
                      strokeWidth={1.6}
                      style={{ animationDelay: `${(0.75 + i * 0.95).toFixed(2)}s` }}
                    />
                  );
                })}
                {stars.map((s, i) => {
                  const d = (0.3 + i * 0.95).toFixed(2);
                  const c = s.now ? "#FF3B3B" : "#fff";
                  const off = s.now ? s.halo + 10 : s.halo + 12;
                  return (
                    <g
                      key={s.label}
                      className={cn("rc-star", s.now && "now")}
                      style={{
                        animationDelay: s.now ? `${d}s, ${(capDelay + 0.4).toFixed(2)}s` : `${d}s`,
                      }}
                    >
                      <circle
                        cx={s.x}
                        cy={s.y}
                        r={s.halo}
                        fill={s.now ? "rgba(255,59,59,.22)" : "rgba(255,255,255,.1)"}
                      />
                      <circle cx={s.x} cy={s.y} r={s.r} fill={c} />
                      <text
                        x={s.x}
                        y={s.y - off}
                        fill={c}
                        fontFamily="Pretendard"
                        fontWeight={800}
                        fontSize={s.now ? 26 : 19}
                        textAnchor="middle"
                      >
                        {s.ratio.toFixed(1)} : 1
                      </text>
                      <text
                        x={s.x}
                        y={s.y + s.halo + 28}
                        fill="rgba(255,255,255,.55)"
                        fontFamily="Pretendard"
                        fontSize={17}
                        textAnchor="middle"
                      >
                        {s.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <div
                className="rc-cap absolute inset-x-6 bottom-16 grid grid-cols-3 border-t border-white/[0.14] md:inset-x-[140px] md:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]"
                style={{ animationDelay: `${capDelay.toFixed(2)}s`, "--n": n } as CSSProperties}
              >
                {entries.map((e, i) => (
                  <div
                    key={e.label}
                    className={cn(
                      "flex flex-col gap-1.5 pt-[22px]",
                      i > 0 && "md:border-l md:border-white/10 md:pl-6",
                    )}
                  >
                    <span className="text-[16px] text-white/55">
                      {e.now ? `${e.label} · 지금` : e.label}
                    </span>
                    <span
                      className={cn(
                        "whitespace-nowrap font-extrabold leading-[1.1] tabular-nums",
                        e.now
                          ? "text-[26px] text-[#FF3B3B] lg:text-[44px]"
                          : "text-[22px] lg:text-[36px]",
                      )}
                    >
                      {e.ratio.toFixed(1)} : 1
                    </span>
                    <span className="text-[13px] text-white/50 tabular-nums lg:text-[15px]">
                      지원 {e.applied}명 · 모집 {e.quota}명
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* 4. 자주 묻는 질문 */}
      {r.faq.length > 0 && (
        <section className="flex flex-col gap-5 px-6 pb-20 pt-[60px] md:px-[140px]">
          <h2 className="m-0 mb-4 font-mbc text-[36px] font-normal md:text-[52px]">
            자주 묻는 질문
          </h2>
          <div className="border-b border-white/[0.12]">
            {r.faq.map((f, i) => (
              <div key={i}>
                <button
                  type="button"
                  aria-expanded={open === i}
                  onClick={() => setOpen(open === i ? -1 : i)}
                  className="flex w-full items-center justify-between gap-6 border-t border-white/[0.12] py-[26px] text-left text-[18px] font-semibold md:text-[21px]"
                >
                  <span>{f.q}</span>
                  {open === i ? (
                    <Minus size={24} strokeWidth={1.4} className="shrink-0 text-white/50" />
                  ) : (
                    <Plus size={24} strokeWidth={1.4} className="shrink-0 text-white/50" />
                  )}
                </button>
                {open === i && (
                  <div className="whitespace-pre-line pb-[26px] text-[16px] leading-[1.75] text-white/[0.72] md:text-[18px]">
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. 마지막 지평선 */}
      <section className="relative flex h-[640px] flex-col items-center justify-center gap-[26px] overflow-clip px-5 text-center">
        <Horizon top={430} />
        {!closed && !!end && (
          <span className="relative text-[18px] font-bold text-[#FF3B3B] tabular-nums md:text-[20px]">
            마감까지 {cd.dd} {cd.hms}
          </span>
        )}
        <h2 className="relative m-0 font-mbc text-[40px] font-normal md:text-[64px]">
          방송실에서 기다릴게요
        </h2>
        <div className="relative">
          <ApplyButton label={applyLabel} disabled={applyDisabled} onClick={goApply} />
        </div>
      </section>
    </div>
  );
}

/** 모집이 없을 때 — 워프만 */
export function NoRecruit({ email }: { email?: string | null }) {
  return (
    <div className="relative h-[100dvh] w-full overflow-clip break-keep bg-black font-pretendard text-white">
      <div className="absolute inset-x-0 top-0 z-[5] flex h-[72px] items-center justify-between px-5 md:px-14">
        <span className="font-orbitron text-[16px] font-bold tracking-[0.22em]">ONAIR</span>
        {email && <span className="text-[15px] text-white/50">{email}</span>}
      </div>
      <Warp core className="opacity-60" />
      <div className="absolute inset-x-0 top-1/2 mt-16 flex flex-col items-center gap-3 text-center">
        <h1 className="m-0 font-mbc text-[36px] font-normal md:text-[56px]">
          지금은 모집하지 않아요
        </h1>
      </div>
    </div>
  );
}
