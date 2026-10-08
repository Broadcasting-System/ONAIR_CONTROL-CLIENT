"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PlugZap, Radar, RefreshCw, RotateCcw, Save } from "lucide-react";
import Select from "@/components/common/Select";
import { toast } from "@/components/common/Toast";
import { Notice } from "@/components/hall/HallControls";
import { hallApi } from "@/lib/hallApi";
import { cn } from "@/lib/utils";
import type {
  ConnectionTestResult,
  ConsoleDriverKind,
  DiscoverResult,
  FoundConsole,
  MidiPorts,
  MixerConnection,
  MixerState,
} from "@/types/hall";
import NotebookPicker from "./NotebookPicker";
import { ActionButton, Badge, Card, Field, OptionCard, Switch, TestResults, badBorder, inputCls, okBorder } from "./ui";

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const URL_RE = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?\/?$/;

const clone = (c: MixerConnection): MixerConnection => ({
  driver: c.driver,
  hiqnet: { ...c.hiqnet },
  bridge: { ...c.bridge },
  midi: { ...c.midi },
});
const same = (a: MixerConnection, b: MixerConnection) => JSON.stringify(clone(a)) === JSON.stringify(clone(b));

/** 콘솔과 같은 대역의 권장 주소 (/24 가정) — 노트북 이더넷에 넣을 값 */
function suggestAddress(ip: string): string | null {
  const m = IPV4.exec(ip);
  if (!m) return null;
  return `${m[1]}.${m[2]}.${m[3]}.${Number(m[4]) === 200 ? 201 : 200}`;
}

