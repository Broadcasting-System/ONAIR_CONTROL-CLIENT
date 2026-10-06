import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/common/Toast";
import { lightingApi } from "@/lib/lightingApi";

/** 주소 켜 보기 — 앞에 켠 시험 값을 지우고 from~to 를 모두 255 로. 빠르게 눌러도 순서대로 보낸다 */
export function useTestLight(hallId: string | null) {
  const [lit, setLit] = useState<{ from: number; to: number } | null>(null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const litRef = useRef(lit);
  useEffect(() => {
    litRef.current = lit;
  }, [lit]);

  const run = useCallback((job: () => Promise<unknown>) => {
    const next = chain.current.then(job).catch((e: Error) => {
      toast.error(e.message);
      setLit(null);
    });
    chain.current = next;
    return next;
  }, []);

  const light = useCallback(
    (from: number, to: number) => {
      if (!hallId) return;
      setLit({ from, to });
      void run(async () => {
        await lightingApi.channelTest(hallId, {});
        for (let a = from; a <= to; a++) await lightingApi.channelTest(hallId, { address: a, value: 255 });
      });
    },
    [hallId, run],
  );

  const clear = useCallback(() => {
    if (!hallId) return Promise.resolve();
    setLit(null);
    return run(() => lightingApi.channelTest(hallId, {}));
  }, [hallId, run]);

  // 화면을 떠나거나 공간을 바꾸면 켜 둔 시험 값을 지운다 (무대에 남지 않게)
  useEffect(() => {
    return () => {
      if (hallId && litRef.current) void lightingApi.channelTest(hallId, {}).catch(() => {});
    };
  }, [hallId]);

  return { lit, light, clear };
}
