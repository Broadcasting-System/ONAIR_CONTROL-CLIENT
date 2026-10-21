"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, MapPin, Mic, Play, Radio, RotateCcw, Send, Square, Type } from "lucide-react";
import EmptyState from "@/components/common/EmptyState";
import NeonButton from "@/components/common/NeonButton";
import OnairButton, { type OnairButtonState } from "@/components/common/OnairButton";
import { toast } from "@/components/common/Toast";
import { LevelMeter, fmtClock } from "@/components/broadcast/parts";
import TargetSheet from "@/components/broadcast/TargetSheet";
import { TEST_SPEAKER_ID, isTestSpeaker } from "@/constants/testSpeaker";
import { useLiveMic } from "@/hooks/useLiveMic";
import { cn } from "@/lib/utils";
import { tapi, teacherLiveUrl } from "@/components/teacher/api";
import { ChoiceChip, Glass, Seg, inputCls } from "@/components/teacher/parts";

/** 선생님 바로 방송 — 홈 맨 위 한 장(시안 B). 마이크는 방송부 마이크와 같은 ONAIR 버튼, 글은 들어 보기·바로 내보내기.
 *  다른 방송·종이 가까우면 버튼을 끄고 까닭 한 줄. 규칙·시간 여유는 서버 app/services/teacher_now.py */

export interface Space {
  value: string;
  label: string;
}

interface NowStatus {
  busy: boolean;
  reason: string | null;
  mine: { kind: "mic" | "text"; target: string; targets?: string[]; place: string; text: string; startedAt: number; endsAt: number | null } | null;
  bell: { time: string; label: string; at: number; jobAt: number } | null;
  micSeconds: number;
  micMinSeconds: number;
  micBlocked: boolean;
  textSeconds: number | null;
  maxSeconds: number;
  warnSeconds: number;
  now: number;
}

interface NowItem {
  id: string;
  kind: "mic" | "text";
  place: string;
  /** 첫 곳 (예전 기록은 이것만) */
  target?: string;
  targets?: string[];
  text?: string;
  seconds: number;
  at: string;
  end: string;
  ok: boolean;
  /** 못 내보냈을 때 까닭 한마디 */
  note?: string;
}

type Mode = "mic" | "text";
type Plan = { endsAt: number; cut: "max" | "bell"; bell: string | null; warn: number };

const TEXT_MAX = 500;
/** 글을 읽는 데 드는 어림(초) — 서버가 TTS 를 만들어 실제 길이로 다시 본다 */
const readSeconds = (text: string) => text.trim().length / 6;
const QUICK: Space[] = [
  { value: "1학년", label: "1학년" },
  { value: "2학년", label: "2학년" },
  { value: "3학년", label: "3학년" },
  { value: "전체", label: "전교" },
];
const ENDED: Record<string, string> = {
  stop: "방송을 마쳤어요",
  bell: "종이 울릴 시간이라 방송을 마쳤어요",
  max: "15분이 지나 방송을 마쳤어요",
  idle: "소리가 오지 않아 방송을 마쳤어요",
};
const END_NOTE: Record<string, string> = { bell: "종 때문에 끝남", max: "15분 지나 끝남", idle: "소리 없어 끝남", disconnect: "연결 끊김", error: "오류로 끝남" };

