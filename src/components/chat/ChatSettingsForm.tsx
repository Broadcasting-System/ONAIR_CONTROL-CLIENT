"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { OnSwitch } from "@/components/hall/AutoAudio";
import { chatApi } from "@/lib/chatApi";
import { cn } from "@/lib/utils";
import Select from "@/components/common/Select";
import type { ChatSettingsUpdate, ChatStatus, ChatTestResult } from "@/types/chat";

const MODEL_LABEL: Record<string, string> = {
  "claude-sonnet-5-5": "Sonnet 5.5 (기본)",
  "claude-opus-5-5": "Opus 5.5 (똑똑함 · 비쌈)",
  "claude-haiku-4-5-20251001": "Haiku 4.5 (빠름 · 저렴)",
};

const field =
  "h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 font-pretendard text-[14px] text-white outline-none placeholder:text-white/30 focus:border-white/30";

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-pretendard text-[13px] font-semibold text-white/70">{label}</span>
      {children}
      {hint && <span className="font-pretendard text-[12px] text-white/50">{hint}</span>}
    </label>
  );
}

/** CUE 설정 (최고 관리자) — 키는 쓰기만 하고 다시 보여 주지 않는다 */
export default function ChatSettingsForm({ status }: { status?: ChatStatus }) {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["chat", "settings"], queryFn: chatApi.settings });
  const s = settings.data;

  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [daily, setDaily] = useState("");
  const [perUser, setPerUser] = useState("");
  const [clearArmed, setClearArmed] = useState(false);
  const [test, setTest] = useState<ChatTestResult | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    if (!s) return;
    setModel(s.model);
    setEnabled(s.enabled);
    setDaily(String(s.dailyRequestLimit));
    setPerUser(String(s.userDailyLimit));
  }, [s]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["chat"] });
  };

  const save = useMutation({
    mutationFn: (body: ChatSettingsUpdate) => chatApi.saveSettings(body),
    onSuccess: (next, body) => {
      qc.setQueryData(["chat", "settings"], next);
      setApiKey("");
      setClearArmed(false);
      setTest(null);
      setMsg({ text: body.apiKey === null ? "키를 지웠어요." : "저장했어요." });
      refresh();
    },
    onError: (e) => setMsg({ text: e instanceof Error ? e.message : "저장하지 못했어요.", error: true }),
  });

  const runTest = useMutation({
    mutationFn: chatApi.testSettings,
    onSuccess: (r) => setTest(r),
    onError: (e) => setTest({ ok: false, model, message: e instanceof Error ? e.message : "확인하지 못했어요." }),
  });

  if (settings.isLoading) {
    return <p className="font-pretendard text-[14px] text-white/50">설정 불러오는 중…</p>;
  }
  if (!s) {
    return (
      <p className="font-pretendard text-[14px] text-white/60">
        설정을 불러오지 못했어요. {settings.error instanceof Error ? settings.error.message : ""}
      </p>
    );
  }

  const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
  const submit = () => {
    setMsg(null);
    const body: ChatSettingsUpdate = {};
    if (apiKey.trim()) body.apiKey = apiKey.trim();
    if (model && model !== s.model) body.model = model;
    if (enabled !== s.enabled) body.enabled = enabled;
    if (num(daily) !== s.dailyRequestLimit) body.dailyRequestLimit = num(daily);
    if (num(perUser) !== s.userDailyLimit) body.userDailyLimit = num(perUser);
    if (!Object.keys(body).length) {
      setMsg({ text: "바뀐 게 없어요." });
      return;
    }
    save.mutate(body);
  };

  const usage = status?.usage?.today;

  return (
    <div className="flex flex-col gap-5">
      <Row
        label="Claude API 키"
        hint={s.keySet ? `저장된 키 ${s.keyHint ?? ""} · 새 키를 넣으면 바뀌어요` : "console.anthropic.com 에서 만든 키를 넣어 주세요"}
      >
        <div className="flex gap-2">
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={s.keySet ? "새 키로 바꾸기" : "sk-ant-…"}
            className={field}
          />
          {s.keySet && (
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => (clearArmed ? save.mutate({ apiKey: null }) : setClearArmed(true))}
              className={cn(
                "h-10 shrink-0 rounded-lg border px-3 font-pretendard text-[13px] transition-colors disabled:opacity-50",
                clearArmed
                  ? "border-[#FF3B3B] bg-[#FF3B3B] text-white"
                  : "border-white/10 text-white/60 hover:bg-white/[0.06] hover:text-white",
              )}
            >
              {clearArmed ? "정말 지우기" : "키 지우기"}
            </button>
          )}
        </div>
      </Row>

      <Row label="모델">
        <Select
          value={model}
          onChange={setModel}
          options={(s.models?.length ? s.models : [s.model]).map((m) => {
            const id = typeof m === "string" ? m : m.id;
            const label = typeof m === "string" ? undefined : m.label;
            return { value: id, label: label ?? MODEL_LABEL[id] ?? id };
          })}
          className={field}
        />
      </Row>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-pretendard text-[13px] font-semibold text-white/70">CUE 켜기</p>
          <p className="font-pretendard text-[12px] text-white/50">끄면 키가 있어도 아무도 못 써요</p>
        </div>
        <OnSwitch checked={enabled} onChange={setEnabled} label="CUE 켜기" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Row label="하루 전체 요청" hint="서버 전체">
          <input inputMode="numeric" value={daily} onChange={(e) => setDaily(e.target.value.replace(/\D/g, ""))} className={field} />
        </Row>
        <Row label="한 사람 하루 요청" hint="사람마다">
          <input
            inputMode="numeric"
            value={perUser}
            onChange={(e) => setPerUser(e.target.value.replace(/\D/g, ""))}
            className={field}
          />
        </Row>
      </div>

      {usage && (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 font-pretendard text-[13px] text-white/60">
          <p className="mb-1 font-semibold text-white/75">오늘 쓴 양</p>
          <p className="tabular-nums">
            요청 {usage.requests.toLocaleString()}
            {status?.limits?.daily ? ` / ${status.limits.daily.toLocaleString()}` : ""}회 · 입력{" "}
            {usage.inputTokens.toLocaleString()} · 출력 {usage.outputTokens.toLocaleString()} 토큰
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={save.isPending}
          className="flex h-10 items-center gap-1.5 rounded-lg border border-white/20 bg-white px-4 font-pretendard text-[14px] font-semibold text-black transition-colors enabled:hover:bg-white/85 disabled:opacity-50"
        >
          {save.isPending && <Loader2 size={14} className="animate-spin" />}
          저장
        </button>
        <button
          type="button"
          onClick={() => {
            setTest(null);
            runTest.mutate();
          }}
          disabled={runTest.isPending || !s.keySet}
          title={s.keySet ? undefined : "키를 먼저 저장해 주세요"}
          className="flex h-10 items-center gap-1.5 rounded-lg border border-white/10 px-4 font-pretendard text-[14px] text-white/75 transition-colors enabled:hover:bg-white/[0.06] enabled:hover:text-white disabled:opacity-40"
        >
          {runTest.isPending && <Loader2 size={14} className="animate-spin" />}
          연결 확인
        </button>
      </div>

      {msg && (
        <p className={cn("font-pretendard text-[13px]", msg.error ? "text-[#FF6B6B]" : "text-white/70")}>{msg.text}</p>
      )}
      {test && (
        <p className={cn("font-pretendard text-[13px]", test.ok ? "text-white/80" : "text-[#FF6B6B]")}>
          {test.ok ? "연결됐어요" : "연결 안 됨"} · {MODEL_LABEL[test.model] ?? test.model} — {test.message}
        </p>
      )}
    </div>
  );
}
