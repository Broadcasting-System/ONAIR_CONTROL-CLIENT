"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MonitorUp, Radio } from "lucide-react";
import NeonButton from "@/components/common/NeonButton";
import OnairMark from "@/components/common/OnairMark";
import { backendBase, backendWs } from "@/lib/backend";
import { getIceServers, startScreenSender, type ScreenSender } from "@/lib/screenSender";
import { cn } from "@/lib/utils";
import { channelName } from "@/constants/channels";

/** 외부 화면 공유(share.bssmcast.com) — 발표자가 방송부 코드로 들어와 자기 화면을 송출 채널로 보낸다.
 *  코드·이름 → 화면 고르기 → 방송부 확인 기다림(미리보기 사진을 몇 초마다 올림) → 허용되면 WebRTC 로 송출 → 끝.
 *  토큰은 이 탭에만(sessionStorage) — 새로 고쳐도 같은 요청을 이어 간다. */

type Status = "waiting" | "approved" | "rejected" | "ended";
interface Me {
  id: string;
  name: string;
  status: Status;
  channel: number | null;
  /** 나가는 곳 — 홀 이름이나 채널 이름 */
  place?: string | null;
}

const TOKEN_KEY = "onair.share.token";
const SNAP_MS = 3000;
const POLL_MS = 2000;

function loadToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function saveToken(t: string | null) {
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* 저장 못 해도 이 화면 안에서는 된다 */
  }
}