const mmss = (s: number) => {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

function whenLabel(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const today = new Date();
  return d.toDateString() === today.toDateString() ? `오늘 ${hm}` : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

/** 여러 곳 → 한 줄 (서버 places_label 과 같게) — 두 곳까지 '1학년 1반, 교무실', 셋부터 '1학년 1반 외 2곳' */
function joinPlaces(labels: string[]): string {
  return labels.length <= 2 ? labels.join(", ") : `${labels[0]} 외 ${labels.length - 1}곳`;
}

/** 담당에 '2학년 3반' 이 있으면 그 반부터 */
function myClass(dept: string | undefined, spaces: Space[]): string {
  const m = /(\d+)\s*학년\s*(\d+)\s*반/.exec(dept ?? "");
  const v = m ? `${m[1]}-${m[2]}` : "";
  return spaces.some((s) => s.value === v) ? v : "";
}

// ======================================================================

function OnAirHead({ place, what }: { place: string; what: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 font-orbitron text-[12px] font-bold tracking-[0.22em] text-white">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF3B3B] shadow-[0_0_8px_#FF3B3B]" />
        ON AIR
      </span>
      <b className="truncate font-pretendard text-[16px] text-white">
        {place}
        <small className="ml-1.5 text-[14px] font-medium text-white/50">{what}</small>
      </b>
    </div>
  );
}

/** 버튼이 꺼진 까닭 한 줄 (+ 종까지 남은 시간) */
function Why({ icon, text, countdown }: { icon: ReactNode; text: string; countdown?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-white/[0.07] text-white/85">{icon}</span>
      <b className="min-w-0 flex-1 font-pretendard text-[16px] leading-snug text-white">{text}</b>
      {countdown && <span className="whitespace-nowrap font-orbitron text-[18px] font-bold tabular-nums text-white">{countdown}</span>}
    </div>
  );
}

function Recent({
  items,
  className,
  onRetry,
}: {
  items: NowItem[];
  className?: string;
  /** 못 내보낸 글 — 같은 곳·같은 글로 다시 채운다 */
  onRetry: (r: NowItem) => void;
}) {
  const body = items.length ? (
    <div className="flex flex-col">
      {items.map((r, i) => (
        <div key={r.id} className={cn("grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 py-[13px]", i > 0 && "border-t border-white/[0.09]")}>
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-white/[0.07] text-white/85">
            {r.kind === "mic" ? <Mic size={17} /> : <Type size={17} />}
          </span>
          <span className="min-w-0">
            <b className="block truncate font-pretendard text-[15px] text-white">{r.place}</b>
            <span className="mt-0.5 block truncate font-pretendard text-[13.5px] text-white/45">
              {!r.ok
                ? [`${r.kind === "mic" ? "마이크" : "글"} · 못 내보냈어요`, r.note].filter(Boolean).join(" · ")
                : r.kind === "mic"
                  ? [`마이크 · ${mmss(r.seconds)}`, END_NOTE[r.end]].filter(Boolean).join(" · ")
                  : `"${r.text ?? ""}"`}
            </span>
          </span>
          {!r.ok && r.kind === "text" && r.text ? (
            <button
              type="button"
              onClick={() => onRetry(r)}
              className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 px-3.5 font-pretendard text-[13.5px] font-semibold text-white hover:bg-white/[0.08]"
            >
              <RotateCcw size={15} />
              다시 보내기
            </button>
          ) : (
            <span className="whitespace-nowrap font-pretendard text-[13.5px] tabular-nums text-white/45">{whenLabel(r.at)}</span>
          )}
        </div>
      ))}
    </div>
  ) : (
    <EmptyState>최근 방송이 없어요</EmptyState>
  );
  return (
    <div className={className}>
      <h2 className="mb-3 font-mbc text-[24px] text-white lg:hidden">최근 방송</h2>
      <Glass className="px-[18px] py-1.5 lg:px-6 lg:pb-2 lg:pt-[22px]">
        <h2 className="mb-1.5 font-mbc text-[24px] text-white max-lg:hidden">최근 방송</h2>
        {body}
      </Glass>
    </div>
  );
}

// ======================================================================

export default function InstantBroadcast({
  spaces,
  grades,
  dept,
  onAirChange,
}: {
  spaces: Space[];
  grades: number[];
  dept?: string;
  /** 방송 중이면 홈 나머지를 흐리게 */
  onAirChange: (onAir: boolean) => void;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("mic");
  /** 방송할 곳 — 빠른 칩(1학년·전교…)은 하나, '다른 곳'은 지도에서 여러 곳 */
  const [targets, setTargets] = useState<string[]>([]);
  const [sheet, setSheet] = useState(false);
  /** 고르기 창 안에서만 바뀌는 것 — [완료]를 눌러야 targets 로 */
  const [draft, setDraft] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [playing, setPlaying] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  // 담당 반이 있으면 처음엔 그 반 (한 번만 — 다 빼도 다시 채우지 않게)
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !spaces.length) return;
    seeded.current = true;
    const mine = myClass(dept, spaces);
    if (mine) setTargets((cur) => (cur.length ? cur : [mine]));
  }, [spaces, dept]);

  const live = useLiveMic({
    url: teacherLiveUrl,
    endedText: (reason, _max, message) => ENDED[reason] ?? (message.replace(/\.$/, "") || "방송을 마쳤어요"),
    onMessage: (m) => {
      if (m.type === "onair" || m.type === "deadline") {
        setPlan({
          endsAt: Date.now() + Number(m.endsIn ?? 0) * 1000,
          cut: m.cut === "bell" ? "bell" : "max",
          bell: typeof m.bell === "string" ? m.bell : null,
          warn: Number(m.warnSeconds ?? 30),
        });
      }
    },
  });
  const micOn = live.state !== "idle";

  const statusQ = useQuery({
    queryKey: ["teacher-now-status"],
    queryFn: () => tapi<NowStatus>("/now/status"),
    refetchInterval: (q) => (q.state.data?.mine ? 1000 : 3000),
  });
  const recentQ = useQuery({ queryKey: ["teacher-now-recent"], queryFn: () => tapi<{ items: NowItem[] }>("/now/recent") });
  const st = statusQ.data;
  /** 서버 시계와의 차이 — 종 시각은 서버 기준 */
  const offset = st ? st.now - statusQ.dataUpdatedAt : 0;
  const now = useNow(250);
  const serverNow = now + offset;

  const textMine = st?.mine?.kind === "text" ? st.mine : null;
  const send = useMutation({
    mutationFn: () => tapi<{ endsAt: number }>("/now", { method: "POST", body: JSON.stringify({ targets, text: text.trim() }) }),
    // 상태를 다시 받아 '방송 중'이 보일 때까지 기다린다 (그 사이 고르기 화면이 깜박이지 않게)
    onSuccess: async () => {
      setText("");
      await qc.invalidateQueries({ queryKey: ["teacher-now-status"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      qc.invalidateQueries({ queryKey: ["teacher-now-status"] });
    },
  });
  const onAir = micOn || !!textMine || send.isPending;
  useEffect(() => onAirChange(onAir), [onAir, onAirChange]);

  // 마이크가 끝나면 · 글이 다 읽히면 — 최근 목록과 상태를 새로
  const wasText = useRef(false);
  useEffect(() => {
    if (wasText.current && !textMine) toast.success("방송을 마쳤어요");
    wasText.current = !!textMine;
    if (!micOn && !textMine) {
      setPlan(null);
      qc.invalidateQueries({ queryKey: ["teacher-now-recent"] });
      qc.invalidateQueries({ queryKey: ["teacher-now-status"] });
    }
  }, [micOn, textMine, qc]);

  useEffect(() => () => audio.current?.pause(), []);

  // 못 내보낸 글 [다시 보내기] — 같은 곳·같은 글로 채워 두고 위로. 종·다른 방송 검사를 다시 거쳐 직접 보낸다
  const retry = (r: NowItem) => {
    setMode("text");
    setText(r.text ?? "");
    const back = r.targets?.length ? r.targets : r.target ? [r.target] : [];
    if (back.length) setTargets(back);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const placeOf = (v: string) => QUICK.find((q) => q.value === v)?.label ?? spaces.find((s) => s.value === v)?.label ?? v;
  const placesOf = (vs: string[]) => joinPlaces(vs.map(placeOf));
  // 지도·목록에 올릴 스피커 — 시험 스피커는 지도에 없어서 따로 칩 (최고 관리자만 spaces 에 온다)
  const others = spaces.filter((s) => !QUICK.some((q) => q.value === s.value) && !isTestSpeaker(s.value));
  const otherNames = others.map((s) => s.value);
  const hasTest = spaces.some((s) => isTestSpeaker(s.value));
  const only = targets.length === 1 ? targets[0] : null;
  const testOn = only !== null && isTestSpeaker(only);
  const custom = targets.length > 0 && !testOn && !QUICK.some((q) => q.value === only);
  const customLabel = !custom ? "다른 곳" : targets.length === 1 ? placeOf(targets[0]) : `${placeOf(targets[0])} 외 ${targets.length - 1}곳`;
  const openSheet = () => {
    setDraft(custom ? targets : []);
    setSheet(true);
  };
  // [완료] — 지도 순서(반 → 나머지)로 맞춰 둔다. 다 뺐으면 직접 고른 것만 비운다(빠른 칩은 그대로)
  const applySheet = () => {
    const picked = otherNames.filter((n) => draft.includes(n));
    if (picked.length) setTargets(picked);
    else if (custom) setTargets([]);
    setSheet(false);
  };

  // 왜 못 켜는지 — 다른 방송 > 종 > 대상
  const bellLine =
    st?.bell && (
      <Why icon={<Bell size={19} />} text={`${st.bell.time} 종이 곧 울려요`} countdown={mmss((st.bell.at - serverNow) / 1000)} />
    );
  const why: ReactNode = (() => {
    if (!st) return null;
    if (st.busy && st.reason) return <Why icon={<Radio size={19} />} text={st.reason} />;
    if (mode === "mic" && st.micBlocked) return bellLine;
    if (mode === "text" && st.textSeconds !== null && (st.textSeconds < 3 || readSeconds(text) > st.textSeconds)) return bellLine;
    if (!targets.length) return <Why icon={<MapPin size={19} />} text="방송할 곳을 골라 주세요" />;
    return null;
  })();
  const blocked = why !== null;

  const listen = async () => {
    if (!text.trim()) return;
    setPlaying(true);
    try {
      const blob = await tapi<Blob>("/tts-preview", { method: "POST", body: JSON.stringify({ text: text.trim() }) });
      audio.current?.pause();
      audio.current = new Audio(URL.createObjectURL(blob));
      audio.current.onended = () => setPlaying(false);
      await audio.current.play();
    } catch (e) {
      toast.error((e as Error).message);
      setPlaying(false);
    }
  };

  const micState: OnairButtonState =
    live.state === "live" ? "active" : live.state === "connecting" || live.state === "stopping" ? "waiting" : blocked ? "disabled" : "idle";
  const pressMic = () => {
    if (live.state === "idle") {
      if (!blocked && targets.length) live.start({ targets });
    } else live.stop();
  };

  // ---------------- 방송 중 ----------------
  if (micOn) {
    const elapsed = live.startedAt ? (now - live.startedAt) / 1000 : 0;
    const left = plan ? (plan.endsAt - now) / 1000 : null;
    const warn =
      plan && left !== null && left <= plan.warn && live.state === "live"
        ? plan.cut === "bell"
          ? `${plan.bell ?? ""} 종이 울려서 ${mmss(left)} 뒤에 끝나요`
          : `15분이 다 돼서 ${mmss(left)} 뒤에 끝나요`
        : null;
    return (
      <Shell onRetry={retry} recent={recentQ.data?.items ?? []} dimRecent>
        <Glass className="flex flex-col gap-4 p-[18px] md:gap-5 md:p-6">
          <OnAirHead place={placesOf(targets)} what="마이크" />
          <div className="flex flex-col items-center">
            <OnairButton
              state={micState}
              label={live.state === "live" ? "끝내기" : live.state === "stopping" ? "마치는 중" : "준비 중"}
              caption={live.state === "connecting" ? "준비 중" : live.state === "stopping" ? "마치는 중" : undefined}
              onPress={pressMic}
            />
            {live.state === "live" && (
              <>
                <p className="mt-4 font-orbitron text-[48px] font-bold leading-none tabular-nums text-[#ff4d55] md:text-[56px]">{fmtClock(elapsed)}</p>
                <LevelMeter analyser={live.analyser} className="mt-4" barClassName="bg-white/85" />
              </>
            )}
          </div>
          {warn && <p className="text-center font-pretendard text-[15px] font-semibold text-white/80">{warn}</p>}
          <NeonButton tone="white" size="lg" icon={<Square />} className="w-full" disabled={live.state === "stopping"} onClick={live.stop}>
            끝내기
          </NeonButton>
        </Glass>
      </Shell>
    );
  }

  if (textMine || send.isPending) {
    const started = textMine ? textMine.startedAt - offset : null;
    const elapsed = started ? (now - started) / 1000 : 0;
    return (
      <Shell onRetry={retry} recent={recentQ.data?.items ?? []} dimRecent>
        <Glass className="flex flex-col gap-4 p-[18px] md:gap-5 md:p-6">
          <OnAirHead place={textMine?.place ?? placesOf(targets)} what="글" />
          <p className="text-center font-orbitron text-[48px] font-bold leading-none tabular-nums text-[#ff4d55] md:text-[56px]">
            {textMine ? fmtClock(elapsed) : "00:00"}
          </p>
          <p className="m-0 text-center font-pretendard text-[17px] font-medium leading-relaxed text-white/85 [text-wrap:pretty]">
            {textMine ? `"${textMine.text}"` : "소리를 만드는 중"}
          </p>
        </Glass>
      </Shell>
    );
  }

  // ---------------- 고르기 ----------------
  return (
    <Shell onRetry={retry} recent={recentQ.data?.items ?? []}>
      <Glass className="flex flex-col gap-4 p-[18px] md:gap-[18px] md:px-6 md:pb-6 md:pt-[22px]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-mbc text-[26px] text-white md:text-[28px]">방송</h2>
          <div className="w-[176px] md:w-[240px]">
            <Seg
              value={mode}
              onChange={setMode}
              options={[
                { value: "mic", label: <span className="inline-flex items-center justify-center gap-1.5"><Mic size={16} />마이크</span> },
                { value: "text", label: <span className="inline-flex items-center justify-center gap-1.5"><Type size={16} />글</span> },
              ]}
            />
          </div>
        </div>

        {/* 폰에서 옆으로 밀리는 칩 줄 — 오른쪽 끝을 흐리게 해 더 있다는 걸 보인다 */}
        <div className="-mr-[18px] flex gap-2 overflow-x-auto pr-[18px] [scrollbar-width:none] max-md:[mask-image:linear-gradient(to_right,#000_82%,transparent)] md:mr-0 md:flex-wrap md:overflow-visible md:pr-0">
          {QUICK.map((q) => {
            const grade = /^(\d)학년$/.exec(q.value);
            const off = !!grade && grades.length > 0 && !grades.includes(Number(grade[1]));
            return (
              <span key={q.value} className="shrink-0">
                <ChoiceChip on={only === q.value} disabled={off} onClick={() => setTargets([q.value])}>
                  {q.label}
                </ChoiceChip>
              </span>
            );
          })}
          <span className="shrink-0">
            <ChoiceChip on={custom} disabled={!others.length} onClick={openSheet}>
              {customLabel}
            </ChoiceChip>
          </span>
          {hasTest && (
            <span className="shrink-0">
              <ChoiceChip on={testOn} onClick={() => setTargets([TEST_SPEAKER_ID])}>
                {placeOf(TEST_SPEAKER_ID)}
              </ChoiceChip>
            </span>
          )}
        </div>
        <TargetSheet
          open={sheet}
          names={otherNames}
          selected={draft}
          onChange={setDraft}
          onClose={() => setSheet(false)}
          onDone={applySheet}
          title="다른 곳"
          ariaLabel="다른 곳 고르기"
          labelOf={placeOf}
        />

        {mode === "mic" ? (
          <>
            {why}
            <div className="flex justify-center py-2">
              <OnairButton state={micState} label="마이크 켜기" caption="마이크 켜기" onPress={pressMic} />
            </div>
          </>
        ) : (
          <>
            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, TEXT_MAX))}
                rows={4}
                placeholder="2학년 3반 학생들은 지금 바로 교실로 돌아와 주세요."
                className={cn(inputCls, "h-auto min-h-[112px] resize-none py-3 leading-relaxed md:min-h-[136px]")}
              />
              <span className="pointer-events-none absolute bottom-2.5 right-3.5 font-pretendard text-[12.5px] tabular-nums text-white/40">
                {text.length}/{TEXT_MAX}
              </span>
            </div>
            {why}
            <div className="flex gap-2.5">
              <NeonButton tone="white" size="lg" icon={<Play />} onClick={listen} disabled={!text.trim() || playing} className="shrink-0">
                {playing ? "듣는 중" : "들어 보기"}
              </NeonButton>
              <NeonButton
                size="lg"
                icon={<Send />}
                className="min-w-0 flex-1"
                disabled={blocked || !text.trim() || send.isPending}
                onClick={() => send.mutate()}
              >
                바로 내보내기
              </NeonButton>
            </div>
          </>
        )}
      </Glass>
    </Shell>
  );
}

/** PC 는 왼쪽 바로 방송 · 오른쪽 최근, 폰은 위아래 */
function Shell({
  children,
  recent,
  dimRecent,
  onRetry,
}: {
  children: ReactNode;
  recent: NowItem[];
  dimRecent?: boolean;
  onRetry: (r: NowItem) => void;
}) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      {children}
      <Recent
        items={recent}
        onRetry={onRetry}
        className={cn("transition-opacity", dimRecent && "pointer-events-none opacity-35")}
      />
    </div>
  );
}
