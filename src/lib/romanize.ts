/**
 * 한글 이름 → 메일 ID 제안 (등록 화면에서 미리 채우는 값 — 사람이 고칠 수 있다).
 *
 * 국어의 로마자 표기법(초성·중성·종성 표)을 기본으로, 이름에서 흔히 쓰는 표기 하나만 더했다:
 * 받침이 있는 ㅓ·ㅕ 는 u·yu 로 (정 jung · 현 hyun · 범 bum · 성 sung), 받침 없는 ㅓ 는 eo 그대로 (서 seo).
 * 그래서 서정현 → junghyun, 김민서 → minseo, 구범준 → bumjun.
 * 소리 바뀜(자음동화 등)은 따로 하지 않는다 — 받침 ㄹ 뒤 초성 ㄹ 만 ll 로.
 */

const INITIAL = [
  "g",
  "kk",
  "n",
  "d",
  "tt",
  "r",
  "m",
  "b",
  "pp",
  "s",
  "ss",
  "",
  "j",
  "jj",
  "ch",
  "k",
  "t",
  "p",
  "h",
];
const MEDIAL = [
  "a",
  "ae",
  "ya",
  "yae",
  "eo",
  "e",
  "yeo",
  "ye",
  "o",
  "wa",
  "wae",
  "oe",
  "yo",
  "u",
  "wo",
  "we",
  "wi",
  "yu",
  "eu",
  "ui",
  "i",
];
const FINAL = [
  "",
  "k",
  "k",
  "k",
  "n",
  "n",
  "n",
  "t",
  "l",
  "k",
  "m",
  "l",
  "l",
  "l",
  "p",
  "l",
  "m",
  "p",
  "p",
  "t",
  "t",
  "ng",
  "t",
  "t",
  "k",
  "t",
  "p",
  "t",
];
const EO = 4; // ㅓ
const YEO = 6; // ㅕ
const IEUNG = 11; // 초성 ㅇ
const RIEUL_INITIAL = 5; // 초성 ㄹ
const RIEUL_FINAL = 8; // 받침 ㄹ
const NG_FINAL = 21; // 받침 ㅇ

/** 두 글자 성 — 이걸로 시작하는 네 글자 이상 이름은 앞 두 글자를 성으로 본다 */
const COMPOUND_SURNAMES = [
  "남궁",
  "제갈",
  "선우",
  "황보",
  "독고",
  "사공",
  "서문",
  "동방",
  "어금",
  "망절",
];

const isHangul = (c: number) => c >= 0xac00 && c <= 0xd7a3;

/** 한글 음절들을 로마자로. 한글이 아닌 글자는 그대로 둔다 */
export function romanize(text: string): string {
  let out = "";
  let prevFinal = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (!isHangul(code)) {
      out += ch;
      prevFinal = 0;
      continue;
    }
    const n = code - 0xac00;
    const ini = Math.floor(n / 588);
    const med = Math.floor((n % 588) / 28);
    const fin = n % 28;
    let vowel = MEDIAL[med];
    if (fin !== 0 && med === EO) vowel = "u";
    if (fin !== 0 && med === YEO) vowel = ini === IEUNG && fin === NG_FINAL ? "you" : "yu"; // 영 → young
    const head = ini === RIEUL_INITIAL && prevFinal === RIEUL_FINAL ? "l" : INITIAL[ini];
    out += head + vowel + FINAL[fin];
    prevFinal = fin;
  }
  return out;
}

/** 성을 뺀 이름. 한글이 아니면 그대로 */
export function givenName(name: string): string {
  const n = name.replace(/\s+/g, "");
  if (!/^[가-힣]+$/.test(n)) return name.trim();
  if (n.length >= 4 && COMPOUND_SURNAMES.includes(n.slice(0, 2))) return n.slice(2);
  return n.length >= 2 ? n.slice(1) : n;
}

const clean = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 20);

/** 이름 → 메일 ID 제안. 이름만으로 3자가 안 되면 성까지 붙인다 (이안 → ian) */
export function suggestMailId(name: string): string {
  const given = clean(romanize(givenName(name)));
  if (given.length >= 3) return given;
  const full = clean(romanize(name.replace(/\s+/g, "")));
  return full.length > given.length ? full : given;
}

/** 서버(app/services/mail_address.py)와 같은 규칙 — 틀리면 이유, 맞으면 "" */
export const RESERVED_MAIL_IDS = [
  "admin",
  "lead",
  "all",
  "root",
  "postmaster",
  "abuse",
  "noreply",
  "no-reply",
  "hostmaster",
  "webmaster",
  "mailer-daemon",
];

export function mailIdProblem(id: string): string {
  if (!id) return "메일 주소가 비어 있어요";
  if (!/^[a-z0-9.]+$/.test(id)) return "영문 소문자·숫자·점만 쓸 수 있어요";
  if (id.length < 3 || id.length > 20) return "3~20자여야 해요";
  if (!/^[a-z0-9]+(\.[a-z0-9]+)*$/.test(id))
    return "점 위치가 올바르지 않아요";
  if (RESERVED_MAIL_IDS.includes(id)) return `'${id}' 는 쓸 수 없어요`;
  return "";
}

export function personalEmailProblem(email: string, domain: string): string {
  if (!email) return "";
  if (email.length > 120 || !/^[^@\s]+@[^@\s]+\.[^@\s.]+$/.test(email))
    return "메일 주소가 올바르지 않아요";
  if (domain && email.toLowerCase().endsWith(`@${domain}`))
    return `@${domain} 주소는 쓸 수 없어요`;
  return "";
}

export const cohortPrefix = (cohort: number | string | null | undefined): string => {
  const n = Number(cohort);
  return Number.isInteger(n) && n >= 1 && n <= 99 ? String(n).padStart(2, "0") : "";
};
