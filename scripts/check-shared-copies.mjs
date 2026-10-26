#!/usr/bin/env node
// 두 저장소(컨트롤·송출 화면)에 같은 코드로 둔 파일이 서로 같은지 본다 — docs/adr-monorepo.md 의 A안.
// 저장소를 합치지 않는 대신, 복사본이 어긋나면 CI 가 실패해서 한쪽만 고치고 끝나지 않게 한다.
//
//   node scripts/check-shared-copies.mjs --self control --other ../onair-display [--strict]
//
// 한쪽 저장소에만 있는 파일은 보통 알리기만 한다(한쪽 PR 이 먼저 들어간 사이). --strict 면 그것도 실패.
//
// 비교는 '코드'만: 주석·공백·줄바꿈·세미콜론·따옴표 종류·끝 쉼표는 저장소마다 스타일이 달라서 빼고,
// 남은 토큰(이름·연산자·문자열 값·숫자)이 같아야 같다고 본다. 목록은 scripts/shared-copies.json.
// 이 파일도 두 저장소에 같은 코드로 있다(목록에 들어 있음).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const argv = process.argv.slice(2);
const args = Object.fromEntries(
  argv.reduce((acc, a, i) => (a.startsWith("--") && argv[i + 1] && !argv[i + 1].startsWith("--") ? [...acc, [a.slice(2), argv[i + 1]]] : acc), []),
);
const strict = argv.includes("--strict");
const self = args.self;
const otherRoot = args.other;
if (!["control", "display"].includes(self) || !otherRoot) {
  console.error("사용법: node scripts/check-shared-copies.mjs --self control|display --other <다른 저장소 경로>");
  process.exit(2);
}
const other = self === "control" ? "display" : "control";
const selfRoot = process.cwd();

// typescript 는 두 저장소 모두 devDependencies 에 있다 — 토큰 나누기에만 쓴다
const ts = createRequire(path.join(selfRoot, "package.json"))("typescript");

const manifest = JSON.parse(fs.readFileSync(path.join(selfRoot, "scripts/shared-copies.json"), "utf8"));

/** 주석·공백을 빼고, 스타일 차이(; 따옴표 끝 쉼표)를 지운 토큰 목록 */
function tokens(text, file) {
  const variant = file.endsWith("x") ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard;
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, variant, text);
  const out = [];
  // 템플릿 문자열 `...${ 식 }...` — 식 안의 { } 깊이를 세어, 식을 닫는 } 에서 템플릿을 이어 읽는다
  const braces = [];
  for (let k = scanner.scan(); k !== ts.SyntaxKind.EndOfFileToken; k = scanner.scan()) {
    if (k === ts.SyntaxKind.OpenBraceToken && braces.length) braces[braces.length - 1]++;
    if (k === ts.SyntaxKind.CloseBraceToken && braces.length) {
      if (braces[braces.length - 1] === 0) {
        k = scanner.reScanTemplateToken(false);
        if (k === ts.SyntaxKind.TemplateTail) braces.pop();
      } else braces[braces.length - 1]--;
    }
    if (k === ts.SyntaxKind.TemplateHead) braces.push(0);
    if (k === ts.SyntaxKind.SlashToken || k === ts.SyntaxKind.SlashEqualsToken) {
      // 앞 토큰이 값이 아니면 나눗셈이 아니라 정규식
      const prev = out[out.length - 1];
      if (prev === undefined || /^(\(|,|=|==|===|!=|!==|:|\[|!|&&|\|\||\?|\{|\}|;|return|typeof|=>)$/.test(prev))
        k = scanner.reScanSlashToken();
    }
    if (k === ts.SyntaxKind.SemicolonToken) continue;
    let t = scanner.getTokenText();
    if (k === ts.SyntaxKind.StringLiteral) t = JSON.stringify(scanner.getTokenValue());
    if ((t === ")" || t === "]" || t === "}") && out[out.length - 1] === ",") out.pop(); // 끝 쉼표
    out.push(t);
  }
  return out;
}

/** 두 토큰 목록이 처음 갈라지는 곳을 사람이 읽을 수 있게 */
function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  const around = (xs) => xs.slice(Math.max(0, i - 6), i + 6).join(" ");
  return `토큰 ${i}번째부터 다름\n      ${self}:  …${around(a)}…\n      ${other}:  …${around(b)}…`;
}

let failed = 0;
let missing = 0;
for (const pair of manifest.files) {
  const mine = path.join(selfRoot, pair[self]);
  const theirs = path.join(otherRoot, pair[other]);
  const label = `${pair[self]}  ↔  ${other}:${pair[other]}`;
  const haveMine = fs.existsSync(mine);
  const haveTheirs = fs.existsSync(theirs);
  if (!haveMine || !haveTheirs) {
    // 한쪽 저장소의 PR 이 먼저 들어간 사이일 수 있다 — 알리기만 한다
    missing++;
    const where = !haveMine && !haveTheirs ? "두 저장소 모두" : !haveMine ? self : other;
    console.log(`  ?  ${label}  (${where} 에 아직 없음)`);
    continue;
  }
  const a = tokens(fs.readFileSync(mine, "utf8"), mine);
  const b = tokens(fs.readFileSync(theirs, "utf8"), theirs);
  if (a.length === b.length && a.every((t, i) => t === b[i])) {
    console.log(`  ✓  ${label}`);
  } else {
    failed++;
    console.log(`  ✗  ${label}\n      ${firstDiff(a, b)}`);
  }
}

console.log(
  `\n같은 코드 ${manifest.files.length - failed - missing}개 · 다름 ${failed}개 · 한쪽에만 ${missing}개` +
    (manifest.intentionallyDifferent?.length ? ` · 일부러 다른 파일 ${manifest.intentionallyDifferent.length}개(비교 안 함)` : ""),
);
if (failed || (strict && missing)) {
  console.log("\n다른 파일은 두 저장소에서 같이 고쳐야 한다 (docs/adr-monorepo.md).");
  process.exit(1);
}
