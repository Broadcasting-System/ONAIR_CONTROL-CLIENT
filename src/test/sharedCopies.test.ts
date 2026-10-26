/** scripts/check-shared-copies.mjs — 스타일만 다르면 같다, 코드가 다르면 어느 파일인지 알리고 실패 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repo = path.resolve(import.meta.dirname, "../..");
const script = path.join(repo, "scripts/check-shared-copies.mjs");
let tmp = "";

/** 두 저장소 흉내 — 목록에는 파일 하나(a.ts ↔ lib/a.ts) */
function setup(controlCode: string, displayCode: string | null) {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "shared-"));
  const control = path.join(tmp, "control");
  const display = path.join(tmp, "display");
  fs.mkdirSync(path.join(control, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(display, "lib"), { recursive: true });
  fs.writeFileSync(path.join(control, "package.json"), "{}");
  fs.symlinkSync(path.join(repo, "node_modules"), path.join(control, "node_modules"));
  fs.writeFileSync(
    path.join(control, "scripts/shared-copies.json"),
    JSON.stringify({ files: [{ control: "a.ts", display: "lib/a.ts" }] }),
  );
  fs.writeFileSync(path.join(control, "a.ts"), controlCode);
  if (displayCode !== null) fs.writeFileSync(path.join(display, "lib/a.ts"), displayCode);
  return { control, display };
}

function run(dirs: { control: string; display: string }, ...extra: string[]) {
  try {
    const out = execFileSync("node", [script, "--self", "control", "--other", dirs.display, ...extra], {
      cwd: dirs.control,
      encoding: "utf8",
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status: number; stdout: string };
    return { code: err.status, out: err.stdout };
  }
}

afterEach(() => {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

const CONTROL = `// 컨트롤 저장소 주석
import { x } from "./x";
export const re = /[?#].*$/;
export function f(a: number, b: string) {
  return \`\${a}-\${b}\`.replace(re, "");
}
const o = { a: 1, b: [1, 2, 3], };
`;

describe("check-shared-copies", () => {
  it("주석·세미콜론·따옴표·끝 쉼표·줄바꿈만 다르면 같다", () => {
    const display = `/** 송출 화면 저장소 주석은 달라도 된다 */
import { x } from './x'
export const re = /[?#].*$/
export function f(
  a: number,
  b: string,
) {
  return \`\${a}-\${b}\`.replace(re, '')
}
const o = { a: 1, b: [1, 2, 3] }
`;
    const r = run(setup(CONTROL, display));
    expect(r.code).toBe(0);
    expect(r.out).toContain("✓  a.ts");
  });

  it("코드가 다르면 그 파일과 갈라지는 곳을 알리고 실패한다", () => {
    const r = run(setup(CONTROL, CONTROL.replace("[1, 2, 3]", "[1, 2, 4]")));
    expect(r.code).toBe(1);
    expect(r.out).toContain("✗  a.ts");
    expect(r.out).toMatch(/3 \] }[\s\S]*4 \] }/);
  });

  it("템플릿 문자열 안의 글자가 다르면 다르다", () => {
    const r = run(setup(CONTROL, CONTROL.replace("}-${b}", "}_${b}")));
    expect(r.code).toBe(1);
  });

  it("한쪽에만 있으면 알리기만 하고, --strict 면 실패한다", () => {
    const dirs = setup(CONTROL, null);
    expect(run(dirs).code).toBe(0);
    expect(run(dirs).out).toContain("display 에 아직 없음");
    expect(run(dirs, "--strict").code).toBe(1);
  });
});
