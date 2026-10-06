# ONAIR 데스크탑 앱

macOS·Windows 에서 ONAIR 컨트롤 화면을 여는 앱. (Tauri 2)

- 앱은 **얇은 껍데기**예요. 컨트롤 화면(Next 앱)은 앱에 넣지 않고 **서버에서 그대로** 불러와요. 서버를 업데이트하면 앱도 바로 바뀐 화면을 봐요.
- 서버는 Cloudflare Access 로 막혀 있어서 모든 요청(페이지·파일·`/api`·WebSocket)에 `CF-Access-Client-Id` / `CF-Access-Client-Secret` 헤더가 있어야 해요. 웹뷰는 WebSocket 에 헤더를 못 붙이니, **앱 안의 로컬 프록시(Rust)** 가 대신 붙여요. 접속 키는 JS 로 절대 넘어가지 않아요.
- 같은 프로젝트로 나중에 Android/iOS 도 빌드할 수 있게 구조를 맞춰 뒀어요 (`lib.rs` 의 `mobile_entry_point`, 키체인·메뉴·중복 실행 방지는 데스크탑에서만). 모바일 빌드는 아직 안 해요.

```
desktop/
├── index.html, src/        앱에 들어 있는 등록(#setup)·설정(#settings) 화면 (Vite + TS)
├── public/fonts/mbc.otf    MBC 1961 폰트
├── assets/icon.svg         아이콘 원본 → `npx tauri icon assets/icon.svg -o src-tauri/icons`
└── src-tauri/
    ├── tauri.conf.json     앱 이름 ONAIR, 식별자 kr.bssm.onair, onair:// 딥링크, 번들 설정
    ├── capabilities/       앱 화면만 명령 사용 (서버 화면은 IPC 없음)
    └── src/
        ├── lib.rs          창·메뉴·명령·딥링크
        ├── proxy.rs        로컬 프록시 (+ 테스트)
        ├── registration.rs 등록 링크 풀기, 서버 주소 규칙, 연결 확인
        ├── store.rs        키체인 저장
        └── pages.rs        프록시가 보여주는 대체 화면 (연결 실패·키 거부)
```

## 개발

