# POST-CLAUDE FINAL MASTER 병합 기록 (2026-09-25)

## 근거
대표 PDF 「ECHO POST-CLAUDE FINAL IMPLEMENTATION MASTER」(2026-09-25).
- 이 PDF 는 앞서 한 운영 배포(`AGENT_PROD_보고_20260925.md`)에 덧붙이는 결정이다.

## 실측으로 확인한 것 (추측 없음)
- **히어로 카피**: PDF 는 「당신이 잠든 사이, AI가 먼저 만나봅니다.」를 히어로 핵심 카피라고 적었다.
  - 이 문장은 현재 히어로(DoItBrandHero)에 없다.
  - 실제 위치: 연결 화면(`AsleepConnections.tsx`) 제목, 홈페이지 흐름 구간(`BrandSections.tsx`), 옛 히어로 경로(`/do-it/hero`, `/do-it/2`).
  - 그 자리 그대로 둔다. 히어로에는 넣지 않는다(히어로 LOCK · 「기억으로 새로 쓰지 않는다」).
- **운영 히어로 문구 두 가지**
  - 운영 홈페이지(do-it.company, Netlify `echo-mvp-doit` 배포 `6ab43fd0…`) = 「사람은 프로필보다…」 + 「지금 시작하기」
  - 운영 앱(app.do-it.company, Netlify `doitmobile` 배포 `6ab576b1…`) = 「좋아하는 사람보다…」 + 「ECHO 시작하기」(09-24 승인본)
- **사진 저장 칸**: `profile_photos` 칸은 id·user_id·slot·storage_path·is_primary·created_at·updated_at 뿐이다.
  - 최근 2개월 확인 상태를 저장할 칸이 없다.
- **Netlify 사이트**
  - `doitmobile` (ff078012…) = app.do-it.company
  - `echo-mvp-doit` (7a4934db…) = do-it.company
- **관리자 화면**은 앱 빌드에서 동작한다. 홈페이지는 /admin 을 앱 주소로 보낸다.
  - 홈페이지 빌드에도 관리자 코드 조각이 들어 있다(이미 알려진 구조 문제). 경로가 없어 열리지 않는다.

## 이번에 반영한 것
- **시작 선택창(§4)**
  - 문구: 「당신의 결을 알려주세요. 5번의 대화면 충분합니다.」
  - 주요 버튼 두 개: [말로 시작하기] [글로 시작하기] — 누르면 바로 시작한다.
  - 말투는 「말투 · 편한 존댓말 ▾」로 접어 두고, 필요할 때만 펼쳐서 3종 중 고른다.
  - 창만 무채색이다. 덮개·흐림·스크롤 잠금은 0이다.
- **관리자(§13)**: 이미 있는 칸만 읽어 보여 준다.
  - 사진 장수·대표 사진·마지막 업로드 시각
  - 「진행 중 하루 넘게 멈춤」(중도 이탈 후보)
  - 최근 2개월 확인 상태: 「기록 없음(저장 칸 없음)」으로 표시
  - 사진 파일·주소는 주지 않는다.
- **서버** `doit-agent` 버전 2
  - index.ts `8d258c35…`, agent.ts `028acd28…`(실제 AI run 9 와 같은 파일)
  - 운영에서 내려받아 글자 단위로 같음을 확인했다. 무인증·가짜 토큰은 401이다.
- **FI**: 후보 7종을 장부 P-18 에 CANDIDATE 로 적었다. 실제 발생 전이라 ACTUAL 승격은 0이다.

## STOP (승인 전 안 함)
- **Photo Trust 상태 저장**
  - 필요한 변경: `profile_photos` 에 칸 하나(예: 최근 사진 확인 상태 + 확인 시각)를 더하는 마이그레이션
  - 영향: 새 개인정보 처리 — 약관·처리방침 문구가 필요하다.
  - 비용: 0
  - 되돌리기: 칸 삭제
  - 장부 B-11
- **실시간 음성**: 서버 함수 추가와 키 사용 승인이 필요하다(`VOICE_RESEARCH_20260925.md`).
- **매칭 후보 카드와 「ECHO가 연결한 이유」**
  - 연결 서버가 아직 에이전트 프로필을 읽지 않는다. 가짜 이유는 만들지 않는다.
  - 연결 서버에 붙이려면 doit-connect 수정과 운영 배포가 필요하다. 대표 결정.

## ZIP 3종
| 파일 | 크기 | SHA-256 | 파일 수 | 맨 위 폴더 | 올릴 곳 |
|---|---|---|---|---|---|
| A_SOURCE_ECHO_정본_20260925.zip | 4,335,193 | 114be615627ee614db49286558967c41b74987ab81a347a3c3a36e94a68fc2dd | 764 | CLAUDE.md · docs · product | 보관용(올리지 않음) |
| B_APP_app.do-it.company_doitmobile.zip | 3,067,348 | 9f94fa38476e4871f964d126396599bd2cedf79405da3dc4ab36588378e4a5a6 | 150 | _headers · _redirects · assets · brand · favicon.svg · index.html · manifest.webmanifest · pwa | Netlify `doitmobile` |
| C_BRAND_do-it.company_echo-mvp-doit.zip | 2,962,671 | bcb20060bf1f433cf62ae7304acfe7e6ba0f5d6ca1af20febbcb5d83b66cfc3a | 107 | (위와 같은 구성) | Netlify `echo-mvp-doit` — **올리지 않는 것이 기본** |

- B·C 에는 소스맵·.env·키가 0이다. A 에는 비밀키 0, `.env.example` 은 빈 자리만 있다.
- C 를 올리면 운영 홈페이지 히어로 문구가 09-24 승인본으로 바뀐다. 디자인 LOCK 때문에 대표 결정이 필요하다(장부 P-17).

## 검사 (가짜 기준 · 실제 AI 는 run 9)
- 서버 9/9 · 화면 6/6 · 브라우저 57/57
- 히어로 회귀(운영 앱 빌드 대비) 20/20: 픽셀 차이 0
- tsc · lint · 서버 엄격 타입 0
- FI 검사 9/9
