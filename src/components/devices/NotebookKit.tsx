"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Download, Link2 } from "lucide-react";
import { toast } from "@/components/common/Toast";
import { ActionButton, Field, badBorder, inputCls, okBorder } from "@/components/hall/setup/ui";
import { hallApi } from "@/lib/hallApi";
import { cn } from "@/lib/utils";

const URL_RE = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?\/?$/;

const STEPS = [
  { title: "Tailscale 로그인", body: "노트북에 Tailscale 을 설치하고 이 서버와 같은 계정으로 로그인" },
  { title: "설치 파일 받기", body: "아래 버튼으로 받거나, 노트북 브라우저에서 받을 주소를 만들어 열기" },
  { title: "INSTALL.bat", body: "압축을 풀고 더블클릭 — 끝나면 아래 '새로 켜진 노트북'에 나타나요" },
];

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
      toast.success("설치 파일을 받았어요. 노트북으로 옮겨 압축을 풀고 INSTALL.bat 을 누르세요.");
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
      toast.success("주소를 복사했어요.");
    } catch {
      toast.error("복사하지 못했어요. 주소를 직접 적어 주세요.");
    }
  };

  const until = link
    ? new Date(link.expiresAt * 1000).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-mbc text-lg text-white">노트북 설치 파일</h3>
          <p className="mt-0.5 font-pretendard text-[13px] text-white/40">
            강당·다목적홀 장비 옆에 둘 윈도우 노트북에 설치해요. 이 서버의 주소와 비밀 토큰이 미리 들어 있어요.
          </p>
        </div>
        {info && <span className="font-orbitron text-[11px] tracking-[0.12em] text-white/35">BRIDGE v{info.version}</span>}
      </div>

      <ol className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3 rounded-xl bg-white/[0.03] px-3.5 py-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 font-orbitron text-xs text-white/70">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block font-mbc text-sm text-white">{s.title}</span>
              <span className="block font-pretendard text-xs leading-relaxed text-white/40">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="노트북 이름" hint="ONAIR 화면에 보일 이름" className="w-[190px]">
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
        <Field label="ONAIR 서버 주소" hint="노트북이 찾아올 주소 — 서버의 Tailscale IP" className="min-w-[250px] flex-1">
          <input
            value={server}
            onChange={(e) => setServer(e.target.value)}
            placeholder="http://100.x.x.x:8000"
            className={cn(inputCls, "font-orbitron", serverBad ? badBorder : okBorder)}
          />
        </Field>
        <ActionButton tone="primary" icon={<Download size={15} />} busy={busy === "zip"} disabled={blocked} onClick={downloadZip}>
          이 컴퓨터로 받기
        </ActionButton>
        <ActionButton icon={<Link2 size={15} />} busy={busy === "link"} disabled={blocked} onClick={makeLink}>
          노트북에서 받을 주소
        </ActionButton>
      </div>

      {info && !info.suggestedServer && (
        <p className="-mt-1 font-pretendard text-xs text-amber-200/80">
          서버의 Tailscale IP 를 찾지 못했어요. 서버 컴퓨터에서 <code className="text-amber-100">tailscale ip -4</code> 로 확인해
          http://100.x.x.x:8000 처럼 적어 주세요.
        </p>
      )}

      {link && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#00FF57]/25 bg-[#00FF57]/[0.05] px-4 py-3">
          <span className="font-pretendard text-xs text-white/50">노트북 브라우저 주소창에 입력 · {until} 까지</span>
          <code className="min-w-0 break-all font-mono text-sm text-[#9dffc1]">{link.url}</code>
          <ActionButton tone="ghost" icon={<Copy size={14} />} onClick={copy} className="ml-auto">
            복사
          </ActionButton>
        </div>
      )}

      <p className="font-pretendard text-xs text-white/30">
        설치 파일에는 비밀 토큰이 들어 있어요. 노트북에만 옮기고 다른 곳에 올리지 마세요. 새로 받아 다시 설치해도 현장에서
        골라 둔 포트 설정은 그대로 이어집니다.
      </p>
    </section>
  );
}
