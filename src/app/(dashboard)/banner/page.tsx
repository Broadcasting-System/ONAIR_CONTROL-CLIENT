"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SectionHeader from "@/components/common/SectionHeader";
import { cn } from "@/lib/utils";
import { useFiles } from "@/hooks/useFiles";
import { UploadedFile } from "@/types/file";
import {
  BannerScene,
  ScoreboardPayload,
  ImagePayload,
  GifPayload,
  ScoreAnim,
  SCORE_ANIM_OPTIONS,
  updateBanner,
  clearBanner,
  fetchBannerState,
  fetchBannerStatus,
  getDisplayPreviewUrl,
} from "@/lib/bannerApi";

const SCENES: { key: BannerScene; label: string; sub: string }[] = [
  { key: "scoreboard", label: "점수보드", sub: "SCORE" },
  { key: "image", label: "이미지", sub: "IMAGE" },
  { key: "gif", label: "GIF", sub: "GIF" },
  { key: "blank", label: "끄기", sub: "OFF" },
];

const DEFAULT_SCOREBOARD: ScoreboardPayload = {
  title: "2학년 빅발리볼 3위 결정전",
  subtitle: "2반 VS 4반",
  titleSize: 160,
  subtitleSize: 76,
  showSet: true,
  targetScore: 25,
  scoreAnim: "slamshine",
  victory: null,
  courtChange: null,
  teamA: { name: "2반", score: 0, set: 0 },
  teamB: { name: "4반", score: 0, set: 0 },
};

