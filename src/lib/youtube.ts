/** 다양한 유튜브 URL/ID에서 videoId 추출. 실패 시 null.
 *  지원: watch?v=, youtu.be/, /embed/, /live/, /shorts/, /v/, 순수 ID(11자). */
const ID_RE = /^[\w-]{11}$/;
const valid = (id: string | null | undefined): string | null =>
  id && ID_RE.test(id) ? id : null;

export function parseYouTubeId(input: string): string | null {
  if (!input) return null;
  const s = input.trim();

  // 이미 순수 videoId (11자)
  if (ID_RE.test(s) && !s.includes("/") && !s.includes(".")) return s;

  try {
    const u = new URL(s.includes("://") ? s : `https://${s}`);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return valid(u.pathname.slice(1).split("/")[0]);
    }
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      if (u.pathname === "/watch") return valid(u.searchParams.get("v"));
      const m = u.pathname.match(/^\/(embed|live|shorts|v)\/([\w-]+)/);
      if (m) return valid(m[2]);
    }
  } catch {
    /* invalid url */
  }
  return null;
}