/** ① 연결 — 콘솔에 어떻게 붙는지 정하고, 저장하기 전에 시험한다 */
export default function ConnectionStep({
  hallId,
  state,
  onSaved,
}: {
  hallId: string;
  state: MixerState;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const saved = state.connection;
  const [conn, setConn] = useState<MixerConnection>(() => clone(saved));
  const [result, setResult] = useState<ConnectionTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finding, setFinding] = useState(false);
  const [found, setFound] = useState<DiscoverResult | null>(null);
  const [ports, setPorts] = useState<MidiPorts | null>(null);
  const [portsBusy, setPortsBusy] = useState(false);
  const [port, setPort] = useState("");
  const [advanced, setAdvanced] = useState(false);

  const hq = conn.hiqnet;
  const isHiqnet = conn.driver === "hiqnet";
  const midiOn = conn.driver === "midi-bridge" || (isHiqnet && conn.midi.enabled);
  const viaBridge = isHiqnet && hq.via === "bridge";
  const usesBridge = midiOn || viaBridge;
  const dirty = !same(conn, saved);

  const url = conn.bridge.url.trim().replace(/\/$/, "");
  const hostBad = isHiqnet && !hq.host.trim();
  const urlBad = usesBridge && !URL_RE.test(url);
  const canSubmit = !hostBad && !urlBad;

  // 값을 바꾸면 예전 시험 결과는 더 이상 맞지 않는다
  const edit = (fn: (c: MixerConnection) => MixerConnection) => {
    setConn(fn);
    setResult(null);
  };
  const setDriver = (driver: ConsoleDriverKind) => edit((c) => ({ ...c, driver }));
  const setHq = (p: Partial<MixerConnection["hiqnet"]>) => edit((c) => ({ ...c, hiqnet: { ...c.hiqnet, ...p } }));
  const setBridge = (p: Partial<MixerConnection["bridge"]>) => edit((c) => ({ ...c, bridge: { ...c.bridge, ...p } }));
  const setMidi = (p: Partial<MixerConnection["midi"]>) => edit((c) => ({ ...c, midi: { ...c.midi, ...p } }));

  const payload = (): MixerConnection => ({
    ...clone(conn),
    hiqnet: { ...hq, host: hq.host.trim() },
    bridge: { ...conn.bridge, url },
  });

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      setResult(await hallApi.testMixerConnection(hallId, payload()));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await hallApi.updateMixerConnection(hallId, payload());
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["mixer", hallId] }),
        qc.invalidateQueries({ queryKey: ["hallsStatus"] }),
      ]);
      toast.success("연결 방식을 저장했습니다.");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const find = async () => {
    setFinding(true);
    setFound(null);
    try {
      setFound(await hallApi.discoverConsoles({ via: viaBridge ? "bridge" : "server", bridgeUrl: url, seconds: 3 }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setFinding(false);
    }
  };

  const loadPorts = async () => {
    setPortsBusy(true);
    try {
      const p = await hallApi.bridgeMidiPorts(url);
      setPorts(p);
      if (!p.out.includes(port)) setPort(p.out[0] ?? "");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPortsBusy(false);
    }
  };

  const applyPort = async () => {
    if (!port) return;
    try {
      // 받는 쪽(콘솔이 보내는 씬 변경)도 같은 인터페이스면 함께 연다
      await hallApi.bridgeConfigureMidi(url, conn.bridge.device, port, ports?.in.includes(port) ? port : null);
      toast.success(`노트북 MIDI 를 '${port}' 로 설정했습니다.`);
      setResult(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card title="연결 방식">
        <div className="grid grid-cols-3 gap-3">
          <OptionCard
            selected={isHiqnet}
            onClick={() => setDriver("hiqnet")}
            title="랜선 (HiQnet)"
            badge="추천"
          />
          <OptionCard
            selected={conn.driver === "midi-bridge"}
            onClick={() => setDriver("midi-bridge")}
            title="MIDI 만"
          />
          <OptionCard
            selected={conn.driver === "mock"}
            onClick={() => setDriver("mock")}
            title="모의 장비"
          />
        </div>
      </Card>

      {isHiqnet && (
        <Card title="콘솔">
          <div className="grid grid-cols-2 gap-3">
            <OptionCard
              selected={hq.via === "bridge"}
              onClick={() => setHq({ via: "bridge" })}
              title="강당 노트북 거쳐서"
              badge="추천"
            />
            <OptionCard
              selected={hq.via === "direct"}
              onClick={() => setHq({ via: "direct" })}
              title="서버에서 바로"
            />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <Field label="콘솔 IP" className="w-[220px]">
              <input
                value={hq.host}
                onChange={(e) => setHq({ host: e.target.value })}
                placeholder="192.168.0.50"
                className={cn(inputCls, "font-orbitron", hostBad ? badBorder : okBorder)}
              />
            </Field>
            <Field label="장치 번호" className="w-[110px]">
              <input
                type="number"
                min={1}
                max={65534}
                value={hq.device}
                onChange={(e) => setHq({ device: Math.floor(Number(e.target.value)) || 1 })}
                className={cn(inputCls, "font-orbitron", okBorder)}
              />
            </Field>
            <ActionButton
              icon={<Radar size={15} />}
              busy={finding}
              onClick={find}
              disabled={viaBridge && urlBad}
            >
              콘솔 찾기
            </ActionButton>
            <button
              type="button"
              onClick={() => setAdvanced((v) => !v)}
              className="ml-auto h-10 font-pretendard text-xs text-white/40 hover:text-white/70"
            >
              고급 설정 {advanced ? "접기" : "보기"}
            </button>
          </div>

          {advanced && (
            <div className="flex flex-wrap gap-3 rounded-xl bg-white/[0.02] p-3">
              <Field label="HiQnet 포트" className="w-[130px]">
                <input
                  type="number"
                  value={hq.port}
                  onChange={(e) => setHq({ port: Math.floor(Number(e.target.value)) || 3804 })}
                  className={cn(inputCls, "font-orbitron", okBorder)}
                />
              </Field>
              {viaBridge && (
                <Field label="노트북 중계 포트" className="w-[150px]">
                  <input
                    type="number"
                    value={hq.relayPort}
                    onChange={(e) => setHq({ relayPort: Math.floor(Number(e.target.value)) || 38040 })}
                    className={cn(inputCls, "font-orbitron", okBorder)}
                  />
                </Field>
              )}
            </div>
          )}

          {found && <FoundList found={found} currentHost={hq.host.trim()} onPick={(c) => setHq({ host: c.ip, device: c.device })} />}
        </Card>
      )}

      {usesBridge && (
        <Card title="강당 노트북">
          <Field label="노트북 주소" className="max-w-[420px]">
            <input
              value={conn.bridge.url}
              onChange={(e) => setBridge({ url: e.target.value })}
              placeholder="http://100.x.x.x:8765"
              className={cn(inputCls, "font-orbitron", urlBad ? badBorder : okBorder)}
            />
          </Field>
          <NotebookPicker
            value={conn.bridge.url}
            onPick={(u) => setBridge({ url: u })}
            need={viaBridge ? "hiqnet-relay" : "midi-ports"}
          />
          {!saved.tokenConfigured && (
            <Notice>브릿지 토큰을 만들지 못했어요</Notice>
          )}
        </Card>
      )}

      {(isHiqnet || conn.driver === "midi-bridge") && (
        <Card
          title="씬 전환 (MIDI)"
          action={isHiqnet ? <Switch checked={conn.midi.enabled} onChange={(v) => setMidi({ enabled: v })} label="사용" /> : undefined}
        >
          {midiOn && (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="MIDI 포트" className="min-w-[280px] flex-1">
                  <div className="flex gap-2">
                    <Select
                      value={port}
                      onChange={setPort}
                      disabled={!ports || ports.out.length === 0}
                      placeholder={ports && ports.out.length === 0 ? "USB-MIDI 없음" : "포트 고르기"}
                      options={(ports?.out ?? []).map((p) => ({ value: p, label: p }))}
                      className={cn(inputCls, okBorder, "flex-1")}
                    />
                    <ActionButton icon={<RefreshCw size={14} />} busy={portsBusy} onClick={loadPorts} disabled={urlBad}>
                      불러오기
                    </ActionButton>
                    <ActionButton onClick={applyPort} disabled={!port}>
                      이 포트로
                    </ActionButton>
                  </div>
                </Field>
                <Field label="MIDI 채널" className="w-[110px]">
                  <input
                    type="number"
                    min={1}
                    max={16}
                    value={conn.midi.channel}
                    onChange={(e) => setMidi({ channel: Math.floor(Number(e.target.value)) || 1 })}
                    className={cn(inputCls, "font-orbitron", okBorder)}
                  />
                </Field>
              </div>
              <Switch
                checked={conn.midi.oneBased}
                onChange={(v) => setMidi({ oneBased: v })}
                label="씬 번호 1부터 시작"
              />
            </>
          )}
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#161616]/90 px-5 py-3">
        <ActionButton icon={<PlugZap size={15} />} busy={testing} onClick={runTest} disabled={!canSubmit}>
          연결 시험
        </ActionButton>
        <div className="ml-auto flex items-center gap-2">
          {dirty && <span className="font-pretendard text-xs text-amber-200/75">저장 안 한 변경이 있어요</span>}
          {dirty && (
            <ActionButton
              tone="ghost"
              icon={<RotateCcw size={14} />}
              onClick={() => {
                setConn(clone(saved));
                setResult(null);
              }}
            >
              되돌리기
            </ActionButton>
          )}
          <ActionButton tone="primary" icon={<Save size={15} />} busy={saving} onClick={save} disabled={!dirty || !canSubmit}>
            저장
          </ActionButton>
        </div>
      </div>
      {result && <TestResults result={result} />}
    </div>
  );
}

function FoundList({
  found,
  currentHost,
  onPick,
}: {
  found: DiscoverResult;
  currentHost: string;
  onPick: (c: FoundConsole) => void;
}) {
  const where = found.via === "bridge" ? "강당 노트북" : "서버";
  if (found.consoles.length === 0) {
    return (
      <Notice>
        {where}에서 콘솔을 찾지 못했어요
      </Notice>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="font-pretendard text-xs text-white/40">
        {where}에서 찾음 · 이 컴퓨터 주소 {found.interfaces.join(", ") || "알 수 없음"}
      </p>
      {found.consoles.map((c) => {
        const inUse = currentHost === c.ip;
        return (
          <div
            key={`${c.ip}-${c.device}`}
            className={cn(
              "flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3",
              inUse ? "border-[#00FF57]/35 bg-[#00FF57]/[0.05]" : "border-white/10 bg-white/[0.03]",
            )}
          >
            <span className="font-orbitron text-sm text-white">{c.ip}</span>
            <span className="font-pretendard text-xs text-white/45">
              장치 {c.device}
              {c.serial ? ` · ${c.serial}` : ""}
            </span>
            {c.sameSubnet === true && <Badge tone="good">같은 대역</Badge>}
            {c.sameSubnet === false && <Badge tone="warn">대역 다름</Badge>}
            <ActionButton className="ml-auto" onClick={() => onPick(c)} disabled={inUse}>
              {inUse ? "사용 중" : "이 콘솔 쓰기"}
            </ActionButton>
            {c.sameSubnet === false && found.via === "bridge" && suggestAddress(c.ip) && (
              <p className="w-full font-pretendard text-xs text-amber-200/85">
                노트북 IP {suggestAddress(c.ip)} · {c.mask || "255.255.255.0"}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
