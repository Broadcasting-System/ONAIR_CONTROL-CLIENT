export type SpeakerCell = { label: string } | null;

export const SPEAKER_MATRIX: SpeakerCell[][] = [
  [
    { label: "1-1" }, { label: "1-2" }, { label: "1-3" }, { label: "1-4" },
    null, null, null, null,
    { label: "2-1" }, { label: "2-2" }, { label: "2-3" }, { label: "2-4" },
    null, null, null, null,
  ],
  [
    { label: "3-1" }, { label: "3-2" }, { label: "3-3" }, { label: "3-4" },
    null, null, null, null, null, null, null, null, null, null, null, null,
  ],
  [
    { label: "교행연회" }, { label: "교사연구" }, { label: "협동조합" }, { label: "보건/학" },
    { label: "컴퓨터12" }, { label: "과학준비" }, { label: "창의준비" }, { label: "남여휴게" },
    { label: "교무실" }, { label: "학생식당" }, { label: "위클/회" }, { label: "프로그12" },
    { label: "교무2지" }, { label: "진로연구" }, { label: "영어/모" }, { label: "창의공작" },
  ],
  [
    { label: "B1층복도" }, { label: "A1층복도" }, { label: "B2층복도" }, { label: "A2층복도" },
    { label: "A3층복도" }, { label: "강당" }, { label: "방송실" },
    { label: "SRC1-1" }, { label: "SRC1-2" }, { label: "SRC1-3" }, { label: "SRC2-1" },
    { label: "창의관" }, null, null,
    { label: "운동장" }, { label: "옥외" },
  ],
];

export const SPEAKER_ITEMS: { label: string }[] = SPEAKER_MATRIX
  .flat()
  .filter((cell): cell is { label: string } => cell !== null);
