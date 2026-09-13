"use client";

import type { Dispatch, SetStateAction } from "react";
import { EyeOff, Gauge, Lock, ShieldAlert } from "lucide-react";
import { Notice } from "@/components/hall/HallControls";
import type { MixerState } from "@/types/hall";
import type { Draft } from "./draft";
import { Card, OptionCard } from "./ui";

/** ④ 조작 범위 — 방송부가 화면에서 어디까지 만질지, 걸린 안전장치 한눈에 */
export default function ModeStep({
  state,
  draft,
  setDraft,
}: {
  state: MixerState;
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft | null>>;
}) {
  const setMode = (mode: Draft["mode"]) => setDraft((d) => (d ? { ...d, mode } : d));
  const limited = [...draft.channels, ...(draft.master ? [draft.master] : [])].filter((c) => c.max < 100);
  const hidden = draft.channels.filter((c) => c.hidden);
  const guarded = draft.scenes.filter((s) => s.confirm);
  const noChannelLink = draft.mode === "channels" && state.connection.driver !== "hiqnet";

  return (
    <div className="flex flex-col gap-5">
      <Card title="방송부 조작 범위" hint="관리자는 이 세팅 화면에서 언제든 전부 시험할 수 있어요.">
        <div className="grid grid-cols-2 gap-3">
          <OptionCard
            selected={draft.mode === "channels"}
            onClick={() => setMode("channels")}
            title="채널 조작"
            hint="페이더·뮤트·씬 전환을 조작 화면에서 합니다."
          />
          <OptionCard
            selected={draft.mode === "scenes"}
            onClick={() => setMode("scenes")}
            title="씬 전환만"
            hint="조작 화면엔 씬 버튼만. 채널은 콘솔에서 직접 만집니다."
          />
        </div>
        {noChannelLink && (
          <Notice>지금 연결 방식에서는 채널을 조작할 수 없어요. 채널까지 쓰려면 ‘연결’에서 랜선(HiQnet)을 고르세요.</Notice>
        )}
      </Card>

      <Card title="걸린 안전장치" hint="채널·씬 단계에서 바꾼 값이 여기 모여요.">
        <ul className="grid grid-cols-2 gap-3">
          <Item
            icon={<Gauge size={16} />}
            title="최대 레벨 제한"
            value={limited.length ? limited.map((c) => `${c.name || c.id} ${c.max}`).join(" · ") : "없음"}
          />
          <Item
            icon={<EyeOff size={16} />}
            title="숨긴 채널"
            value={hidden.length ? hidden.map((c) => c.name || c.id).join(" · ") : "없음"}
          />
          <Item
            icon={<ShieldAlert size={16} />}
            title="누를 때 확인하는 씬"
            value={guarded.length ? guarded.map((s) => s.name || `씬 ${s.pc}`).join(" · ") : "없음"}
          />
          <Item icon={<Lock size={16} />} title="조작 화면 잠금" value="열 때마다 잠긴 상태로 시작 (항상)" />
        </ul>
      </Card>
    </div>
  );
}

function Item({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <li className="flex gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
      <span className="mt-0.5 text-white/40">{icon}</span>
      <div className="min-w-0">
        <p className="font-mbc text-sm text-white/80">{title}</p>
        <p className="mt-0.5 break-keep font-pretendard text-xs text-white/45">{value}</p>
      </div>
    </li>
  );
}
