import {
  AudioWaveform,
  Bell,
  Cable,
  CircleDot,
  Ellipsis,
  File,
  Globe,
  Inbox,
  Lightbulb,
  Mail,
  Megaphone,
  MessageSquare,
  Monitor,
  Router,
  Cast,
  SlidersVertical,
  Smartphone,
  Sparkles,
  Type,
  Users,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import type { Person } from "@/lib/accessLog";
import { initials } from "@/lib/accessLog";
import { cn } from "@/lib/utils";

/** 분류 순서와 아이콘 — accessLog 의 group 이름 그대로 */
export const GROUPS: [group: string, icon: LucideIcon][] = [
  ["송출", Monitor],
  ["시보", Bell],
  ["스피커", Volume2],
  ["믹서", SlidersVertical],
  ["조명", Lightbulb],
  ["부원", Users],
  ["파일", File],
  ["요청", Inbox],
  ["화면 공유", Cast],
  ["CUE", Sparkles],
  ["녹음·녹화", CircleDot],
  ["방송", Megaphone],
  ["현수막", Type],
  ["자동 음향", AudioWaveform],
  ["영상", Cable],
  ["기기", Router],
  ["메일·Cloudflare", Mail],
  ["말로 조작", MessageSquare],
  ["기타", Ellipsis],
];

const ICON = new Map(GROUPS);
export const groupRank = (g: string) => {
  const i = GROUPS.findIndex(([x]) => x === g);
  return i < 0 ? GROUPS.length : i;
};

export function GroupIcon({ group, size = 14, className }: { group: string; size?: number; className?: string }) {
  const Icon = ICON.get(group) ?? Ellipsis;
  return <Icon size={size} strokeWidth={1.9} className={className} />;
}

/** 사람 아바타 — 사람은 이름 두 글자, 방송실 PC·외부 화면·CUE·기기는 테두리만 */
export function Avatar({ person, size = 24 }: { person: Person; size?: number }) {
  const outline = !(person.kind === "member" || person.kind === "teacher");
  const icon = Math.round(size * 0.55);
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-pretendard text-[11px] font-bold leading-none",
        outline ? "border border-white/20 text-white/70" : person.kind === "teacher" ? "bg-[#3a2a2a] text-white" : "bg-[#2a2a30] text-white",
      )}
    >
      {person.kind === "pc" ? (
        <span className="text-[10px]">PC</span>
      ) : person.kind === "share" ? (
        <Monitor size={icon} strokeWidth={2} />
      ) : person.kind === "cue" ? (
        <Sparkles size={icon} strokeWidth={2} />
      ) : person.kind === "device" ? (
        <Smartphone size={icon} strokeWidth={2} />
      ) : person.kind === "ip" ? (
        <Globe size={icon} strokeWidth={2} />
      ) : (
        initials(person.name)
      )}
    </span>
  );
}
