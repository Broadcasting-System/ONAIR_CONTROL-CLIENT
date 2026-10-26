# 폴링 점검 (2026-10-26)

컨트롤 웹이 서버에 주기적으로 묻는 곳 전수 점검. **TanStack Query `refetchInterval` 43곳 + 손으로 쓴 `setInterval` 8곳.**

## 원칙

- **장비·다른 기기·서버 작업이 바꾸는 값**(믹서·조명·매트릭스·스피커·녹음·종·요청함·부원 승인)은 폴링한다.
  서버가 장비 상태를 밀어 주는 길(WS·SSE)이 아직 없다. 송출 내용만 WebSocket 으로 받는다.
- **진행 중일 때만 빠르게**: 녹음 미터·만드는 중인 파일·종 2분 전·음악 조명 재생 중은 0.4~1초, 평소엔 3~15초
  (refetchInterval 을 함수로).
- **숨긴 탭에서는 멈춘다.** TanStack Query 는 기본값(`refetchIntervalInBackground: false`)이 그렇다. 손으로 쓴
  `setInterval` 은 숨겨도 계속 돌아서 `useVisibleInterval` 로 바꿨다(아래).
- 같은 키를 여러 화면이 쓰면 TanStack Query 가 한 번만 묻는다(`["bridges"]` 3곳, `["lighting", hall]` 2곳 — 짧은 쪽 간격).

## 손으로 쓴 setInterval 8곳 → 7곳을 `useVisibleInterval` 로

숨긴 탭·최소화한 앱에서 멈추고 다시 보이면 바로 한 번 묻는다(TanStack Query 와 같은 규칙). 숨긴 채 1분 둘 때 아끼는 요청:

| 위치 | 간격 | 숨긴 1분에 아끼는 요청 |
|---|---|---|
| `useSpeakers` (메인·스피커·리모컨·모바일 홈) | 5초 | 12 (+ 구역표 다시 읽기 최대 2) |
| `useHealth` (송출·리모컨) | 3초 / 리모컨 2초 | 20 / 30 |
| `useTimeGroups` (시보) | 4초 | 15 |
| `SchedulerPanel` (시보) | 3초 | 20 |
| `DevicesPanel` (기기) | 30초 | 2 |
| welcome 승인 대기 | 5초 | 12 |
| 내 기기 QR 띄운 동안 | 3초 | 20 |
| **그대로** `HlsVideo` live 주소 확인 | 5초 | — 학생이 탭을 숨기고 소리만 들을 수 있어 멈추지 않는다 |

간격 × 60초로 셈. 브라우저도 숨긴 탭의 타이머를 늦추는 경우가 있어(Chrome 은 오래 숨긴 탭을 1분에 1번까지) 실제로 아끼는
양은 그보다 작을 수 있다. 데스크톱 앱(Tauri)의 웹뷰는 그렇게 늦추지 않는 경우가 있어 효과가 더 크다.

## TanStack Query 43곳 — 모두 유지

