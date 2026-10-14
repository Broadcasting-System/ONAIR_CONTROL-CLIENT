import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ONAIR SHARE",
  description: "방송부 코드로 내 화면을 송출 화면에 보내기",
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
