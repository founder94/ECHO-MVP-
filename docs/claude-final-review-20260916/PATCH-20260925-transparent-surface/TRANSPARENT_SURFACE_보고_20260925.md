# ECHO 대화 화면 버튼·입력창 투명 처리 보고 (2026-09-25)

근거: 대표 「TRANSPARENT BUTTON / SURFACE PATCH · FINAL」.

- 한 일: 로컬 수정과 로컬 검사.
- 하지 않은 일: 운영 배포.
- 대표 최신 Galaxy 캡처는 이번 메시지에 붙어 있지 않았다. 그래서 BEFORE 는 바로 앞 단계 빌드(흰 글자 + 어두운 유리)로 찍었다.

## 수정

- 파일: `src/doit/components/feature/core-conversation.css`(⑥ 블록 · 파일 끝 보내기 버튼 한 줄), `qa/conversation-pastel.test.mjs`
- 수정 Selector
  - `.echo-dialogue.echo-dialogue--pastel :is(textarea, .echo-secondary, .echo-restart-pill, .echo-opening-tile, .echo-brief, .echo-done, .echo-synthesis, .echo-restart, .echo-pause, .echo-insight, .echo-editor, .echo-reactions button:not(:first-child))`
  - 선택·누를 때: `.echo-opening-tile.is-selected`, `.echo-restart-pill:hover`, `.echo-reactions button:hover`
  - 보내기 버튼: `.echo-dialogue.echo-dialogue--pastel .echo-composer-footer button`
- 적용 범위는 대화 경로 루트(`.echo-dialogue--pastel`)뿐이다. 전역 button·textarea·card 규칙은 0건 변경이다.

| 대상 | Before Background | After Background |
|---|---|---|
| 처음부터 시작하기 · 하단 카드 · 입력창 · 목적 카드 · 안내/확인 카드 | `rgba(23,26,32,.65)` + 흐림 10px (계산값) | `transparent` · 흐림 없음 |
| 선택된 목적 카드 · 누를 때 | `rgba(34,38,46,.65)` | `transparent` |
| 보내기(↑) 버튼 | 회색 그라데이션 `#ebeeef → #bcc5d1` | `transparent` |

- 테두리
  - 버튼인 줄 알 수 있게 얇은 밝은 선만 남겼다: `#d9dfe8a6`(원래 「처음부터 시작하기」 테두리 값).
  - 전에는 white/14 였다. 투명 바탕 위에서는 거의 안 보였다.
- 선택 표시
  - 바탕 차이가 없어져서 선택된 카드는 흰 테두리 + 안쪽 1px(inset)로 표시한다.
  - 크기·자리 변화는 0이다.
- 바꾸지 않은 밝은 버튼(메탈 실버)
  - 대상: 주요 버튼(「이 말로 시작하기」·끝 화면 「사진과 소개 채우기」)과 확인 창의 첫 번째 버튼.
  - 이유: 검정·회색 박스가 아니라 밝은 은색 브랜드 버튼이다. 글씨도 짙은 색이라 이번 지시(흰 글씨 그대로)와 맞지 않는다.
  - 바꿀지는 대표가 정한다.

## 변경 0 확인

- 흰 글씨 변경 0건
  - 바꾸기 전·후 빌드의 계산값을 대조했다: 글자색 · 채움색 · 그림자 · 안내 글 색 — 18개 선택자 모두 차이 없음.
  - 근거 파일: `qa/surfaces-before.json`, `qa/surfaces-after.json`
- 파스텔 배경 0건 · 배치 0건
  - 기능 회귀 클릭(가짜 서버 기준) 360·390·430 **60/60**
- 히어로·홈페이지: 4폭 픽셀 차이 0
- Agent · 서버 · Sound · DB 0건

## 검사 (가짜 서버 기준 · 실기기 아님)

| 항목 | 결과 |
|---|---|
| type-check · lint · build 2 · audit | 0 · 0 · 0 · 취약점 0 |
| 전체 검사 | 530개 중 525 통과 / 0 실패 / 미확정 5 (전과 같은 목록) |
| 새 검사 5/5 · 역검사 | 5/5 잡음 (검정 채움 되살림 · 흐림 되살림 · 보내기 회색 남김 · 입력창 빠짐 · 선택 표시 없앰) |
| 캡처 40장 (360·390·430·1440 × 5상태 × 위·아래) | 가로 넘침 0 · 화면 오류 0 |
| 검정·회색 채움 | 0 (위 대상 모두 transparent, 흐림 none — 계산값) |
| 파스텔 투과 | YES (캡처) |

## 정직한 결과 — 버튼·입력창 안 글씨가 읽히지 않는다

- 지시대로 글씨(색·그림자)는 그대로 두었다.
  - 이 글씨들은 어두운 바탕 위에서 읽히게 만든 색이다: 흰색 · `#dbe0e7` · 그림자 없음.
  - 바탕이 투명해지자 밝은 파스텔 위에 그대로 놓였다.
- 실측(360·390·430 × 첫 질문·선택·질문 × 위·아래 스크롤): 판 안 글자 **115개 모두 기준 미달**이다.
  - 대비: 최저 1.0 · 중앙 1.25 · 최고 1.49 (기준 4.5:1)
  - 「처음부터 시작하기」 1.07~1.2
  - 입력창 안내 글 1.01~1.14
  - 「사진과 소개 채우기」 1.27~1.34
  - 목적 카드 제목 1.4~1.49
  - 목적 카드 설명 1.03~1.32
- 캡처로 봐도 노랑·코랄 구간의 설명 글씨는 거의 보이지 않는다(`전후비교_투명버튼_390.png`).
- **판정: 투명 처리 PASS / 버튼 안 글씨 가독성 FAIL — 대표 결정이 필요하다.**
  - 권장안: 파스텔 위 글자에 이미 쓰는 그림자(`--conversation-text-halo`)를 버튼 안 글씨에도 같게 준다.
  - 이것은 글씨 그림자 변경이라 이번 지시에서는 금지였다. 대표 승인이 있어야 한다.
  - 그래도 파스텔 위 글자와 같은 한계(글자 옆 약 2:1)가 남는다.

## 앱 ZIP 후보 (전달 전 · 운영 배포 0)

- 파일: `1_APP_여기에올릴것_doitmobile.zip`
  - SHA-256 `7c9ad6088f375417934f258d454088bf8e0d659fa977aa07d886d2a1910c9aac`
  - 3,056,601바이트 · 149개 파일
- 확인: 풀어서 빌드 폴더와 차이 0 · 소스맵 0 · .env 0
- 앞선 후보 `3c75eb1a…`를 대체한다. 홈페이지 ZIP 은 필요 없다.
- **Conversation P0 = FAIL 유지.**
