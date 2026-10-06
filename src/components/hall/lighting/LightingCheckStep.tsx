"use client";

import { useState, type ReactNode } from "react";
import { Check, Eraser, Power, PowerOff, Save, Sun } from "lucide-react";
import ConfirmModal from "@/components/common/ConfirmModal";
import { toast } from "@/components/common/Toast";
import { ActionButton, Card } from "@/components/hall/setup/ui";
import { lightingApi } from "@/lib/lightingApi";
import { cn } from "@/lib/utils";
import type { CaptureResult, LightingState } from "@/types/lighting";
import { type FixtureRow, coveredAddrs, overlapPairs, rangesText } from "./fixtureDraft";

type Tone = "ok" | "bad" | "off";

/** ③ 확인 — 전체 켜기·끄기로 모든 조명이 따라오는지 보고, 저장하고 조명 화면으로 간다 */
export default function LightingCheckStep({
  hallId,
  hallName,
  state,
  rows,
  dirty,
  capture,
  clearLight,
  onFinish,
  finishing,
  onRemoved,
}: {
  hallId: string;
  hallName: string;
  state: LightingState;
  rows: FixtureRow[];
  dirty: boolean;
  capture: CaptureResult | null;
  clearLight: () => Promise<unknown>;
  onFinish: () => void;
  finishing: boolean;
  onRemoved: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const types = state.types;
  const configured = state.configured;
  const mock = state.connection?.driver === "mock";

  const overlaps = overlapPairs(rows, types);
  const covered = coveredAddrs(rows, types);
  const missing = capture ? capture.used.map((u) => u.address).filter((a) => !covered.has(a)) : [];

  const conn: { tone: Tone; text: string } = !configured
    ? { tone: "bad", text: "아직 연결을 저장하지 않았어요 — ① 연결에서 저장하세요" }
    : !state.connected
      ? { tone: "bad", text: `조명에 연결되지 않았어요 — ${state.detail}` }
      : mock
        ? { tone: "off", text: "모의 장비 — 실제 조명은 바뀌지 않아요" }
        : { tone: "ok", text: `연결됨 · ${state.detail}` };

  const list: { tone: Tone; text: string } =
    rows.length === 0
      ? { tone: "bad", text: "조명 목록이 비어 있어요 — ② 에서 조명을 넣으세요" }
      : {
          tone: overlaps.length ? "bad" : "ok",
          text:
            `조명 ${rows.length}개 · ` +
            (overlaps.length ? `주소 겹침 ${overlaps.length}곳 (같은 조광기에 묶였으면 괜찮아요)` : "주소 겹침 없음") +
            (dirty ? " · 저장 안 한 변경이 있어요" : ""),
        };

  const consoleCheck: { tone: Tone; text: string } = !capture
    ? { tone: "off", text: "콘솔 신호를 아직 읽지 않았어요 — ② 에서 ‘콘솔 신호 읽기’를 하면 빠진 조명을 찾아 줘요" }
    : missing.length
      ? { tone: "bad", text: `콘솔이 쓰는 주소 중 목록에 없는 것: ${rangesText(missing)}` }
      : { tone: "ok", text: "콘솔이 쓰는 주소가 모두 목록에 있어요" };

  const act = async (key: string, job: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await job();
      toast.success(done);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  // 목록을 저장해야 새 조명까지 켜진다
  const needSave = dirty ? "저장한 뒤 켜 볼 수 있어요" : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Card title="확인" hint="전체 켜기·끄기로 모든 조명이 따라오는지 보세요. 문제가 없으면 저장하고 조명 화면으로 가요.">
        <div className="flex flex-col gap-2">
          <CheckRow tone={conn.tone}>{conn.text}</CheckRow>
          <CheckRow tone={list.tone}>{list.text}</CheckRow>
          <CheckRow tone={consoleCheck.tone}>{consoleCheck.text}</CheckRow>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ActionButton
            icon={<Sun size={15} />}
            busy={busy === "on"}
            disabled={!configured || rows.length === 0 || dirty}
            title={needSave}
            onClick={() => act("on", () => lightingApi.set(hallId, { intensity: 100 }), "모든 조명을 켰습니다.")}
          >
            전체 켜기
          </ActionButton>
          <ActionButton
            icon={<PowerOff size={15} />}
            busy={busy === "off"}
            disabled={!configured || rows.length === 0 || dirty}
            title={needSave}
            onClick={() => act("off", () => lightingApi.set(hallId, { intensity: 0 }), "모든 조명을 껐습니다.")}
          >
            전체 끄기
          </ActionButton>
          <ActionButton
            tone="ghost"
            icon={<Eraser size={14} />}
            busy={busy === "clear"}
            disabled={!configured}
            onClick={() => act("clear", clearLight, "켜 보기로 켠 시험 값을 모두 해제했습니다.")}
          >
            시험 값 모두 해제
          </ActionButton>
          <ActionButton
            tone="primary"
            icon={dirty ? <Save size={15} /> : <Check size={15} />}
            busy={finishing}
            disabled={!configured && rows.length === 0}
            onClick={onFinish}
            className="ml-auto"
          >
            {dirty ? "저장하고 조명 화면으로" : "조명 화면으로"}
          </ActionButton>
        </div>
        {dirty && (
          <p className="-mt-1 font-pretendard text-xs text-amber-200/70">
            표를 고친 게 아직 저장되지 않았어요. 전체 켜기·끄기는 저장한 목록으로 해요.
          </p>
        )}
      </Card>

      {configured && (
        <Card
          title="이 공간 조명 끄기"
          hint={`${hallName}의 조명 설정(연결·목록·장면)을 없애요. 조명 메뉴에서 ${hallName}이 사라져요. 서버에 백업 파일은 남아요.`}
          className="border-red-500/20"
          action={
            <ActionButton
              icon={<Power size={14} />}
              onClick={() => setConfirmRemove(true)}
              className="border-red-500/40 text-red-300 enabled:hover:bg-red-500/15"
            >
              조명 끄기
            </ActionButton>
          }
        >
          {null}
        </Card>
      )}

      <ConfirmModal
        isOpen={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={async () => {
          try {
            await lightingApi.remove(hallId);
            toast.success(`${hallName}의 조명 설정을 없앴습니다.`);
            onRemoved();
          } catch (e) {
            toast.error((e as Error).message);
            throw e;
          }
        }}
        title="이 공간 조명 끄기"
        message={`${hallName}의 조명 연결·조명 목록·장면이 모두 사라집니다.\n다시 쓰려면 ① 연결부터 다시 저장해야 해요. 정말 끌까요?`}
        confirmText="조명 끄기"
      />
    </div>
  );
}

function CheckRow({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-black/35 px-4 py-2.5 font-pretendard text-sm text-white/80">
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs",
          tone === "ok" && "bg-[#00FF57]/15 text-[#00FF57]",
          tone === "bad" && "bg-[#FFD600]/15 text-[#FFD600]",
          tone === "off" && "bg-white/10 text-white/45",
        )}
      >
        {tone === "ok" ? <Check size={12} strokeWidth={3} /> : tone === "bad" ? "!" : "–"}
      </span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}
