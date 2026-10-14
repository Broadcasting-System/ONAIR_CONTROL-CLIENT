import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ONAIR TEACHER",
  description: "방송부에 안내 방송·영상 송출·행사 지원·시보 변경 요청",
};

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return children;
}
