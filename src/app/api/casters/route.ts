import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// fs 접근 필요 → Node 런타임 고정 (Edge 아님)
export const runtime = "nodejs";

const CASTERS_FILE = path.join(process.cwd(), "src", "constants", "casters.ts");
const START_RE = /(\/\* AUTO-GENERATED:CASTERS:START[^\n]*\*\/\n)([\s\S]*?)(\/\* AUTO-GENERATED:CASTERS:END \*\/)/;
// 마커가 유실/훼손됐을 때의 폴백: CASTERS 배열 선언 블록 자체를 찾는다.
const BLOCK_RE = /export\s+const\s+CASTERS\s*:\s*Caster\[\]\s*=\s*\[[\s\S]*?\];/;
// 마커를 새로 심거나 복구할 때 쓰는 표준 마커 텍스트.
const START_MARKER =
  "/* AUTO-GENERATED:CASTERS:START — 편집 UI가 이 블록을 재작성. 직접 수정 가능하나 형식(한 줄 1객체) 유지 권장 */";
const END_MARKER = "/* AUTO-GENERATED:CASTERS:END */";
// 짝이 안 맞는 등 흩어진 마커 잔재를 제거하기 위한 패턴(줄 단위).
const STRAY_MARKER_RE = /^[ \t]*\/\* AUTO-GENERATED:CASTERS:(?:START|END)[^\n]*\*\/[ \t]*\n?/gm;

type Caster = {
  id: string;
  name: string;
  cohort: number;
  role: "leader" | "member";
  title?: string;
  bio?: string;
};

function sanitize(raw: unknown): Caster[] {
  if (!Array.isArray(raw)) throw new Error("casters는 배열이어야 합니다.");
  return raw.map((c, i) => {
    if (typeof c !== "object" || c === null) throw new Error(`항목 ${i} 형식 오류`);
    const o = c as Record<string, unknown>;
    const name = String(o.name ?? "").trim();
    if (!name) throw new Error(`항목 ${i}: 이름은 필수입니다.`);
    const cohort = Number(o.cohort);
    if (!Number.isFinite(cohort)) throw new Error(`항목 ${i}(${name}): 기수는 숫자여야 합니다.`);
    const role = o.role === "leader" ? "leader" : "member";
    const id = String(o.id ?? "").trim() || `${cohort}-${name}`;
    const out: Caster = { id, name, cohort, role };
    const title = typeof o.title === "string" ? o.title.trim() : "";
    if (title) out.title = title;
    const bio = typeof o.bio === "string" ? o.bio : "";
    if (bio && bio.trim()) out.bio = bio;
    return out;
  });
}

/** casters.ts의 한 줄 1객체 형식과 동일하게 직렬화 (JSON.stringify 키 순서: id,name,cohort,role,title,bio) */
function serializeBlock(casters: Caster[]): string {
  const lines = casters.map((c) => {
    const o: Record<string, unknown> = {
      id: c.id,
      name: c.name,
      cohort: c.cohort,
      role: c.role,
    };
    if (c.title) o.title = c.title;
    if (c.bio) o.bio = c.bio;
    return "  " + JSON.stringify(o) + ",";
  });
  return `export const CASTERS: Caster[] = [\n${lines.join("\n")}\n];\n`;
}

export async function PUT(req: Request) {
  // 프로덕션 빌드본에선 소스 수정이 반영되지 않으므로 차단 (운용은 dev 모드)
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "프로덕션에서는 편집이 비활성화됩니다 (dev 모드에서만 가능)." },
      { status: 403 },
    );
  }

  let casters: Caster[];
  try {
    const body = await req.json();
    casters = sanitize(body?.casters);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "잘못된 요청" },
      { status: 400 },
    );
  }

  try {
    const src = await fs.readFile(CASTERS_FILE, "utf-8");

    let next: string;
    let healed = false;
    if (START_RE.test(src)) {
      // 정상 경로: 마커 사이 블록만 교체 (마커는 그대로 보존)
      next = src.replace(START_RE, (_m, head, _body, tail) => `${head}${serializeBlock(casters)}${tail}`);
    } else if (BLOCK_RE.test(src)) {
      // 마커 유실/훼손 → 잔재 마커 제거 후 CASTERS 블록을 마커와 함께 재작성(self-heal).
      // 이후 저장부터는 다시 정상 경로를 탄다.
      next = src
        .replace(STRAY_MARKER_RE, "")
        .replace(BLOCK_RE, `${START_MARKER}\n${serializeBlock(casters)}${END_MARKER}`);
      healed = true;
    } else {
      // CASTERS 배열 선언 자체가 없음 = 심각한 훼손. 자동 복구 대신 안내.
      return NextResponse.json(
        {
          ok: false,
          error:
            "casters.ts에서 CASTERS 블록을 찾지 못했습니다. 파일이 훼손됐을 수 있어요 (git으로 복구를 권장).",
        },
        { status: 500 },
      );
    }

    // 원자적 쓰기 (임시파일 → rename)
    const tmp = CASTERS_FILE + ".tmp";
    await fs.writeFile(tmp, next, "utf-8");
    await fs.rename(tmp, CASTERS_FILE);
    return NextResponse.json({ ok: true, count: casters.length, healed });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "파일 쓰기 실패" },
      { status: 500 },
    );
  }
}
