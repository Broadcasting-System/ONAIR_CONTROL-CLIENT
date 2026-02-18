"use client";

import Button from "@/components/Button";
import TextInput from "@/components/TextInput";
import ScheduleItem from "@/components/ScheduleItem";
import StatusCard from "@/components/StatusCard";
import { useTts } from "@/hooks/useTts";
import { useSpeakers } from "@/hooks/useSpeakers";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useSchedule } from "@/hooks/useSchedule";
import Link from "next/link";

export default function MainPage() {
  const { text, setText, handleSend, isSending } = useTts();
  const { zones, toggleAll, toggleGrade } = useSpeakers();
  const { statuses } = useNetworkStatus();
  const { schedules } = useSchedule();

  return (
    <div className="grid grid-cols-12 gap-16">
      <div className="col-span-5 flex flex-col gap-10">
        <section>
          <h2 className="mb-3 text-4xl font-mbc text-white">TTS</h2>
          <div className="flex flex-col gap-8 rounded-[24px] border border-sidebar-border bg-sidebar p-8 backdrop-blur-md shadow-2xl">
            <TextInput
              value={text}
              onChange={setText}
              placeholder="방송할 텍스트를 입력해주세요"
            />
            <Button
              label={isSending ? "송출 중..." : "TTS 송출하기"}
              onClick={handleSend}
              disabled={!text.trim() || isSending}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-4xl font-mbc text-white">방송예약</h2>
          <div className="flex flex-col gap-6 rounded-[24px] border border-sidebar-border bg-sidebar p-8 backdrop-blur-md shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent opacity-50" />

            <div className="flex flex-col gap-5">
              {schedules.map((item) => (
                <ScheduleItem
                  key={item.id}
                  title={item.title}
                  date={item.scheduledTime}
                  day={item.day || ""}
                  isActive={item.active}
                />
              ))}
            </div>
            <Link href="/broadcast" className="mt-2 text-right text-sm font-medium text-white/40 hover:text-white transition-colors">
              자세히 보기
            </Link>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-4xl font-mbc text-white">방송 모니터링</h2>
          <div className="flex flex-col gap-6 rounded-[24px] border border-sidebar-border bg-sidebar p-8 backdrop-blur-md shadow-2xl">
            <div className="aspect-video w-full rounded-xl bg-black flex items-center justify-center border border-white/10 relative overflow-hidden shadow-inner">
              <div className="absolute inset-0 bg-gradient-to-t from-red-900/10 to-transparent" />
              <div className="relative z-10 flex flex-col items-center justify-center gap-2">
                <h3 className="text-4xl font-black italic tracking-wider text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">OFF AIR</h3>
                <p className="text-xs font-medium text-red-500 tracking-tight opacity-80">방송 송출 준비 중입니다 잠시만 기다려주세요</p>
              </div>
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 bg-[length:100%_2px,3px_100%] pointer-events-none" />
            </div>
            <Button label="송출 미디어 변경" onClick={() => { }} />
          </div>
        </section>
      </div>

      <div className="col-span-7 flex flex-col gap-14">
        <section>
          <h2 className="mb-3 text-4xl font-mbc text-white">네트워크 상태</h2>
          <div className="rounded-[24px] border border-sidebar-border bg-sidebar p-8 backdrop-blur-md shadow-2xl bg-gradient-to-br from-white/5 to-transparent">
            <div className="grid grid-cols-2 gap-8">
              {statuses.map((item) => (
                <StatusCard key={item.label} label={item.label} status={item.status} height={120} />
              ))}
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-4xl font-mbc text-white">스피커 관리</h2>
          <div className="rounded-[24px] border border-sidebar-border bg-sidebar p-8 backdrop-blur-md shadow-2xl">
            <div className="grid grid-cols-5 gap-4 mb-8">
              {zones.map((zone) => (
                <StatusCard key={zone.id} label={zone.name} status={zone.status} />
              ))}
            </div>
            <div className="flex gap-12 justify-center">
              <div className="w-[360px]">
                <Button label="전체" onClick={() => toggleAll("on")} />
              </div>
              <div className="w-[360px]">
                <Button
                  label="학년 전체"
                  color="#1e3a8a"
                  onClick={() => {
                    ["1학년", "2학년", "3학년"].forEach(g => toggleGrade(g, "on"));
                  }}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
