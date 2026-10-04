"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PlugZap, Radar, RefreshCw, RotateCcw, Save } from "lucide-react";
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
      <Card title="어떻게 연결하나요?" hint="콘솔에 꽂은 선에 맞춰 고르세요. 장비가 없으면 모의 장비로 화면만 연습할 수 있어요.">
        <div className="grid grid-cols-3 gap-3">
          <OptionCard
            selected={isHiqnet}
            onClick={() => setDriver("hiqnet")}
            title="랜선 (HiQnet)"
            badge="추천"
            hint="채널 페이더·뮤트를 화면에서. USB-MIDI 까지 있으면 씬 전환도 됩니다."
          />
          <OptionCard
            selected={conn.driver === "midi-bridge"}
            onClick={() => setDriver("midi-bridge")}
            title="MIDI 만"
            hint="씬 전환 버튼만. 강당 노트북에 USB-MIDI 가 꽂혀 있어야 합니다."
          />
          <OptionCard
            selected={conn.driver === "mock"}
            onClick={() => setDriver("mock")}
            title="모의 장비"
            hint="실제 장비 없이 화면 연습용."
          />
        </div>
      </Card>

      {isHiqnet && (
        <Card title="콘솔" hint="콘솔 IP 는 '콘솔 찾기'로 채우면 편해요.">
          <div className="grid grid-cols-2 gap-3">
            <OptionCard
              selected={hq.via === "bridge"}
              onClick={() => setHq({ via: "bridge" })}
              title="강당 노트북 거쳐서"
              badge="추천"
              hint="콘솔을 노트북에 랜선으로 직결. 학교망 설정과 상관없이 됩니다."
            />
            <OptionCard
              selected={hq.via === "direct"}
              onClick={() => setHq({ via: "direct" })}
              title="서버에서 바로"
              hint="콘솔이 방송실 서버와 같은 학교 유선망에 꽂혀 있을 때."
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
              title={viaBridge && urlBad ? "아래에 노트북 주소를 먼저 넣어 주세요" : undefined}
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
          <p className="-mt-2 font-pretendard text-xs text-white/30">
            장치 번호는 콘솔 SYSTEM 의 HiQnet Address 예요 (예: 28147). 콘솔 찾기로 채우면 같이 들어갑니다.
          </p>

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
              <p className="self-end pb-2 font-pretendard text-xs text-white/30">바꿀 일은 거의 없어요.</p>
            </div>
          )}

          {found && <FoundList found={found} currentHost={hq.host.trim()} onPick={(c) => setHq({ host: c.ip, device: c.device })} />}
        </Card>
      )}

      {usesBridge && (
        <Card
          title="강당 노트북"
          hint="콘솔 옆 노트북에 'ONAIR Bridge' 창이 켜져 있어야 해요. 켜진 노트북은 아래에 저절로 나타나요."
        >
          <Field label="노트북 주소" hint="Tailscale IP 와 포트 — 예: http://100.64.12.3:8765" className="max-w-[420px]">
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
            <Notice>서버가 브릿지 토큰을 만들지 못했어요. 서버 data 폴더에 쓸 수 있는지 확인하고 서버를 다시 켜세요.</Notice>
          )}
        </Card>
      )}

      {(isHiqnet || conn.driver === "midi-bridge") && (
        <Card
          title="씬 전환 (MIDI)"
          hint="콘솔에 저장된 씬(Cue)을 부를 때 써요. 강당 노트북에 USB-MIDI 가 필요합니다."
          action={isHiqnet ? <Switch checked={conn.midi.enabled} onChange={(v) => setMidi({ enabled: v })} label="사용" /> : undefined}
        >
          {midiOn ? (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="MIDI 포트 (노트북에 꽂힌 것)" className="min-w-[280px] flex-1">
                  <div className="flex gap-2">
                    <select
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      disabled={!ports || ports.out.length === 0}
                      className={cn(inputCls, okBorder, "flex-1 cursor-pointer")}
                    >
                      <option value="">
                        {!ports ? "'불러오기'를 누르세요" : ports.out.length ? "포트 고르기" : "꽂힌 USB-MIDI 가 없어요"}
                      </option>
                      {ports?.out.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
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
                label="콘솔 화면의 씬 번호가 1부터 시작 (Si 기본)"
              />
            </>
          ) : (
            <p className="font-pretendard text-sm text-white/40">
              USB-MIDI 를 꽂은 뒤 켜세요. 그 전에는 채널 조작만 됩니다.
            </p>
          )}
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#161616]/90 px-5 py-3">
        <ActionButton icon={<PlugZap size={15} />} busy={testing} onClick={runTest} disabled={!canSubmit}>
          연결 시험
        </ActionButton>
        <span className="font-pretendard text-xs text-white/35">저장하지 않고 지금 입력한 값으로 시험해요.</span>
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
        {where}에서 콘솔을 찾지 못했어요. 콘솔 전원과 랜선을 확인하고 다시 찾아보세요.
        {found.via === "server"
          ? " 서버에서 안 보이면 '강당 노트북 거쳐서'로 바꿔서 찾아보세요."
          : " 노트북 이더넷에 콘솔 랜선이 꽂혀 있는지 확인하세요."}
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
            {c.sameSubnet === false && (
              <p className="w-full font-pretendard text-xs text-amber-200/85">
                →{" "}
                {found.via === "bridge"
                  ? `노트북 이더넷을 ${suggestAddress(c.ip) ?? "콘솔과 같은 대역"} / ${c.mask || "255.255.255.0"} 으로 바꾸세요 (윈도우 설정 › 네트워크 › 이더넷 › IP 할당 편집).`
                  : "서버가 콘솔과 다른 대역이라 연결이 안 될 수 있어요. '강당 노트북 거쳐서'를 쓰세요."}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