| 위치 | 키 | 간격 | 바꾸는 쪽 | 판단 |
|---|---|---|---|---|
| hooks/useMixer | mixer | 미터 있으면 0.8초, 아니면 4초 | 콘솔·다른 기기 | 유지 (페이더 미터) |
| hooks/useLighting | lighting | 3초 | 조명 노드·다른 기기 | 유지 |
| hall/MusicLight | lighting | 빠른 모드 1초 / 3초 | 〃 | 유지 (같은 키, 짧은 쪽) |
| hooks/useMusicLight | musicLight | 재생 중 0.5초 / 4초 | 서버 음악 분석 | 유지 |
| hooks/useVideoMatrix | videoMatrix | 3초 | 매트릭스·다른 기기 | 유지 |
| hooks/useAutoAudio | autoAudio | 1초 | 서버 자동 믹싱(미터·동작 기록) | 유지 — 패널을 연 동안만 |
| hooks/useHalls | hallsStatus | 10초 | 장비 연결 | 유지 |
| NotebookPicker · MatrixConnectionForm · BridgePanel | bridges | 5초 | 현장 노트북 붙고 떨어짐 | 유지 (같은 키, 1번만) |
| devices/SpeakerMappingPanel | calibration / connection | 3초 / 10초 | 보정 진행·매트릭스 | 유지 |
| broadcast/MicPanel | live status | 3초 | 다른 기기 마이크 방송 | 유지 |
| hooks/useBellGuard | bell-guard | 종 2분 안 1초 / 3초 | 시보 | 유지 — **시보 안전장치, 손대지 않음** |
| hooks/useDeviceBell | device-bell | 보내는 중 5초 / 60초 | 장비 시보 전송 | 유지 |
| home/page | mobile bells | 30초 | 시보 | 유지 |
| hooks/useShowing | display showing | 10초 | 송출 | 유지 (채널 5개 각각 요청 — 아래 제안) |
| hooks/useNetworkStatus | networkStatus | 5초 | 서버 응답 시간 | 유지 (응답 시간을 재는 것이 목적) |
| hooks/useRecording | recording | 미터 0.4초 / 5초 | 녹음 장치 | 유지 |
| hooks/useRecording | recordings | 가져오는 중 1초 / 10초 | 서버 작업 | 유지 |
| hooks/useRecording | mergeJobs | 도는 중 1초 / 15초 | 서버 작업 | 유지 |
| hooks/useAv | av | 녹화 중 1초 / 3초 | 서버 녹화 | 유지 |
| hooks/useAv | av library | 만드는 중 1초 / 10초 | 서버 작업 | 유지 |
| hooks/useEnergy | energy | 30초 | 서버 예약 | 유지 |
| file/FileLibrary | file-usage | 10초 | 예약·시보·송출 | 유지 (요청 7개 묶음 — 아래 제안) |
| requests/RequestsPanel | request-counts / requests / request-teachers | 20초 / 15초 / 20초 | 선생님 | 유지 |
| teacher/TeacherApp | teacher-request / teacher-me / teacher-requests | 15초 / 상태별 / 상태별 | 방송부 | 유지 |
| teacher/InstantBroadcast | teacher-now-status | 내 방송 중 1초 / 3초 | 방송실 | 유지 |
| media/ExternalSharePanel | share | 창 연 동안 2초 / 8초 | 외부 발표자 | 유지 |
| live/LiveApp | live | 5초 | 서버 중계 | 유지 |
| logs/LogsView | access-logs | 5초 | 모든 기기 | 유지 — 로그 화면을 연 동안만 |
| chat/ChatPanel | chat status | 연 동안 60초 | 서버 | 유지 |
| devices/CloudflarePanel | cf status / mail / devices | 60초 / 30초 / 30초 | 관리자·Cloudflare | 유지 |
| devices/CrewView | crew | 30초 | 부원 | 유지 |
| devices/MembersPanel | members / member-invites | 5초 / 15초 | 새 부원 가입·승인 | 유지 |

## 남은 제안 (이번엔 안 함)

- **채널별 상태 묶음 API**: `useShowing` 과 `FileLibrary` 의 사용 중 표시가 채널 5개 상태를 각각 묻는다(10초마다 5개).
  서버에 `GET /api/display/status/all` 을 두면 1개로. 서버 변경이라 따로.
- **장비 상태 밀어 주기(SSE/WS)**: 믹서·조명·매트릭스 폴링(0.8~3초)을 서버가 바뀔 때만 보내면 요청이 크게 준다. 서버가 장비를
  어차피 폴링하므로(장비 쪽 프로토콜이 밀어 주지 않음) 서버 한 곳에서 묻고 여러 화면에 나눠 주는 구조.

## Zustand store

쓰지 않는 store 3개를 지웠다: `wsStore`·`fileStore`·`scheduleStore` — 처음 프로젝트를 세팅할 때(2026-02-17) 만든 뒤 어디서도
쓴 적이 없다(git 기록으로 확인). 서버 데이터는 TanStack Query 가 맡는다. 남은 store 는 모두 클라이언트 상태만 가진다: 조작 중인 송출 채널(`channelStore`),
스피커 구역 표시(`speakerStore`), CUE 패널 열림·대화(`chatStore`), 튜토리얼 단계(`tourStore`), 알림(`Toast`).
