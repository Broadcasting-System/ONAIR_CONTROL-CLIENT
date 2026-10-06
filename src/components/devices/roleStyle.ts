import type { AssignableRole, Role } from "@/types/member";

/** 역할 점 색 — 최고 관리자 노랑 · 부장 빨강 · 부원 초록 · 교사 하늘 · 졸업/미등록 회색 */
export const ROLE_DOT: Record<Role, string> = {
  superadmin: "bg-[#FFD600] shadow-[0_0_8px_#FFD600]",
  lead: "bg-[#FF3B3B] shadow-[0_0_8px_#FF3B3B]",
  member: "bg-[#00FF57] shadow-[0_0_8px_#00FF57]",
  teacher: "bg-[#7CC4FF] shadow-[0_0_8px_#7CC4FF]",
  alumni: "bg-white/30",
  guest: "bg-white/15",
};

export const ASSIGNABLE: { value: AssignableRole; label: string }[] = [
  { value: "lead", label: "부장" },
  { value: "member", label: "부원" },
  { value: "teacher", label: "교사" },
  { value: "alumni", label: "졸업" },
];
