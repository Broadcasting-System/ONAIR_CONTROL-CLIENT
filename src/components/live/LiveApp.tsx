"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  Eye,
  MonitorUp,
  Music,
  Play,
  Timer,
  Volume2,
  VolumeX,
} from "lucide-react";
import EmptyState from "@/components/common/EmptyState";
import NeonButton from "@/components/common/NeonButton";
import OnairMark from "@/components/common/OnairMark";
import { DisplayMirror } from "@/components/display/DisplayMirror";
import { backendBase, resolveMediaUrl } from "@/lib/backend";
import { cn } from "@/lib/utils";

/** GET /api/live 의 채널 하나 */
interface LiveChannel {
  channel: number;
  label: string;
  hallName: string | null;
  type: string;
  title: string;
  startedAt: number | null;
  viewers: number;
  thumb: string | null;
}

async function fetchLive(): Promise<LiveChannel[]> {
  const r = await fetch(`${backendBase()}/api/live`, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return ((await r.json()) as { channels: LiveChannel[] }).channels;
}

/** 30초마다 바뀌는 지금 시각 — '14분째' 같은 표시용 */
function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

function since(startedAt: number | null, now: number): string {
  if (!startedAt) return "";
  const m = Math.max(0, Math.floor((now - startedAt) / 60_000));
  if (m < 1) return "방금";
  if (m < 60) return `${m}분`;
  return `${Math.floor(m / 60)}시간 ${m % 60}분`;
}

function clock(startedAt: number | null): string {
  if (!startedAt) return "";
  const d = new Date(startedAt);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}부터`;
}

// 소리가 있는 송출 — 이것만 [소리 켜기]를 보인다
const AUDIBLE = new Set(["video", "youtube", "audio"]);

const place = (c: LiveChannel) => [c.hallName, c.label].filter(Boolean).join(" · ");

function TypeIcon({ type, size = 28 }: { type: string; size?: number }) {
  if (type === "timer") return <Timer size={size} />;
  if (type === "screen") return <MonitorUp size={size} />;
  if (type === "audio") return <Music size={size} />;
  return <Play size={size} />;
}

function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 rounded-[5px] bg-[#FF3B3B] px-2 font-orbitron text-[11px] font-bold tracking-[0.12em] text-white",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" />
      LIVE
    </span>
  );
}

function Viewers({ n, long }: { n: number; long?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <Eye size={13} className="opacity-80" />
      {long ? `${n}명 보는 중` : n}
    </span>
  );
}

/** 썸네일 — 서버가 준 그림(영상 첫 장면·이미지·지금 슬라이드·유튜브), 없으면 종류 아이콘 */
function Thumb({ c, now }: { c: LiveChannel; now: number }) {
  const src = c.thumb ? resolveMediaUrl(c.thumb) : "";
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-[#1d1d22]">
      {src ? (
        // 학교 서버·유튜브의 그림이라 next/image 원격 도메인을 정해 둘 수 없다
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-white/30">
          <TypeIcon type={c.type} />
        </div>
      )}
      <LiveBadge className="absolute left-2 top-2" />
      {c.startedAt ? (
        <span className="absolute bottom-2 right-2 rounded-[5px] bg-black/70 px-1.5 py-0.5 font-pretendard text-[12px] tabular-nums text-white/90">
          {since(c.startedAt, now)}
        </span>
      ) : null}
    </div>
  );
}

function Card({ c, now, onOpen }: { c: LiveChannel; now: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-w-0 flex-col gap-2 text-left focus-visible:outline-none"
    >
      <div className="rounded-xl ring-white/60 group-focus-visible:ring-2">
        <Thumb c={c} now={now} />
      </div>
      <div className="min-w-0 px-0.5">
        <p className="truncate font-pretendard text-[15px] font-semibold text-white">{c.title}</p>
        <p className="flex items-center gap-2 truncate font-pretendard text-[13px] text-white/50">
          <span className="truncate">{place(c)}</span>
          <Viewers n={c.viewers} />
        </p>
      </div>
    </button>
  );
}

function Header({ onBack }: { onBack?: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-white/[0.06] bg-[#0b0b0d]/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md md:h-16 md:px-8">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="처음 화면으로"
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-white/80 hover:bg-white/[0.08]"
        >
          <ChevronLeft size={24} />
        </button>
      ) : null}
      <OnairMark size={26} className="text-[#FF3B3B]" />
      <span className="font-mbc text-[20px] tracking-wide text-white">ONAIR</span>
      <span className="ml-1 font-orbitron text-[11px] font-bold tracking-[0.3em] text-[#FF3B3B]">
        LIVE
      </span>
    </header>
  );
}

function Empty() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-6">
      <EmptyState>송출 중인 화면이 없어요</EmptyState>
    </div>
  );
}

/** 첫 화면 — 가장 오래 송출 중인 채널을 크게, 아래에 송출 중 전부 */
function Home({
  list,
  now,
  open,
}: {
  list: LiveChannel[];
  now: number;
  open: (ch: number) => void;
}) {
  const hero = list[0];
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 pb-[calc(32px+env(safe-area-inset-bottom))] pt-4 md:gap-10 md:px-8 md:pt-6">
      <section aria-label="대표 송출" className="flex flex-col gap-3">
        <div
          role="button"
          tabIndex={0}
          onClick={() => open(hero.channel)}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open(hero.channel)}
          className="group relative aspect-video max-h-[60dvh] w-full cursor-pointer overflow-hidden rounded-2xl bg-black ring-white/60 focus-visible:outline-none focus-visible:ring-2 md:rounded-[22px]"
        >
          <DisplayMirror channel={hero.channel} role="live" badge={false} />
          <div className="pointer-events-none absolute inset-0 z-20 bg-[linear-gradient(to_top,rgba(0,0,0,.82),rgba(0,0,0,0)_55%)] max-md:hidden" />
          <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 md:left-5 md:top-5">
            <LiveBadge />
            <span className="rounded-[5px] bg-black/60 px-2 py-0.5 font-pretendard text-[12px] text-white/90">
              <Viewers n={hero.viewers} />
            </span>
          </div>
          <div className="pointer-events-none absolute bottom-0 left-0 z-20 flex w-full items-end justify-between gap-4 p-6 max-md:hidden md:p-8">
            <div className="min-w-0">
              <h1 className="truncate font-mbc text-[34px] leading-tight text-white lg:text-[42px] [text-wrap:balance]">
                {hero.title}
              </h1>
              <p className="mt-1 font-pretendard text-[15px] text-white/65">
                {[place(hero), clock(hero.startedAt)].filter(Boolean).join(" · ")}
              </p>
            </div>
            {/* 누르면 위의 카드(role=button)가 받는다 — 키보드 초점은 카드 하나로 */}
            <NeonButton tabIndex={-1} size="lg" icon={<Play fill="currentColor" />} className="pointer-events-auto shrink-0">
              보기
            </NeonButton>
          </div>
        </div>
        <div className="md:hidden">
          <h1 className="font-mbc text-[24px] leading-tight text-white">{hero.title}</h1>
          <p className="mt-0.5 font-pretendard text-[13.5px] text-white/55">
            {[place(hero), clock(hero.startedAt)].filter(Boolean).join(" · ")}
          </p>
        </div>
      </section>

      <section aria-label="지금 송출 중" className="flex flex-col gap-3">
        <h2 className="flex items-baseline gap-2 font-pretendard text-[18px] font-bold text-white md:text-[20px]">
          지금 송출 중{" "}
          <span className="font-orbitron text-[15px] text-[#FF3B3B]">{list.length}</span>
        </h2>
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 md:gap-x-5">
          {list.map((c) => (
            <Card key={c.channel} c={c} now={now} onOpen={() => open(c.channel)} />
          ))}
        </div>
      </section>
    </div>
  );
}

/** 보기 — 큰 화면(소리는 눌러야 켜짐), 정보, 다른 송출 */
function Watch({
  ch,
  list,
  now,
  open,
}: {
  ch: number;
  list: LiveChannel[];
  now: number;
  open: (ch: number) => void;
}) {
  const [sound, setSound] = useState(false);
  const c = list.find((x) => x.channel === ch);
  const others = list.filter((x) => x.channel !== ch);

  // 채널을 바꾸면 다시 음소거로 시작
  useEffect(() => setSound(false), [ch]);

  return (
    <div className="mx-auto grid w-full max-w-[1400px] gap-6 pb-[calc(32px+env(safe-area-inset-bottom))] md:px-8 md:pt-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
      <section aria-label="송출 보기" className="flex min-w-0 flex-col gap-3">
        <div className="relative aspect-video w-full overflow-hidden bg-black md:rounded-2xl">
          <DisplayMirror key={ch} channel={ch} role="live" badge={false} sound={sound} />
          {c ? (
            <>
              <LiveBadge className="absolute left-3 top-3 z-20" />
              {AUDIBLE.has(c.type) && (
                <button
                  type="button"
                  onClick={() => setSound((v) => !v)}
                  aria-pressed={sound}
                  className="absolute bottom-3 right-3 z-20 inline-flex h-10 items-center gap-2 rounded-full bg-black/70 px-4 font-pretendard text-[14px] font-semibold text-white backdrop-blur hover:bg-black/85"
                >
                  {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  {sound ? "소리 끄기" : "소리 켜기"}
                </button>
              )}
            </>
          ) : (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/85">
              <p className="font-pretendard text-[17px] text-white/70">송출이 끝났어요</p>
              {list.length > 0 ? (
                <NeonButton onClick={() => open(list[0].channel)}>다른 송출 보기</NeonButton>
              ) : null}
            </div>
          )}
        </div>
        {c ? (
          <div className="px-4 md:px-0">
            <h1 className="font-mbc text-[24px] leading-tight text-white md:text-[30px] [text-wrap:balance]">
              {c.title}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-pretendard text-[14px] text-white/55">
              <span>{[place(c), clock(c.startedAt)].filter(Boolean).join(" · ")}</span>
              <span className="text-white/25">·</span>
              <Viewers n={c.viewers} long />
            </p>
          </div>
        ) : null}
      </section>

      {others.length > 0 ? (
        <aside aria-label="다른 송출" className="flex flex-col gap-3 px-4 md:px-0">
          <h2 className="font-pretendard text-[17px] font-bold text-white">다른 송출</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-1">
            {others.map((o) => (
              <Card key={o.channel} c={o} now={now} onOpen={() => open(o.channel)} />
            ))}
          </div>
        </aside>
      ) : null}
    </div>
  );
}

export default function LiveApp() {
  const router = useRouter();
  const params = useSearchParams();
  const now = useNow();
  const q = useQuery({ queryKey: ["live"], queryFn: fetchLive, refetchInterval: 5000, retry: 1 });
  const list = q.data ?? [];
  const raw = Number(params.get("ch"));
  const ch = Number.isInteger(raw) && raw >= 1 && raw <= 5 ? raw : null;

  // 보기 시작하면 내 연결이 서버에 붙은 뒤 한 번 더 받아 '보는 사람 수'에 나를 넣는다
  const { refetch } = q;
  useEffect(() => {
    const id = setTimeout(() => void refetch(), 1500);
    return () => clearTimeout(id);
  }, [ch, refetch]);

  const open = (n: number) => {
    router.push(`?ch=${n}`, { scroll: false });
    window.scrollTo({ top: 0 });
  };
  const home = () => router.push("?", { scroll: false });

  return (
    <main className="min-h-[100dvh] bg-[#0b0b0d] text-white">
      <Header onBack={ch ? home : undefined} />
      {q.isLoading ? (
        <div className="mx-auto w-full max-w-[1400px] px-4 pt-4 md:px-8 md:pt-6">
          <div className="aspect-video w-full animate-pulse rounded-2xl bg-white/[0.04]" />
        </div>
      ) : q.isError && !q.data ? (
        <div className="flex min-h-[60dvh] items-center justify-center px-6 text-center font-pretendard text-[16px] text-white/55">
          지금은 ONAIR 서버에 연결할 수 없어요
        </div>
      ) : ch ? (
        <Watch ch={ch} list={list} now={now} open={open} />
      ) : list.length === 0 ? (
        <Empty />
      ) : (
        <Home list={list} now={now} open={open} />
      )}
    </main>
  );
}
