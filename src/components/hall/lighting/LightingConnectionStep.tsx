"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, RefreshCw, RotateCcw, Save } from "lucide-react";
import { toast } from "@/components/common/Toast";
import { Notice } from "@/components/hall/HallControls";
import NotebookPicker from "@/components/hall/setup/NotebookPicker";
import { ActionButton, Badge, Card, Field, OptionCard, Switch, badBorder, inputCls, okBorder } from "@/components/hall/setup/ui";
import { hallApi } from "@/lib/hallApi";
import { lightingApi } from "@/lib/lightingApi";
import { cn } from "@/lib/utils";
import type { SerialPortInfo } from "@/types/hall";
import type { DmxInterface, LightingConnection, LightingState } from "@/types/lighting";

const URL_RE = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?\/?$/;

/** 화면에서 고르는 방식 — 조명 노드 / USB-DMX 케이블(보험) / 모의 장비 */
type Kind = "esp32" | "opendmx" | "mock";

interface Form {
  kind: Kind;
  bridgeUrl: string;
  port: string;
  inputPort: string;
  virtual: boolean;
}

function toForm(c?: LightingConnection): Form {
  if (!c) return { kind: "esp32", bridgeUrl: "", port: "", inputPort: "", virtual: false };
  const kind: Kind = c.driver === "mock" ? "mock" : c.interface === "esp32" ? "esp32" : "opendmx";
  return { kind, bridgeUrl: c.bridgeUrl, port: c.port, inputPort: c.inputPort, virtual: c.virtual };
}

const same = (a: Form, b: Form) => JSON.stringify(a) === JSON.stringify(b);

/** 칩 이름으로 어느 장치인지 짐작 — ESP32 보드는 CP210x·CH340, USB-DMX 케이블은 FTDI */
function portGuess(p: SerialPortInfo): string {
  const chip = (p.chip || "").toUpperCase();
  if (chip.includes("CP210") || chip.includes("CH340")) return "조명 노드(ESP32) 같아요";
  if (chip.includes("FTDI")) return "USB-DMX 케이블 같아요";
  return "";
}

