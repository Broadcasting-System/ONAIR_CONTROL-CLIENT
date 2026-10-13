import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/useIsMobile";

/** 폰 전용 화면 — PC·태블릿에서 열리면 그에 맞는 PC 화면으로 */
export function useMobileOnly(desktopHref: string) {
  const mobile = useIsMobile();
  const router = useRouter();
  useEffect(() => {
    // 첫 그림(서버 렌더)은 mobile=false 라서 한 번 더 확인한 뒤 옮긴다
    const mq = window.matchMedia("(max-width: 767px)");
    if (!mq.matches) router.replace(desktopHref);
  }, [mobile, desktopHref, router]);
  return mobile;
}
