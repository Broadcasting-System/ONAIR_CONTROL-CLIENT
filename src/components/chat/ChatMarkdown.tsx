"use client";

import { Fragment, type ReactNode } from "react";

/**
 * 도우미 답 — 아주 작은 마크다운(굵게·`코드`·[링크](/경로)·목록·표·제목·코드 블록).
 * HTML 로 넣지 않고 React 노드로 만든다(답에 섞인 태그는 글자 그대로 보인다).
 */

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "h"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "code"; text: string }
  | { kind: "hr" };

const UL = /^\s*[-*•]\s+(.*)$/;
const OL = /^\s*\d+[.)]\s+(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function cells(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

function parse(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.trim().startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) body.push(lines[i++]);
      i++; // 닫는 ``` (스트리밍 중이면 없을 수 있다)
      out.push({ kind: "code", text: body.join("\n") });
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      out.push({ kind: "hr" });
      i++;
      continue;
    }
    const h = /^\s*#{1,6}\s+(.*)$/.exec(line);
    if (h) {
      out.push({ kind: "h", text: h[1] });
      i++;
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(cells(lines[i++]));
      out.push({ kind: "table", head, rows });
      continue;
    }
    if (UL.test(line) || OL.test(line)) {
      const kind = UL.test(line) ? "ul" : "ol";
      const re = kind === "ul" ? UL : OL;
      const items: string[] = [];
      while (i < lines.length) {
        const m = re.exec(lines[i]);
        if (m) {
          items.push(m[1]);
          i++;
        } else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) {
          items[items.length - 1] += "\n" + lines[i].trim(); // 들여 쓴 이어지는 줄
          i++;
        } else break;
      }
      out.push({ kind, items });
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !UL.test(lines[i]) &&
      !OL.test(lines[i]) &&
      !lines[i].trim().startsWith("```") &&
      !/^\s*#{1,6}\s/.test(lines[i]) &&
      !(lines[i].includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]))
    ) {
      para.push(lines[i++]);
    }
    out.push({ kind: "p", lines: para });
  }
  return out;
}

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/g;

function Inline({ text, onLink }: { text: string; onLink: (href: string) => void }) {
  const parts = text.split(INLINE);
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null;
        if (p.startsWith("**") && p.endsWith("**") && p.length > 4)
          return (
            <strong key={i} className="font-semibold text-white">
              {p.slice(2, -2)}
            </strong>
          );
        if (p.startsWith("`") && p.endsWith("`") && p.length > 2)
          return (
            <code key={i} className="rounded bg-white/10 px-1.5 py-px font-mono text-[0.9em] text-white">
              {p.slice(1, -1)}
            </code>
          );
        const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(p);
        if (link) {
          const [, label, href] = link;
          if (href.startsWith("/"))
            return (
              <button
                key={i}
                type="button"
                onClick={() => onLink(href)}
                className="text-white underline decoration-white/40 underline-offset-2 hover:decoration-white"
              >
                {label}
              </button>
            );
          if (/^https?:\/\//.test(href))
            return (
              <a
                key={i}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-white underline decoration-white/40 underline-offset-2 hover:decoration-white"
              >
                {label}
              </a>
            );
          return <Fragment key={i}>{label}</Fragment>;
        }
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

function Lines({ text, onLink }: { text: string; onLink: (href: string) => void }) {
  const ls = text.split("\n");
  return (
    <>
      {ls.map((l, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          <Inline text={l} onLink={onLink} />
        </Fragment>
      ))}
    </>
  );
}

export default function ChatMarkdown({ text, onLink }: { text: string; onLink: (href: string) => void }) {
  const blocks = parse(text);
  const nodes: ReactNode[] = blocks.map((b, i) => {
    switch (b.kind) {
      case "h":
        return (
          <p key={i} className="pt-1 font-semibold text-white">
            <Inline text={b.text} onLink={onLink} />
          </p>
        );
      case "hr":
        return <hr key={i} className="border-white/10" />;
      case "code":
        return (
          <pre
            key={i}
            className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-[13px] leading-relaxed text-white/85"
          >
            {b.text}
          </pre>
        );
      case "ul":
      case "ol": {
        const List = b.kind === "ul" ? "ul" : "ol";
        return (
          <List
            key={i}
            className={b.kind === "ul" ? "list-disc space-y-1 pl-5 marker:text-white/40" : "list-decimal space-y-1 pl-5 marker:text-white/50"}
          >
            {b.items.map((it, k) => (
              <li key={k}>
                <Lines text={it} onLink={onLink} />
              </li>
            ))}
          </List>
        );
      }
      case "table":
        return (
          <div key={i} className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full border-collapse text-left text-[13.5px]">
              <thead>
                <tr className="bg-white/[0.05]">
                  {b.head.map((c, k) => (
                    <th key={k} className="whitespace-nowrap px-3 py-1.5 font-semibold text-white/70">
                      <Inline text={c} onLink={onLink} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, k) => (
                  <tr key={k} className="border-t border-white/[0.06]">
                    {b.head.map((_, c) => (
                      <td key={c} className="px-3 py-1.5 text-white/85">
                        <Inline text={r[c] ?? ""} onLink={onLink} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      default:
        return (
          <p key={i}>
            <Lines text={b.lines.join("\n")} onLink={onLink} />
          </p>
        );
    }
  });
  return <div className="flex flex-col gap-2.5 break-words">{nodes}</div>;
}
