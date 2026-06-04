import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// fs 접근 필요 → Node 런타임 고정 (Edge 아님)
export const runtime = "nodejs";

const CASTERS_FILE = path.join(process.cwd(), "src", "constants", "casters.ts");
const START_RE = /(\/\* AUTO-GENERATED:CASTERS:START[^\n]*\*\/\n)([\s\S]*?)(\/\* AUTO-GENERATED:CASTERS:END \*\/)/;

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
    if (!START_RE.test(src)) {
      return NextResponse.json(
        { ok: false, error: "casters.ts에서 AUTO-GENERATED 마커를 찾을 수 없습니다." },
        { status: 500 },
      );
    }
    const next = src.replace(START_RE, (_m, head, _body, tail) => `${head}${serializeBlock(casters)}${tail}`);
    // 원자적 쓰기 (임시파일 → rename)
    const tmp = CASTERS_FILE + ".tmp";
    await fs.writeFile(tmp, next, "utf-8");
    await fs.rename(tmp, CASTERS_FILE);
    return NextResponse.json({ ok: true, count: casters.length });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "파일 쓰기 실패" },
      { status: 500 },
    );
  }
}
