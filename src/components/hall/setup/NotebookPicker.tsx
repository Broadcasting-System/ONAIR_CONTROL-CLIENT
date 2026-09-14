"use client";

import { useQuery } from "@tanstack/react-query";
import { hallApi } from "@/lib/hallApi";
import { cn } from "@/lib/utils";

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** 켜져 있다고 알려 온 노트북 — 누르면 주소 칸을 채운다 (Tailscale IP 를 손으로 칠 필요 없게) */
export default function NotebookPicker({
  value,
  onPick,
  need,
}: {
  value: string;
  onPick: (url: string) => void;
  /** 이 기능이 없는 예전 노트북 프로그램이면 '업데이트 필요'로 표시 */
  need?: string;
}) {
  const { data } = useQuery({ queryKey: ["bridges"], queryFn: hallApi.bridges, refetchInterval: 5000 });
  if (!data) return null;
  const list = (data.announced ?? []).filter((a) => a.online);
  const current = value.trim().replace(/\/$/, "");

  if (list.length === 0) {
    return (
      <p className="font-pretendard text-xs leading-relaxed text-white/35">
        켜진 노트북이 아직 없어요. 노트북에 설치 파일을 깔면(기기 관리 › 강당 장비 › 노트북 설치 파일) 30초 안에 여기
        나타나요.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-pretendard text-xs text-white/40">켜진 노트북</span>
      {list.map((a) => {
        const on = a.url === current;
        const old = !!need && !a.features.includes(need);
        return (
          <button
            key={a.url}
            type="button"
            onClick={() => onPick(a.url)}
            disabled={on}
            title={a.hostname ? `컴퓨터 이름 ${a.hostname} · v${a.version}` : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left transition-colors",
              on
                ? "border-[#00FF57]/40 bg-[#00FF57]/[0.08]"
                : "border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/10",
            )}
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#00FF57] shadow-[0_0_8px_#00FF57]" />
            <span className="font-mbc text-sm text-white">{a.name || a.hostname || "노트북"}</span>
            <span className="font-orbitron text-[11px] text-white/45">{hostOf(a.url)}</span>
            {old ? (
              <span className="rounded bg-amber-400/15 px-1.5 py-px font-pretendard text-[10px] text-amber-200">
                업데이트 필요
              </span>
            ) : (
              <span className="font-pretendard text-[11px] text-white/35">{on ? "사용 중" : "이 노트북 쓰기"}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