필요한 것: Node 20+, Rust (stable), macOS 는 Xcode Command Line Tools, Windows 는 [WebView2 + VS Build Tools](https://v2.tauri.app/start/prerequisites/).

```bash
cd desktop
npm install
npm run tauri dev      # 앱 실행 (화면 수정은 바로 반영)
npm test               # = cargo test (프록시·등록 링크 테스트)
cd src-tauri && cargo test -- --ignored   # 실제 OS 키체인 저장/읽기/삭제 시험 (kr.bssm.onair.test 항목, 끝나면 지움)
```

- 화면만 보고 싶으면 `npm run dev` 후 브라우저로 `http://localhost:1420/#setup`, `http://localhost:1420/?preview=configured#settings` (가짜 응답으로 그려짐).
- 개발 중 키체인 팝업 없이 시험하려면 (디버그 빌드에서만) `ONAIR_DEV_CRED_FILE=/tmp/onair-cred.json npm run tauri dev` → 키체인 대신 그 파일에 저장해요.

## 빌드

### macOS (.app / .dmg)

```bash
cd desktop
npm run tauri build
# 결과: src-tauri/target/release/bundle/macos/ONAIR.app, bundle/dmg/ONAIR_0.1.0_aarch64.dmg
```

dmg 만들기에서 `bundle_dmg.sh` 가 실패하면(Finder 창 꾸미기를 AppleScript 로 하다가 막힘 — 원격·잠긴 화면에서 흔함) `CI=true npm run tauri build` 로 꾸미기 없이 만들어요.

서명: 키체인에 인증서가 있으면 환경변수로 지정해요 (설정 파일에 적지 않음).

```bash
security find-identity -v -p codesigning           # 쓸 수 있는 인증서 확인
APPLE_SIGNING_IDENTITY="Developer ID Application: …" npm run tauri build
```

- `Developer ID Application` 인증서 + 공증(`APPLE_ID`, `APPLE_PASSWORD`(앱 암호), `APPLE_TEAM_ID`)까지 하면 다른 Mac 에서도 경고 없이 열려요.
- `Apple Development` 인증서로 서명한 건 공증이 안 돼서 다른 Mac 에서는 아래 "그래도 열기"가 필요해요.
- 인텔·애플실리콘 둘 다: `rustup target add x86_64-apple-darwin aarch64-apple-darwin` 후 `npm run tauri build -- --target universal-apple-darwin`.

### Windows (.exe 설치 파일 / .msi)

Mac 에서는 Windows 빌드를 만들 수 없어요. 둘 중 하나로:

1. **GitHub Actions** — `.github/workflows/desktop.yml`. `desktop-v0.1.0` 같은 태그를 올리거나 Actions 탭에서 `desktop` 을 직접 실행하면 macOS(유니버설)·Windows 를 같이 빌드해서 초안 릴리스(태그일 때)와 Artifacts 에 올려요.
2. **Windows PC 에서 직접** — Node, Rust(`rustup` MSVC), VS Build Tools(“C++ 데스크톱 개발”) 설치 후
   ```powershell
   cd desktop
   npm ci
   npm run tauri build
   # 결과: src-tauri\target\release\bundle\nsis\ONAIR_0.1.0_x64-setup.exe, bundle\msi\ONAIR_0.1.0_x64_ko-KR.msi
   ```
   NSIS 설치 파일은 사용자 계정에만 설치(관리자 권한 필요 없음)하고, WebView2 가 없으면 설치 중에 받아요.

## 설치

- **macOS**: dmg 를 열고 ONAIR 를 응용 프로그램 폴더로 끌어 넣기. 공증 안 된 빌드라 처음 열 때 막히면
  `시스템 설정 → 개인정보 보호 및 보안 → 아래쪽 "ONAIR 이(가) 차단되었습니다" → 그래도 열기`.
  (또는 Finder 에서 ONAIR 를 Control+클릭 → 열기.) 딥링크(`onair://`)는 응용 프로그램 폴더에 넣은 앱으로 한 번 실행해야 등록돼요.
- **Windows**: `ONAIR_x.y.z_x64-setup.exe` 실행. SmartScreen("Windows의 PC 보호") 이 뜨면 `추가 정보 → 실행`. 코드 서명 인증서가 없어서 생기는 경고예요.

## 등록 (접속 키 · QR)

처음 실행하면(저장된 키 없음) 앱에 들어 있는 등록 화면이 떠요.

1. 방송부 관리자에게 **앱 등록 QR** 을 받아요. QR 안의 글자는
   `onair://register?d=<base64url JSON>` 이고, JSON 은
   ```json
   { "v": 1, "server": "https://onair.bssmcast.com", "clientId": "…access", "clientSecret": "…", "invite": "…", "exp": 1791900000 }
   ```
   (`exp` 는 만료 시각 unix 초 — 밀리초도 받아요. 선택: `api` = API 서버를 따로 둘 때 주소.)
2. 앱에 넣는 방법 셋 중 하나:
   - **링크 붙여넣기** — 링크 글자를 붙여넣기.
   - **QR 이미지** — 캡처를 ⌘V/Ctrl+V 로 붙여넣거나, 이미지 파일을 끌어다 놓거나 고르기 (jsQR 로 읽음, 이미지는 저장 안 함).
   - **링크 클릭** — `onair://…` 링크를 누르면 앱이 열리면서 칸이 채워져요 (딥링크).
   - **직접 입력** — 서버 주소, 접속 키 ID, 비밀 키. (고급: API 주소 따로.) Cloudflare 없이 학교망에서 바로 붙을 땐 키를 비워도 돼요.
3. **연결 확인하고 시작** → 프록시와 같은 헤더로 `GET <API>/api/members/me` 를 불러 봐요.
   - 200 → 저장, 404(서버에 회원 기능 아직 없음) → 그래도 저장.
   - 401/403·Cloudflare 로그인으로 돌림 → "접속 키가 거부됐어요" (저장 안 함).
   - 서버 꺼짐·5xx → 실패 표시 + **그래도 저장** 버튼.
4. 저장되면 바로 컨트롤 화면(프록시 경유)이 열려요. 회원 등록·승인 대기 화면은 컨트롤 UI 쪽이 보여줘요.

저장 위치: macOS 키체인 / Windows 자격 증명 관리자 / (Linux Secret Service), 서비스 이름 `kr.bssm.onair`, 계정 `credentials` 에 JSON 한 덩어리 (서버 주소, client id, secret, api, invite, 저장 시각).

## 설정 메뉴

`ONAIR → 설정…` (⌘, / Ctrl+,): 서버 주소 보기·복사, 접속 키(앞뒤 몇 글자) 보기 → **다시 입력**, **기록 폴더 열기**, **토큰 지우기**(한 번 더 물어봄 → 키체인에서 지우고 등록 화면으로).
그 밖의 메뉴: `보기 → 새로고침(⌘R)`, `컨트롤 화면 처음으로(⌘⇧H)`, 전체 화면.
기록(로그): macOS `~/Library/Logs/kr.bssm.onair/`, Windows `%LOCALAPPDATA%\kr.bssm.onair\logs\`. 비밀 키는 기록에 안 남겨요.

## 프록시 설계

```
웹뷰 ──▶ http://127.0.0.1:<포트>/…  (로컬 프록시, Rust: hyper + reqwest + tokio-tungstenite)
            │  CF-Access-Client-Id / Secret 붙임
            ├─ /api, /api/**/ws  ──▶ API 업스트림
            └─ 그 밖의 모든 경로  ──▶ 컨트롤 UI 업스트림
```

- **업스트림 정하기** (`registration::api_upstream`):
  - 서버 주소에 포트가 있으면(예: `http://100.95.97.82:3001`) 지금 구조 → API 는 같은 호스트 `:8000`.
  - 포트가 없으면(예: `https://onair.bssmcast.com`) Cloudflare 한 호스트 구조 → API 도 같은 주소의 `/api`.
  - 등록 링크/직접 입력의 `api` 로 따로 지정 가능. 경로 규칙은 `ProxyConfig.routes`(가장 긴 접두사 우선, `/` 단위로만 맞춤)라 나중에 경로를 더 나누기 쉬워요.
- **같은 주소 모드**: 웹뷰에 `window.__ONAIR_SAME_ORIGIN__ = true` 를 넣어요 (Tauri initialization script + 프록시가 HTML `<head>` 에도 한 번 더). 컨트롤 UI 의 `src/lib/backend.ts` 는 이 표시가 있으면 `:8000` 대신 `location.origin` 으로 `/api`·WebSocket 을 불러요. (서버 배포에서 `NEXT_PUBLIC_API_SAME_ORIGIN=1` 을 줘도 같은 모드.) 표시가 없으면 원래 동작 그대로.
- **헤더 처리**: 홉 헤더·Host 제거, 들어온 `CF-Access-*` 는 버리고 저장된 값으로 덮어씀(JS 가 흉내 못 냄), `Origin`/`Referer` 는 서버 주소로 바꿈, 리다이렉트 `Location`·`Set-Cookie`(Domain/Secure 제거)는 로컬 주소에 맞게 고침. WebSocket 은 서버 쪽에 먼저 CF 헤더로 연결한 뒤 웹뷰에 101 을 돌려주고 메시지를 양방향으로 넘겨요.
- **로컬 포트 보호**: 다른 프로그램·웹사이트가 이 포트로 키를 빌려 쓰지 못하게
  - 127.0.0.1 에만 열고, `Host` 가 `127.0.0.1:<포트>` 가 아니면 거부 (DNS 리바인딩 방지),
  - 앱이 실행마다 만드는 세션 키로 `/__onair/boot?k=…` → `HttpOnly; SameSite=Strict` 쿠키를 심고, 그 쿠키가 없는 요청은 403. (쿠키는 서버로 안 넘김.)
- **포트**: 처음엔 빈 포트를 아무거나 잡고, 다음부턴 같은 포트를 먼저 시도해요 (웹뷰 localStorage 가 주소(포트)마다 따로라 설정이 날아가지 않게). `app_config_dir/desktop.json` 에 저장.
- **대체 화면**: 서버 연결 실패(502) → "서버에 연결할 수 없어요 / 다시 시도", Cloudflare 가 막음 → "접속 키가 거부됐어요 / 다시 등록하기". 버튼은 `POST /__onair/action/{settings|setup}` 로 앱에 알려요.
- **보안 경계**: 서버에서 온 화면(127.0.0.1)에는 Tauri IPC 권한이 없어요 (`capabilities/default.json` 은 앱 자체 화면만). 비밀 키는 Rust 안에서만 쓰여요.

## 알려진 한계 / 할 일

- 현수막 미리보기 iframe(`displayAppBase()`, 디스플레이 앱 :3000)은 프록시를 안 거쳐요. Cloudflare 뒤에서는 디스플레이 앱도 같은 호스트 경로로 묶거나, `window.__ONAIR_DISPLAY_BASE__` 로 주소를 따로 줘야 해요.
- 컨트롤 화면에서 바깥 사이트로 이동하면 앱 안에서 열려요 (macOS 는 iframe 이동까지 같은 훅으로 와서 가로채지 않음). `보기 → 컨트롤 화면 처음으로` 로 돌아와요.
- 카메라로 QR 찍기는 없어요 (캡처 붙여넣기·파일만). 모바일 빌드 때 추가.
- `invite` 값은 저장만 하고 아직 안 써요 (회원 등록 API 가 정해지면 연결).