/** ① 연결 — 강당 노트북에 꽂은 조명 장치와 COM 포트를 고른다. 저장하면 이 공간에 조명이 켜진다 */
export default function LightingConnectionStep({
  hallId,
  hallName,
  state,
  onSaved,
  onNext,
}: {
  hallId: string;
  hallName: string;
  state: LightingState;
  onSaved: () => void;
  onNext: () => void;
}) {
  const qc = useQueryClient();
  const saved = toForm(state.configured ? state.connection : undefined);
  const [form, setForm] = useState<Form>(saved);
  const [ports, setPorts] = useState<SerialPortInfo[] | null>(null);
  const [portsBusy, setPortsBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const bridge = form.kind !== "mock";
  const url = form.bridgeUrl.trim().replace(/\/$/, "");
  const urlBad = bridge && !URL_RE.test(url);
  const portMissing = bridge && !form.virtual && !form.port;
  const samePort = form.kind === "opendmx" && !!form.inputPort && form.inputPort === form.port;
  const dirty = !state.configured || !same(form, saved);
  const canSave = !urlBad && !portMissing && !samePort;

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const loadPorts = async (target = url, quiet = false) => {
    if (!URL_RE.test(target)) return;
    setPortsBusy(true);
    try {
      const { ports: list } = await hallApi.bridgeSerialPorts(target);
      setPorts(list);
    } catch (e) {
      setPorts(null);
      if (!quiet) toast.error((e as Error).message);
    } finally {
      setPortsBusy(false);
    }
  };

  // 저장된 노트북이 있으면 처음 한 번 포트 목록을 불러 둔다
  const loadedOnce = useRef(false);
  useEffect(() => {
    if (loadedOnce.current || !bridge || urlBad) return;
    loadedOnce.current = true;
    void loadPorts(url, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    const iface: DmxInterface = form.kind === "opendmx" ? "opendmx" : "esp32";
    const body: LightingConnection = {
      driver: bridge ? "bridge" : "mock",
      bridgeUrl: bridge ? url : "",
      device: state.connection?.device || "lighting-dmx",
      port: bridge ? form.port : "",
      virtual: bridge && form.virtual,
      interface: iface,
      inputPort: form.kind === "opendmx" ? form.inputPort : "",
    };
    setSaving(true);
    try {
      const res = await lightingApi.updateConnection(hallId, body);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["lighting", hallId] }),
        qc.invalidateQueries({ queryKey: ["halls"] }),
        qc.invalidateQueries({ queryKey: ["bridges"] }),
      ]);
      if (res.warning) toast.error(`저장은 했지만 조명에 보내지 못했어요 — ${res.warning}`);
      else toast.success(state.configured ? "조명 연결을 저장했습니다." : `${hallName}에 조명을 켰습니다. 이제 조명을 찾아 보세요.`);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // 저장된 포트가 목록에 없어도(노트북이 꺼져 있는 등) 고른 값이 보이게
  const portOptions = (current: string) => {
    const list = ports ?? [];
    const extra = current && !list.some((p) => p.port === current) ? [current] : [];
    return (
      <>
        <option value="">{!ports ? "'불러오기'를 누르세요" : list.length ? "포트 고르기" : "꽂힌 장치가 없어요"}</option>
        {extra.map((p) => (
          <option key={p} value={p}>
            {p} · 저장된 포트
          </option>
        ))}
        {list.map((p) => {
          const guess = portGuess(p);
          return (
            <option key={p.port} value={p.port}>
              {p.port} · {p.chip || p.description || "시리얼"}
              {guess ? ` — ${guess}` : ""}
            </option>
          );
        })}
      </>
    );
  };

  const portLabel = form.kind === "esp32" ? "조명 노드 COM 포트" : "USB-DMX 케이블 COM 포트";

  return (
    <div className="flex flex-col gap-5">
      <Card title="어떻게 연결하나요?" hint="강당 노트북에 꽂은 장치를 고르세요. 보통은 '조명 노드'예요.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <OptionCard
            selected={form.kind === "esp32"}
            onClick={() => set({ kind: "esp32" })}
            title="조명 노드 (ESP32)"
            badge="추천"
            hint="콘솔 신호 받기 + 조명으로 내보내기를 한 장치가 해요. 콘솔과 함께 써요."
          />
          <OptionCard
            selected={form.kind === "opendmx"}
            onClick={() => set({ kind: "opendmx" })}
            title="USB-DMX 케이블"
            badge="보험"
            hint="조명으로 내보내기만 해요. 콘솔 신호는 조명 노드로 받아요."
          />
          <OptionCard
            selected={form.kind === "mock"}
            onClick={() => set({ kind: "mock" })}
            title="모의 장비"
            hint="장비 없이 화면만 시험해요. 실제 조명은 안 바뀌어요."
          />
        </div>
      </Card>

      {bridge && (
        <Card
          title="강당 노트북"
          hint="조명 콘솔 옆 노트북에 'ONAIR Bridge' 창이 켜져 있어야 해요. 켜진 노트북은 아래에 저절로 나타나요."
        >
          <Field label="노트북 주소" hint="Tailscale IP 와 포트 — 예: http://100.64.12.3:8765" className="max-w-[420px]">
            <input
              value={form.bridgeUrl}
              onChange={(e) => set({ bridgeUrl: e.target.value })}
              placeholder="http://100.x.x.x:8765"
              className={cn(inputCls, "font-orbitron", urlBad ? badBorder : okBorder)}
            />
          </Field>
          <NotebookPicker
            value={form.bridgeUrl}
            onPick={(u) => {
              set({ bridgeUrl: u });
              void loadPorts(u.trim().replace(/\/$/, ""));
            }}
            need="dmx"
          />
        </Card>
      )}

      {bridge && (
        <Card
          title="COM 포트"
          hint={
            form.kind === "esp32"
              ? "조명 노드(ESP32)를 노트북에 꽂으면 목록에 나타나요. 보통 CP210x 나 CH340 이라고 보여요."
              : "USB-DMX 케이블(FTDI)과, 콘솔 신호를 받는 조명 노드(ESP32)를 따로 골라요."
          }
          action={
            state.configured && state.connection?.driver === "bridge" ? (
              <Badge tone={state.connected ? "good" : "off"}>
                {state.connection.virtual ? "가상" : state.connection.port || "포트 없음"}
                {state.connection.inputPort ? ` · 콘솔 ${state.connection.inputPort}` : ""}
              </Badge>
            ) : (
              <Badge tone="off">아직 안 골랐어요</Badge>
            )
          }
        >
          <div className="flex flex-wrap items-end gap-3">
            <Field label={portLabel} className="min-w-[260px] flex-1">
              <select
                value={form.port}
                onChange={(e) => set({ port: e.target.value })}
                disabled={form.virtual}
                className={cn(inputCls, portMissing ? badBorder : okBorder, "cursor-pointer")}
              >
                {portOptions(form.port)}
              </select>
            </Field>
            {form.kind === "opendmx" && (
              <Field label="콘솔 신호 받는 조명 노드 (선택)" className="min-w-[260px] flex-1">
                <select
                  value={form.inputPort}
                  onChange={(e) => set({ inputPort: e.target.value })}
                  className={cn(inputCls, samePort ? badBorder : okBorder, "cursor-pointer")}
                >
                  {portOptions(form.inputPort)}
                </select>
              </Field>
            )}
            <ActionButton
              icon={<RefreshCw size={14} />}
              busy={portsBusy}
              onClick={() => loadPorts()}
              disabled={urlBad}
            >
              불러오기
            </ActionButton>
          </div>
          {samePort && (
            <p className="-mt-2 font-pretendard text-xs text-red-300/85">케이블과 조명 노드는 다른 COM 포트여야 해요.</p>
          )}
          {form.kind === "opendmx" && !form.inputPort && (
            <p className="-mt-2 font-pretendard text-xs text-white/35">
              비워 두면 콘솔 신호를 받지 않아요 — 그동안은 ONAIR 만 조명을 바꿀 수 있어요.
            </p>
          )}
          <Switch
            checked={form.virtual}
            onChange={(v) => set({ virtual: v })}
            label="변환기 없이 시험(가상) — 장비가 오기 전에 화면부터 만들어 둘 때"
          />
        </Card>
      )}

      {!bridge && (
        <Notice tone="info">
          모의 장비는 값만 기억해요. 조명 찾기·목록 만들기 연습은 되지만 실제 무대 조명은 바뀌지 않아요.
        </Notice>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#161616]/90 px-5 py-3">
        <span className="font-pretendard text-xs text-white/35">
          {state.configured
            ? state.connected
              ? `지금 연결됨 — ${state.detail}`
              : `지금 연결 안 됨 — ${state.detail}`
            : `${hallName}에는 아직 조명이 없어요. 저장하면 조명이 켜져요.`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {state.configured && dirty && (
            <>
              <span className="font-pretendard text-xs text-amber-200/75">저장 안 한 변경이 있어요</span>
              <ActionButton tone="ghost" icon={<RotateCcw size={14} />} onClick={() => setForm(saved)}>
                되돌리기
              </ActionButton>
            </>
          )}
          {state.configured && !dirty ? (
            <ActionButton tone="primary" icon={<ArrowRight size={15} />} onClick={onNext}>
              다음: 조명 찾기
            </ActionButton>
          ) : (
            <ActionButton tone="primary" icon={<Save size={15} />} busy={saving} onClick={save} disabled={!canSave}>
              저장하고 연결
            </ActionButton>
          )}
        </div>
      </div>
    </div>
  );
}