async function api<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const r = await fetch(`${backendBase()}/api/share${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), ...(token ? { "x-share-token": token } : {}) },
    cache: "no-store",
  });
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try {
      msg = ((await r.json()) as { detail?: string }).detail ?? msg;
    } catch {}
    const e = new Error(msg) as Error & { status?: number };
    e.status = r.status;
    throw e;
  }
  return (await r.json()) as T;
}

const canCapture = () =>
  typeof window !== "undefined" &&
  window.isSecureContext &&
  !!navigator.mediaDevices?.getDisplayMedia;

export default function ShareApp() {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const senderRef = useRef<ScreenSender | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 새로 고침 — 같은 탭의 요청을 이어 간다
  useEffect(() => setToken(loadToken()), []);

  const stopAll = useCallback(() => {
    senderRef.current?.close();
    senderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const finish = useCallback(
    (msg: string) => {
      stopAll();
      saveToken(null);
      setToken(null);
      setMe(null);
      setDone(msg);
    },
    [stopAll],
  );

  // 내 요청 상태 — 2초마다
  useEffect(() => {
    if (!token) return;
    let alive = true;
    const tick = async () => {
      try {
        const m = await api<Me>("/me", {}, token);
        if (!alive) return;
        if (m.status === "rejected") finish("방송부가 이번 요청을 받지 않았어요");
        else if (m.status === "ended") finish("화면 공유가 끝났어요");
        else setMe(m);
      } catch (e) {
        if (alive && (e as { status?: number }).status === 404)
          finish("요청이 끝났어요. 코드를 다시 넣어 주세요");
      }
    };
    void tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [token, finish]);

  // 내 화면 미리보기
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  // 방송부가 허용 전에 볼 미리보기 사진 — 몇 초마다 작게
  useEffect(() => {
    if (!token || !stream) return;
    const canvas = document.createElement("canvas");
    const snap = () => {
      const v = videoRef.current;
      if (!v || !v.videoWidth) return;
      canvas.width = 480;
      canvas.height = Math.round((480 * v.videoHeight) / v.videoWidth);
      canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (b) => {
          if (b)
            void api(
              "/me/snapshot",
              { method: "POST", body: b, headers: { "content-type": "image/jpeg" } },
              token,
            ).catch(() => {});
        },
        "image/jpeg",
        0.6,
      );
    };
    const first = setTimeout(snap, 600);
    const id = setInterval(snap, SNAP_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [token, stream]);

  // 허용되면 그 채널 송출 화면으로 보낸다
  const channel = me?.status === "approved" ? me.channel : null;
  useEffect(() => {
    if (!token || !stream || !channel || senderRef.current) return;
    let cancelled = false;
    void getIceServers(token).then((ice) => {
      if (cancelled || senderRef.current) return;
      const url = `${backendWs("/api/display/ws", channel, "signal")}&share=${encodeURIComponent(token)}`;
      senderRef.current = startScreenSender(stream, url, ice, () => {
        senderRef.current = null; // 끊김 — 다음 상태 확인 때 허용이 살아 있으면 다시 붙는다
      });
    });
    return () => {
      cancelled = true;
    };
  }, [token, stream, channel]);

  const join = async () => {
    setErr("");
    setBusy(true);
    try {
      const res = await api<{ id: string; token: string }>("/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, name }),
      });
      saveToken(res.token);
      setDone(null);
      setToken(res.token);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pick = async () => {
    setErr("");
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      senderRef.current?.close();
      senderRef.current = null;
      streamRef.current = s;
      setStream(s);
      // 브라우저의 '공유 중지'를 누르면 끝
      s.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (streamRef.current === s) void end();
      });
    } catch (e) {
      if ((e as Error).name !== "NotAllowedError") setErr("화면을 고르지 못했어요");
    }
  };

  const end = async () => {
    const t = token;
    finish("화면 공유를 끝냈어요");
    if (t) await api("/me/end", { method: "POST" }, t).catch(() => {});
  };

  const live = me?.status === "approved" && !!stream;
  const step = !token ? "code" : !stream ? "pick" : live ? "live" : "waiting";

  return (
    <main className="flex min-h-[100dvh] w-full flex-col items-center bg-[#0b0b0d] px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(24px+env(safe-area-inset-top))] text-white">
      <div className="flex w-full max-w-[560px] flex-col gap-6">
        <header className="flex items-center gap-2">
          <OnairMark size={26} className="text-[#FF3B3B]" />
          <span className="font-mbc text-[20px] tracking-wide">ONAIR</span>
          <span className="ml-1 font-orbitron text-[11px] font-bold tracking-[0.3em] text-[#FF3B3B]">
            SHARE
          </span>
        </header>

        <section className="flex flex-col gap-5 rounded-[22px] border border-white/10 bg-[#151519] p-5 md:p-7">
          {done && step === "code" ? (
            <p className="rounded-xl bg-white/[0.05] px-4 py-3 font-pretendard text-[15px] text-white/75">
              {done}
            </p>
          ) : null}

          {step === "code" && (
            <form
              className="flex flex-col gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.length === 6 && name.trim()) void join();
              }}
            >
              <h1 className="font-mbc text-[26px] leading-tight">화면 공유</h1>
              <label className="flex flex-col gap-2">
                <span className="font-pretendard text-[14px] font-semibold text-white/70">
                  방송부 코드
                </span>
                <input
                  value={code.length > 3 ? `${code.slice(0, 3)} ${code.slice(3)}` : code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="000 000"
                  className="h-16 rounded-xl border border-white/[0.12] bg-[#0c0d0f] text-center font-mono text-[32px] font-bold tracking-[0.2em] tabular-nums text-white outline-none placeholder:text-white/20 focus:border-[#FF3B3B]/70"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="font-pretendard text-[14px] font-semibold text-white/70">
                  이름
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 40))}
                  className="h-12 rounded-xl border border-white/[0.12] bg-[#0c0d0f] px-4 font-pretendard text-[16px] text-white outline-none placeholder:text-white/30 focus:border-[#FF3B3B]/70"
                />
              </label>
              {err ? <p className="font-pretendard text-[14px] text-[#ff6b6b]">{err}</p> : null}
              <NeonButton
                type="submit"
                size="lg"
                disabled={busy || code.length !== 6 || !name.trim()}
                className="w-full"
              >
                {busy ? "확인하는 중…" : "다음"}
              </NeonButton>
            </form>
          )}

          {step !== "code" && (
            <>
              <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-[#1d1d22]">
                {stream ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/30">
                    <MonitorUp size={34} />
                  </div>
                )}
                {live ? (
                  <span className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-inset ring-[#FF3B3B]" />
                ) : null}
              </div>

              {step === "pick" &&
                (canCapture() ? (
                  <>
                    <p className="font-pretendard text-[14.5px] text-white/60">
                      소리도 보내려면 공유 창에서 오디오를 켜요
                    </p>
                    {err ? (
                      <p className="font-pretendard text-[14px] text-[#ff6b6b]">{err}</p>
                    ) : null}
                    <NeonButton size="lg" icon={<MonitorUp />} onClick={pick} className="w-full">
                      화면 고르기
                    </NeonButton>
                  </>
                ) : (
                  <p className="font-pretendard text-[15px] text-white/70">
                    이 기기에서는 화면 공유를 할 수 없어요. 노트북에서 열어 주세요
                  </p>
                ))}

              {step === "waiting" && (
                <p className="flex items-center gap-2.5 font-pretendard text-[16px] text-white/85">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#f5b400] motion-reduce:animate-none" />
                  방송부 확인 기다리는 중
                </p>
              )}

              {step === "live" && (
                <p className="flex items-center gap-2.5 font-pretendard text-[16px] font-semibold">
                  <Radio size={18} className="text-[#FF3B3B]" />
                  {me?.place || channelName(me?.channel)} 화면에 나가는 중
                </p>
              )}

              <div className={cn("grid gap-2", stream ? "grid-cols-2" : "grid-cols-1")}>
                {stream ? (
                  <NeonButton tone="white" onClick={pick} className="w-full">
                    다른 화면
                  </NeonButton>
                ) : null}
                <NeonButton tone={live ? "red" : "white"} onClick={() => void end()} className="w-full">
                  {live ? "공유 끝내기" : "취소"}
                </NeonButton>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
