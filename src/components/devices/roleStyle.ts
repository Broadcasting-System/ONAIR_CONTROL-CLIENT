import type { AssignableRole, Role } from "@/types/member";

/** 역할 점 — 색으로 역할을 나누지 않는다(흰색·회색만). 쓰는 역할은 밝게, 졸업·미등록은 흐리게 */
export const ROLE_DOT: Record<Role, string> = {
  superadmin: "bg-white/80",
  lead: "bg-white/80",
  member: "bg-white/80",
  teacher: "bg-white/80",
  alumni: "bg-white/30",
  guest: "bg-white/15",
};

export const ASSIGNABLE: { value: AssignableRole; label: string }[] = [
  { value: "lead", label: "부장" },
  { value: "member", label: "부원" },
  { value: "teacher", label: "교사" },
  { value: "alumni", label: "졸업" },
];
