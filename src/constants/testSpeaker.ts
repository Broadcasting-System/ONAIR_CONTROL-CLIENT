/**
 * 시험 스피커 — 학교 스피커 대신 최고 관리자 노트북(/test-speaker)에서 소리가 나는 가상 스피커.
 * 최고 관리자에게만 보이고, 다른 스피커와 같이 고를 수 없다 (서버도 막는다 — 서버 docs/test-speaker.md).
 */
export const TEST_SPEAKER_ID = "__test__";
export const TEST_SPEAKER_LABEL = "시험 스피커";

export const isTestSpeaker = (name: string | null | undefined) => name === TEST_SPEAKER_ID;

/** 대상 이름 → 보이는 이름 (시험 스피커만 바꾼다) */
export const speakerLabel = (name: string) => (isTestSpeaker(name) ? TEST_SPEAKER_LABEL : name);

/** 진짜 스피커를 고른 결과에서 시험 스피커를 뺀다 (섞지 않기) */
export const withoutTest = (names: string[]) => names.filter((n) => !isTestSpeaker(n));
