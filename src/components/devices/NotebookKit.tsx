"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Download, Link2, Loader2 } from "lucide-react";
import { toast } from "@/components/common/Toast";
import NeonButton from "@/components/common/NeonButton";
import { Field, badBorder, inputCls, okBorder } from "@/components/hall/setup/ui";
import { hallApi } from "@/lib/hallApi";
import { cn } from "@/lib/utils";

const URL_RE = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?\/?$/;

const STEPS = ["Tailscale 로그인", "설치 파일 받기", "INSTALL.bat 실행"];

/** 노트북 설치 파일 — 받아서 압축 풀고 INSTALL.bat 만 누르면 되게 (서버 주소·토큰이 미리 들어 있다) */
export default function NotebookKit() {
  const { data: info } = useQuery({ queryKey: ["bridgeKitInfo"], queryFn: hallApi.bridgeKitInfo, staleTime: 60_000 });
  const [name, setName] = useState("");
  const [server, setServer] = useState("");
  const [busy, setBusy] = useState<"zip" | "link" | null>(null);
  const [link, setLink] = useState<{ url: string; expiresAt: number } | null>(null);

  // 서버가 추정한 값으로 한 번만 채운다 (사람이 고친 값은 덮지 않는다)
  useEffect(() => {
    if (!info) return;
    setName((n) => n || info.names[0] || "강당");
    setServer((s) => s || info.suggestedServer);
  }, [info]);

  const serverUrl = server.trim().replace(/\/$/, "");
  const serverBad = !URL_RE.test(serverUrl);
  const nameBad = !name.trim() || name.trim().length > 40;
  const blocked = serverBad || nameBad || !!busy;

  const downloadZip = async () => {
    setBusy("zip");
    try {
      await hallApi.downloadBridgeKit(name.trim(), serverUrl);
      toast.success("설치 파일을 받았어요");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const makeLink = async () => {
    setBusy("link");
    try {
      setLink(await hallApi.bridgeKitLink(name.trim(), serverUrl));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      toast.success("주소를 복사했어요");
    } catch {
      toast.error("복사하지 못했어요");
    }
  };

  const until = link
    ? new Date(link.expiresAt * 1000).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <section data-tour="bridges.kit" className="flex flex-col gap-4 rounded-[20px] border border-white/[0.09] bg-white/[0.045] p-4 backdrop-blur-md md:rounded-2xl md:border-white/[0.08] md:bg-[#0a0a0a] md:p-5 md:backdrop-blur-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-mbc text-lg text-white">노트북 설치 파일</h3>
        </div>
        {info && <span className="font-orbitron text-[11px] tracking-[0.12em] text-white/35">BRIDGE v{info.version}</span>}
      </div>

      <ol data-tour="bridges.kit.steps" className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3.5 py-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 font-orbitron text-xs text-white/70">
              {i + 1}
            </span>
            <span className="min-w-0 font-mbc text-sm text-white">{s}</span>
          </li>
        ))}
      </ol>

      <div data-tour="bridges.kit.download" className="flex flex-wrap items-end gap-3">
        <Field label="노트북 이름" className="w-full md:w-[190px]">
          <input
            list="onair-kit-names"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className={cn(inputCls, nameBad ? badBorder : okBorder)}
          />
          <datalist id="onair-kit-names">
            {info?.names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </Field>
        <Field label="ONAIR 서버 주소" className="w-full flex-1 md:w-auto md:min-w-[250px]">
          <input
            value={server}
            onChange={(e) => setServer(e.target.value)}
            placeholder="http://100.x.x.x:8000"
            className={cn(inputCls, "font-orbitron", serverBad ? badBorder : okBorder)}
          />
        </Field>
        <NeonButton
          data-tour="bridges.kit.zip"
          icon={busy === "zip" ? <Loader2 className="animate-spin" /> : <Download />}
          disabled={blocked}
          onClick={downloadZip}
          className="max-md:w-full"
        >
          이 컴퓨터로 받기
        </NeonButton>
        <NeonButton
          tone="white"
          data-tour="bridges.kit.link"
          icon={busy === "link" ? <Loader2 className="animate-spin" /> : <Link2 />}
          disabled={blocked}
          onClick={makeLink}
          className="max-md:w-full"
        >
          노트북에서 받을 주소
        </NeonButton>
      </div>

      {info && !info.suggestedServer && (
        <p className="-mt-1 font-pretendard text-xs text-amber-200/80">서버 Tailscale IP 를 찾지 못했어요</p>
      )}

      {link && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#00FF57]/25 bg-[#00FF57]/[0.05] px-4 py-3">
          <span className="font-pretendard text-xs text-white/50">{until} 까지</span>
          <code className="min-w-0 break-all font-mono text-sm text-[#9dffc1]">{link.url}</code>
          <NeonButton tone="white" icon={<Copy />} onClick={copy} className="ml-auto h-11 md:h-9">
            복사
          </NeonButton>
        </div>
      )}
    </section>
  );
}
