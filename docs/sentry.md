# Sentry (브라우저 오류 모으기)

컨트롤 웹과 송출 화면(onair-display)의 오류를 Sentry 로 보낸다. **DSN 이 없으면 아무것도 하지 않는다** — 지금 학교 서버는 그대로다.

## 켜는 법 (학교 서버 PC)

1. Sentry 에서 프로젝트 2개(Next.js): `onair-control`, `onair-display` → 각 DSN 복사
2. 각 저장소 `.env.local` 에
   ```
   NEXT_PUBLIC_SENTRY_DSN=<그 프로젝트의 DSN>
   NEXT_PUBLIC_SENTRY_ENV=production
   ```
   `NEXT_PUBLIC_` 값은 빌드할 때 들어가므로 **다시 빌드**해야 켜진다(ONAIR 업데이트가 빌드한다).
3. (선택) 소스맵 올리기 — 오류 위치를 원래 코드 줄로 보려면 빌드 환경에 `SENTRY_AUTH_TOKEN`·`SENTRY_ORG`·`SENTRY_PROJECT`.
   토큰이 없으면 올리지 않고 빌드만 한다.

DSN 은 브라우저 코드에 그대로 실리는 공개 값이다(보내기만 할 수 있다). 인증 토큰(`SENTRY_AUTH_TOKEN`)은 비밀 — 저장소에 넣지 않는다.

## 무엇을 보내나

- 오류만(성능 추적 0 — `NEXT_PUBLIC_SENTRY_TRACES` 로 바꿀 수 있음). 세션(충돌 없는 사용자 비율)도 간다.
- 개인 정보: `sendDefaultPii: false`(IP·쿠키·사용자 없음). `beforeSend` 에서 주소의 쿼리·조각(초대 코드·등록 토큰), 요청 헤더·
  쿠키(Cloudflare Access 토큰)를 지운다 — `src/lib/sentryOptions.ts`, 시험 `sentryOptions.test.ts`.
- 화면 전체가 멈추면(`app/global-error.tsx`) 보내고 '다시 시도'. 송출 화면은 글자 없이 검은 화면으로 두고 10초 뒤 다시 연다
  (전교에 나가는 화면이고 옆에 사람이 없다).

## 크기

SDK 를 DSN 이 있을 때만 따로 불러온다(`import("@sentry/nextjs")`).

| | 모든 페이지 공통 JS (Next 빌드 표, gzip) |
|---|---|
| Sentry 전 | 102 kB |
| 맨 위에서 바로 import | 169 kB (+67) — DSN 이 없어도 |
| 따로 불러오기 (지금) | 104 kB (+2) |

송출 화면 `/` 첫 JS: 326.6 → 327.5 kB(gzip). 대신 SDK 가 다 받아지기 전(페이지를 연 직후 아주 짧은 사이)의 오류는 놓칠 수 있다.

## 확인한 방법 (계정 없이)

가짜 수집 서버(로컬 8791)를 DSN 으로 주고 dev 서버에서 오류를 던졌다 → envelope 도착, 환경 이름 맞음, `?invite=SECRET123` 은
어디에도 없음, 헤더·쿠키·사용자 없음. 이때 Sentry 가 **원래 있던 버그를 바로 잡았다**: 시작 화면(Splash)이 크기 0 캔버스를
drawImage 해 오류 → 애니메이션 반복이 멈추고 시작 화면이 앱을 덮은 채 남음(키를 눌러야 넘어감). 같은 PR 에서 고침.
