import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ONAIR LIVE",
  description: "지금 송출 중인 화면",
};

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return children;
}
