"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSpeakerMatrix } from "@/hooks/useSpeakerMatrix";
import { useMe } from "@/hooks/useMe";
import { useBroadcastTargets } from "./TargetPicker";
import TtsPanel from "./TtsPanel";
import MicPanel from "./MicPanel";
import { Segmented } from "./parts";

type Tab = "tts" | "mic";

/** /main?mic=1 이면 마이크 탭 (폰 홈 '마이크 방송'·CUE 튜토리얼) */
function MicParam({ onMic }: { onMic: () => void }) {
  const mic = useSearchParams().get("mic") === "1";
  useEffect(() => {
    if (mic) onMic();
  }, [mic, onMic]);
  return null;
}

/** 메인 '방송' 칸 — TTS 와 마이크(실시간·녹음 후 방송) */
export default function BroadcastCard() {
  const [tab, setTab] = useState<Tab>("tts");
  const [locked, setLocked] = useState(false);
  const { names } = useSpeakerMatrix();
  const { selected, setSelected } = useBroadcastTargets(names);
  const { canOperate } = useMe();
  const showMic = useCallback(() => setTab("mic"), []);

  return (
    <section data-tour="main.tts">
      <Suspense fallback={null}>
        <MicParam onMic={showMic} />
      </Suspense>
      <div className="mb-3 flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="font-mbc text-3xl text-white">방송</h2>
        <Segmented<Tab>
          big
          value={tab}
          onChange={setTab}
          disabled={locked}
          options={[
            { value: "tts", label: "TTS", tour: "main.broadcast.tab.tts" },
            { value: "mic", label: "마이크", tour: "main.broadcast.tab.mic" },
          ]}
        />
      </div>
      <div className="flex flex-col gap-2.5 md:gap-7 md:rounded-[24px] md:border md:border-sidebar-border md:bg-sidebar md:p-8 md:shadow-2xl">
        {tab === "tts" ? (
          <TtsPanel names={names} targets={selected} setTargets={setSelected} canOperate={canOperate} />
        ) : (
          <MicPanel
            names={names}
            targets={selected}
            setTargets={setSelected}
            canOperate={canOperate}
            onBusyChange={setLocked}
          />
        )}
      </div>
    </section>
  );
}
