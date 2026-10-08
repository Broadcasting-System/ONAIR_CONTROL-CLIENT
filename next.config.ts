import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 메뉴를 합치며 옮긴 옛 주소 — 즐겨찾기·CUE 링크가 그대로 열리게
  async redirects() {
    return [
      { source: "/banner", destination: "/media?tab=banner", permanent: false },
      { source: "/auto-audio", destination: "/mixer?tab=auto", permanent: false },
    ];
  },
};

export default nextConfig;
