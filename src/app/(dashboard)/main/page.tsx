"use client";

import { useEffect } from "react";
import Button from "@/components/common/Button";
import TextInput from "@/components/common/TextInput";
import StatusCard from "@/components/StatusCard";
import SectionHeader from "@/components/common/SectionHeader";

import { useTts } from "@/hooks/useTts";
import { useSpeakers } from "@/hooks/useSpeakers";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useFiles } from "@/hooks/useFiles";
import { DisplayMirror } from "@/components/display/DisplayMirror";

export default function MainPage() {
  const {
    text,
    setText,
    handleSend,
    isSending: isTtsSending,
    startSound,
    setStartSound,
    endSound,
    setEndSound,
  } = useTts();
  const { zones, toggleSpeaker } = useSpeakers();
  const { statuses } = useNetworkStatus();
  const { files, fetchFiles } = useFiles();

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const audioFiles = files.audio ?? [];

  return (
    <div className="grid grid-cols-12 gap-16 h-full">
      <div className="col-span-5 flex flex-col gap-10 h-full">
        <section>
          <SectionHeader>TTS</SectionHeader>
          <div className="flex flex-col gap-8 rounded-[24px] border border-sidebar-border bg-sidebar p-8 backdrop-blur-md shadow-2xl">
            <TextInput
              value={text}
              onChange={setText}
              placeholder="방송할 텍스트를 입력해주세요"
            />

            {/* TTS 시작/끝 음원 (선택 — '안 함' 가능) */}
            <div className="flex gap-4">
              <SoundSelect
                label="시작 음원"
                value={startSound}
                onChange={setStartSound}
                options={audioFiles}
              />
              <SoundSelect
                label="끝 음원"
                value={endSound}
                onChange={setEndSound}
                options={audioFiles}
              />
            </div>

            <Button
              label={isTtsSending ? "송출 중..." : "TTS 송출하기"}
              onClick={handleSend}
              disabled={!text.trim() || isTtsSending}
              className="h-[64px]"
            />
          </div>
        </section>

        <section className="flex-1 flex flex-col">
          <SectionHeader>방송 모니터링</SectionHeader>
          <div className="flex-1 flex flex-col gap-6 rounded-[24px] border border-sidebar-border bg-sidebar p-8 backdrop-blur-md shadow-2xl">
            <div className="aspect-video w-full rounded-xl bg-black flex items-center justify-center border border-white/10 relative overflow-hidden shadow-inner">
              <div className="absolute inset-0 bg-gradient-to-t from-red-900/10 to-transparent" />
              <DisplayMirror />
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 bg-[length:100%_2px,3px_100%] pointer-events-none" />
            </div>
          </div>
        </section>
      </div>

      <div className="col-span-7 flex flex-col gap-14 h-full">
        <section>
          <SectionHeader>네트워크 상태</SectionHeader>
          <div className="rounded-[24px] border border-sidebar-border bg-sidebar p-8 backdrop-blur-md shadow-2xl bg-gradient-to-br from-white/5 to-transparent">
            <div className="grid grid-cols-2 gap-8">
              {statuses.map((item) => (
                <StatusCard key={item.label} label={item.label} status={item.status} variant="network" />
              ))}
            </div>
          </div>
        </section>

        <section className="flex-1 flex flex-col">
          <SectionHeader>스피커 관리</SectionHeader>
          <div className="flex-1 flex flex-col rounded-[24px] border border-sidebar-border bg-sidebar p-8 backdrop-blur-md shadow-2xl">
            <div className="grid grid-cols-5 gap-4 mb-8">
              {zones.map((zone) => (
                <StatusCard
                  key={zone.id}
                  label={zone.name}
                  status={zone.status}
                  variant="speaker"
                  onClick={() => toggleSpeaker(zone.id)}
                />
              ))}
            </div>
            <div className="mt-auto flex gap-12 justify-center">
              <div className="w-[360px]">
                <Button label="전체" onClick={() => toggleSpeaker("all")} className="h-[64px]" />
              </div>
              <div className="w-[360px]">
                <Button
                  label="학년 전체"
                  color="#1e3a8a"
                  onClick={() => toggleSpeaker("grade")}
                  className="h-[64px]"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SoundSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; fileName: string; fileUrl: string }[];
}) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <span className="font-mbc text-sm text-white/50">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-[48px] w-full cursor-pointer rounded-xl border border-white/10 bg-[#1C1C1C] px-4 font-pretendard text-[15px] text-white transition-all focus:border-white/30 focus:outline-none"
      >
        <option value="none">미사용</option>
        {options.map((f) => (
          <option key={f.id} value={f.fileUrl}>
            {f.fileName}
          </option>
        ))}
      </select>
    </div>
  );
}