export default function BannerPage() {
  const [scene, setScene] = useState<BannerScene>("scoreboard");
  const [scoreboard, setScoreboard] =
    useState<ScoreboardPayload>(DEFAULT_SCOREBOARD);
  const [image, setImage] = useState<ImagePayload>({ url: "", fit: "cover" });
  const [gif, setGif] = useState<GifPayload>({ url: "" });
  const [displays, setDisplays] = useState(0);

  const { files, fetchFiles } = useFiles();
  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const previewUrl = useMemo(() => getDisplayPreviewUrl(), []);
  const didInit = useRef(false);

  // ---- 초기 상태 동기화 ----
  useEffect(() => {
    fetchBannerState().then((s) => {
      if (!s) {
        didInit.current = true;
        return;
      }
      setScene(s.scene);
      if (s.scene === "scoreboard") {
        const p = (s.payload ?? {}) as Partial<ScoreboardPayload>;
        setScoreboard({
          ...DEFAULT_SCOREBOARD,
          ...p,
          // 팀은 깊은 병합 — 옛 데이터에 set이 없으면 0으로 채움
          teamA: { score: 0, set: 0, ...(p.teamA ?? {}) },
          teamB: { score: 0, set: 0, ...(p.teamB ?? {}) },
        });
      }
      if (s.scene === "image")
        setImage({ fit: "cover", ...(s.payload as object) } as ImagePayload);
      if (s.scene === "gif") setGif(s.payload as unknown as GifPayload);
      didInit.current = true;
    });
  }, []);

  // ---- LIVE 폴링 ----
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const st = await fetchBannerStatus();
      if (alive && st) setDisplays(st.displays);
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // ---- 현재 scene의 payload ----
  const payload = useMemo<Record<string, unknown>>(() => {
    switch (scene) {
      case "scoreboard":
        return scoreboard as unknown as Record<string, unknown>;
      case "image":
        return image as unknown as Record<string, unknown>;
      case "gif":
        return gif as unknown as Record<string, unknown>;
      default:
        return {};
    }
  }, [scene, scoreboard, image, gif]);

  // ---- 변경 시 디바운스 송출 ----
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => {
    if (!didInit.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateBanner(scene, payload).catch((e) =>
        console.error("송출 실패", e),
      );
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [scene, payload]);

  const sendNow = useCallback(
    (s: BannerScene, p: Record<string, unknown>) => {
      updateBanner(s, p).catch((e) => console.error("송출 실패", e));
    },
    [],
  );

  return (
    <div className="flex h-full w-full flex-col gap-6 px-[20px]">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <SectionHeader className="mb-0">현수막 송출</SectionHeader>
        <LiveBadge displays={displays} />
      </div>

      {/* scene 탭 */}
      <div className="flex gap-3">
        {SCENES.map((s) => (
          <button
            key={s.key}
            onClick={() => setScene(s.key)}
            className={cn(
              "flex flex-col items-start rounded-2xl border px-6 py-3 transition-all",
              scene === s.key
                ? "border-white/20 bg-white/10 shadow-[0_0_15px_-5px_rgba(255,255,255,0.2)]"
                : "border-white/5 bg-[#0a0a0a] hover:bg-white/5",
            )}
          >
            <span className="font-mbc text-lg leading-none text-white">
              {s.label}
            </span>
            <span className="font-orbitron text-[11px] uppercase tracking-widest text-white/30">
              {s.sub}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-1 gap-8 overflow-hidden">
        {/* 좌측: 컨트롤 */}
        <div className="w-[460px] shrink-0 overflow-auto">
          {scene === "scoreboard" && (
            <ScoreboardEditor
              value={scoreboard}
              onChange={setScoreboard}
              onScore={(next) => {
                setScoreboard(next);
                sendNow("scoreboard", next as unknown as Record<string, unknown>);
              }}
            />
          )}
          {scene === "image" && (
            <ImageEditor
              value={image}
              onChange={setImage}
              images={files.image ?? []}
            />
          )}
          {scene === "gif" && (
            <GifEditor
              value={gif}
              onChange={setGif}
              gifs={files.image ?? []}
            />
          )}
          {scene === "blank" && (
            <div className="rounded-3xl border border-white/5 bg-[#0a0a0a] p-8">
              <p className="font-pretendard text-white/50">
                송출이 꺼진 상태(검은 화면)입니다. 다른 탭을 선택해 콘텐츠를
                내보내세요.
              </p>
              <button
                onClick={() => clearBanner()}
                className="mt-4 rounded-xl border border-white/10 bg-white/5 px-5 py-2 font-mbc text-white hover:bg-white/10"
              >
                지금 끄기
              </button>
            </div>
          )}
        </div>

        {/* 우측: 미리보기 */}
        <div className="flex flex-1 flex-col gap-3 overflow-hidden">
          <span className="font-orbitron text-[11px] uppercase tracking-widest text-white/30">
            Preview · 6845 × 552 (12.4:1)
          </span>
          <div className="rounded-2xl border border-white/10 bg-black p-2">
            <div
              className="relative w-full overflow-hidden rounded-lg bg-black"
              style={{ aspectRatio: "6845 / 552" }}
            >
              <iframe
                src={previewUrl}
                title="banner preview"
                className="absolute inset-0 h-full w-full border-0"
              />
            </div>
          </div>
          <p className="font-pretendard text-xs text-white/30">
            미리보기는 송출 페이지를 그대로 렌더링합니다. 실제 현수막에서는 이
            비율이 가로로 늘어나 정상으로 보입니다.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- LIVE 배지 ---------------- */
function LiveBadge({ displays }: { displays: number }) {
  const live = displays > 0;
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border px-4 py-1.5",
        live
          ? "border-green-500/40 bg-green-500/10"
          : "border-white/10 bg-white/5",
      )}
    >
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full",
          live ? "animate-pulse bg-green-400" : "bg-white/30",
        )}
      />
      <span className="font-orbitron text-xs uppercase tracking-wider text-white/70">
        {live ? `LIVE · ${displays}` : "OFFLINE"}
      </span>
    </div>
  );
}

/* ---------------- 점수보드 에디터 ---------------- */
function ScoreboardEditor({
  value,
  onChange,
  onScore,
}: {
  value: ScoreboardPayload;
  onChange: (v: ScoreboardPayload) => void;
  onScore: (v: ScoreboardPayload) => void;
}) {
  const setField = (patch: Partial<ScoreboardPayload>) =>
    onChange({ ...value, ...patch });

  const bump = (
    team: "teamA" | "teamB",
    field: "score" | "set",
    delta: number,
  ) => {
    const cap = field === "score" ? 99 : 9;
    const cur = Number.isFinite(value[team][field]) ? value[team][field] : 0;
    const next = {
      ...value,
      [team]: {
        ...value[team],
        [field]: Math.max(0, Math.min(cap, cur + delta)),
      },
    };
    onScore(next);
  };

  const setName = (team: "teamA" | "teamB", name: string) =>
    onChange({ ...value, [team]: { ...value[team], name } });

  const declareVictory = (side: "left" | "right") =>
    onScore({
      ...value,
      victory: {
        side,
        name: side === "left" ? value.teamA.name : value.teamB.name,
        at: Date.now(),
      },
    });
  const clearVictory = () => onScore({ ...value, victory: null });

  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-white/5 bg-[#0a0a0a] p-6">
      <Field label="제목">
        <TextInput
          value={value.title}
          onChange={(t) => setField({ title: t })}
          placeholder="예: 2학년 빅발리볼 3위 결정전"
        />
      </Field>
      <SliderField
        label={`제목 크기 (${value.titleSize}px)`}
        value={value.titleSize}
        min={80}
        max={260}
        onChange={(n) => setField({ titleSize: n })}
      />
      {/* 부제목(VS)은 아래 팀 이름 두 개로 자동 구성됩니다 */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="부제목 왼쪽 팀">
          <TextInput
            value={value.teamA.name ?? ""}
            onChange={(t) => setName("teamA", t)}
            placeholder="예: 2반"
          />
        </Field>
        <Field label="부제목 오른쪽 팀">
          <TextInput
            value={value.teamB.name ?? ""}
            onChange={(t) => setName("teamB", t)}
            placeholder="예: 4반"
          />
        </Field>
      </div>
      <p className="-mt-2 font-pretendard text-xs text-white/30">
        부제목은 「왼쪽 팀 VS 오른쪽 팀」으로 표시되며 코트 체인지 시 좌우가 바뀝니다.
      </p>
      <SliderField
        label={`부제목 크기 (${value.subtitleSize}px)`}
        value={value.subtitleSize}
        min={40}
        max={160}
        onChange={(n) => setField({ subtitleSize: n })}
      />

      <div className="h-px bg-white/5" />

      {/* 세트 스코어 표시 토글 */}
      <label className="flex items-center justify-between">
        <span className="font-mbc text-white/80">세트 스코어 표시</span>
        <button
          onClick={() => setField({ showSet: !value.showSet })}
          className={cn(
            "relative h-7 w-12 rounded-full transition-colors",
            value.showSet ? "bg-green-500/70" : "bg-white/10",
          )}
        >
          <span
            className={cn(
              "absolute top-1 h-5 w-5 rounded-full bg-white transition-all",
              value.showSet ? "left-6" : "left-1",
            )}
          />
        </button>
      </label>

      {/* 목표 점수 (매치포인트/듀스 판정) */}
      <label className="flex items-center justify-between">
        <span className="font-mbc text-white/80">목표 점수</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={2}
            max={99}
            value={value.targetScore}
            onChange={(e) =>
              setField({
                targetScore: Math.max(2, Math.min(99, Number(e.target.value) || 0)),
              })
            }
            className="w-20 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-center font-orbitron text-white focus:border-white/30 focus:outline-none"
          />
          <span className="font-pretendard text-sm text-white/40">점</span>
        </div>
      </label>
      <p className="-mt-2 font-pretendard text-xs text-white/30">
        목표 점수 기준으로 매치포인트·듀스가 자동 표시됩니다 (2점차 승리 규칙).
      </p>

      <TeamControl
        title="왼쪽 팀"
        team={value.teamA}
        showSet={value.showSet}
        onBump={(f, d) => bump("teamA", f, d)}
      />
      <TeamControl
        title="오른쪽 팀"
        team={value.teamB}
        showSet={value.showSet}
        onBump={(f, d) => bump("teamB", f, d)}
      />

      <div className="mt-1 flex gap-2">
        <button
          onClick={() => {
            const reset = {
              ...value,
              teamA: { ...value.teamA, score: 0 },
              teamB: { ...value.teamB, score: 0 },
            };
            onScore(reset);
          }}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-mbc text-sm text-white/70 hover:bg-white/10"
        >
          메인 점수 0:0 리셋
        </button>
        <button
          onClick={() => {
            // 코트 체인지: 양 팀 좌우 전체 교체 (이름·메인·세트) + 전용 애니메이션 트리거
            const swapped = {
              ...value,
              teamA: value.teamB,
              teamB: value.teamA,
              courtChange: { at: Date.now() },
            };
            onScore(swapped);
          }}
          className="flex-1 rounded-xl border border-sky-400/40 bg-sky-400/10 px-4 py-2 font-mbc text-sm text-sky-200 hover:bg-sky-400/20"
        >
          ⇄ 코트 체인지
        </button>
      </div>

      <div className="h-px bg-white/5" />

      {/* 득점 애니메이션 (승리 WIN은 항상 임팩트+샤인) */}
      <Field label="득점 애니메이션 (승리 WIN은 임팩트+샤인 고정)">
        <AnimSelect
          options={SCORE_ANIM_OPTIONS}
          value={value.scoreAnim}
          onChange={(k) => setField({ scoreAnim: k as ScoreAnim })}
        />
      </Field>

      {/* 승리 선언 */}
      <Field label="승리 선언">
        <div className="flex gap-2">
          <button
            onClick={() => declareVictory("left")}
            className="flex-1 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 font-mbc text-sm text-yellow-200 hover:bg-yellow-500/20"
          >
            {value.teamA.name || "왼쪽"} 승리
          </button>
          <button
            onClick={() => declareVictory("right")}
            className="flex-1 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 font-mbc text-sm text-yellow-200 hover:bg-yellow-500/20"
          >
            {value.teamB.name || "오른쪽"} 승리
          </button>
          <button
            onClick={clearVictory}
            className={cn(
              "rounded-xl border px-3 py-2 font-mbc text-sm transition-colors",
              value.victory
                ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
                : "border-white/5 bg-white/[0.02] text-white/30",
            )}
          >
            해제
          </button>
        </div>
      </Field>
    </div>
  );
}

/* 애니메이션 선택 버튼 그룹 */
function AnimSelect({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-xl border px-3 py-2 font-mbc text-sm transition-all",
            value === o.key
              ? "border-white/20 bg-white/10 text-white"
              : "border-white/5 bg-white/[0.02] text-white/40 hover:bg-white/5",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TeamControl({
  title,
  team,
  showSet,
  onBump,
}: {
  title: string;
  team: { score: number; set: number };
  showSet: boolean;
  onBump: (field: "score" | "set", delta: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="font-orbitron text-[11px] uppercase tracking-widest text-white/30">
        {title}
      </span>
      <div className="flex items-center gap-6">
        <ScoreStepper
          label="메인"
          value={team.score}
          pad={2}
          onBump={(d) => onBump("score", d)}
        />
        {showSet && (
          <ScoreStepper
            label="세트"
            value={team.set}
            pad={1}
            onBump={(d) => onBump("set", d)}
          />
        )}
      </div>
    </div>
  );
}

function ScoreStepper({
  label,
  value,
  pad,
  onBump,
}: {
  label: string;
  value: number;
  pad: number;
  onBump: (d: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-pretendard text-[11px] text-white/40">{label}</span>
      <div className="flex items-center gap-2">
        <StepBtn onClick={() => onBump(-1)}>−</StepBtn>
        <span className="w-14 text-center font-orbitron text-3xl font-bold text-white">
          {String(value).padStart(pad, "0")}
        </span>
        <StepBtn onClick={() => onBump(1)} primary>
          +
        </StepBtn>
      </div>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-orbitron text-[11px] uppercase tracking-widest text-white/30">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-green-400"
      />
    </label>
  );
}

function StepBtn({
  children,
  onClick,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-xl border text-2xl font-bold transition-all active:scale-95",
        primary
          ? "border-green-500/40 bg-green-500/15 text-green-300 hover:bg-green-500/25"
          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}

/* ---------------- 이미지 / GIF 에디터 ---------------- */
function ImageEditor({
  value,
  onChange,
  images,
}: {
  value: ImagePayload;
  onChange: (v: ImagePayload) => void;
  images: UploadedFile[];
}) {
  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-white/5 bg-[#0a0a0a] p-6">
      <Field label="등록된 이미지에서 선택">
        <ImagePicker
          files={images}
          activeUrl={value.url}
          onPick={(url) => onChange({ ...value, url })}
        />
      </Field>
      <Field label="또는 이미지 URL 직접 입력 (6845×552 권장)">
        <TextInput
          value={value.url}
          onChange={(url) => onChange({ ...value, url })}
          placeholder="https://… 또는 /uploads/…"
        />
      </Field>
      <Field label="맞춤 방식">
        <div className="flex gap-2">
          {(["cover", "contain"] as const).map((fit) => (
            <button
              key={fit}
              onClick={() => onChange({ ...value, fit })}
              className={cn(
                "rounded-xl border px-4 py-2 font-mbc text-sm transition-all",
                value.fit === fit
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-white/5 bg-white/[0.02] text-white/40 hover:bg-white/5",
              )}
            >
              {fit === "cover" ? "꽉 채움 (cover)" : "전체 표시 (contain)"}
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

function GifEditor({
  value,
  onChange,
  gifs,
}: {
  value: GifPayload;
  onChange: (v: GifPayload) => void;
  gifs: UploadedFile[];
}) {
  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-white/5 bg-[#0a0a0a] p-6">
      <Field label="등록된 이미지/GIF에서 선택">
        <ImagePicker
          files={gifs}
          activeUrl={value.url}
          onPick={(url) => onChange({ url })}
        />
      </Field>
      <Field label="또는 GIF URL 직접 입력">
        <TextInput
          value={value.url}
          onChange={(url) => onChange({ url })}
          placeholder="https://… .gif"
        />
      </Field>
    </div>
  );
}

/* 업로드된 이미지 썸네일 선택 */
function ImagePicker({
  files,
  activeUrl,
  onPick,
}: {
  files: UploadedFile[];
  activeUrl?: string;
  onPick: (url: string) => void;
}) {
  if (files.length === 0) {
    return (
      <p className="rounded-xl border border-white/5 bg-white/[0.02] p-4 font-pretendard text-sm text-white/30">
        등록된 이미지가 없습니다. 파일 관리에서 업로드하세요.
      </p>
    );
  }
  return (
    <div className="grid max-h-[220px] grid-cols-4 gap-2 overflow-auto rounded-xl border border-white/5 bg-white/[0.02] p-2">
      {files.map((f) => {
        const active = activeUrl === f.fileUrl;
        return (
          <button
            key={f.id}
            onClick={() => onPick(f.fileUrl)}
            title={f.fileName}
            className={cn(
              "overflow-hidden rounded-lg border transition-all",
              active
                ? "border-white/40 ring-1 ring-white/40"
                : "border-white/10 hover:border-white/30",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={f.thumbnailUrl || f.fileUrl}
              alt={f.fileName}
              className="h-16 w-full bg-black object-cover"
            />
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- 공용 인풋 ---------------- */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-orbitron text-[11px] uppercase tracking-widest text-white/30">
        {label}
      </span>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 font-pretendard text-white placeholder:text-white/20 focus:border-white/30 focus:outline-none",
        className,
      )}
    />
  );
}
