# 모바일웹 Flora 전면 적용 — 2026-10-10

대표 지시(2026-10-10): 「기존 모바일디자인 데이터에서 지워 … 코드랑 디자인 시안 그대로 구현해 이디자인에 무조건 맞춘다 … 후킹박고」,
「모바일웹 전부 최종 후킹박고 완성한다 … 한글은 주아체, 영어·숫자만 Chakra Petch」.

이 문서는 실제 ECHO 앱(`/doit/*`, `src/doit`)의 화면 옷을 Flora(Stemline) 시안으로 바꾼 범위와 기준이다.
홈페이지는 `HOMEPAGE_WEB_FINAL_LOCK_2026-10-10.md`(잠금)를 따른다.

## 1. 바뀐 것과 바뀌지 않은 것

| 구분 | 내용 |
|---|---|
| 바뀜 | 배경·색·유리 카드·버튼·글꼴·모서리·대표 그림(리본 → 민들레)·찌릿 장면(Lattice)·후킹 문장 |
| 그대로 | 서버 상태값, 버튼이 하는 일, 라우트, 질문을 만드는 방식, SCENE 3 네 버튼 문구, 동의·결제·로그인 흐름 |

화면 코드가 단계 완료·연결 성립을 새로 확정하는 곳은 없다. 찌릿 화면은 서버가 `mutual`을 돌려준 뒤에만 열린다(기존과 같음).

## 2. Flora 원본 → 앱 대응

| Flora 원본 | 앱 위치 | 바꾼 값 |
|---|---|---|
| `BackdropGradient` (Kindle, `homeHeroBackdrop`) | `src/doit/flora/backdrop-gradient.ts`, `FloraBackdrop.tsx` — 모든 앱 화면 뒤 | 없음. 손가락 기기 30fps, 움직임 줄이기면 한 장면만 |
| `DandelionScene` (`homeHeroScene`) | `src/doit/flora/scene/*`, `FloraBloom.tsx` — 홈·시작·대화 시작·목적 고르기·대화 머리 | 가운데 정렬(`frameOffsetX 0`), 입자 42만 개 고정, 처음부터 보이게(`fade 1`), 날아가는 카드 제외(Stemline 숫자) |
| 밤하늘 색 `#010b24`, 유리 6% + 1px 선, 모서리 4px, 강조 연두 `#bbfc9e`, 글자 `#050b14` | `flora-theme.css`(가장 마지막에 불러옴) | 없음 |
| Einstein–Rosen Lattice | `src/doit/flora/erl-engine.ts`, `LatticeStage.tsx` — 두 사람이 서로 선택한 「찌릿」 화면 | three 0.186에 맞게 이름만 바꿈(WebGLRenderer·PlaneGeometry). 셰이더 그대로 |

WebGL이 안 되면 그림 자리만 비우거나 은은한 빛으로 바꾸고, 글과 버튼은 그대로 쓸 수 있다.

## 3. 글꼴

- 한글: 주아체(Jua) — `src/fonts/jua.css`
- 영어·숫자: Chakra Petch 400/500 — `src/fonts/chakra-petch.css`, 파일은 `public/fonts/chakra-petch`(OFL, `LICENSE.txt`)
- 쌓는 순서 `'Chakra Petch','Jua',…` : Chakra Petch에 한글이 없으므로 한글은 저절로 주아체로 그려진다.
- 굵기 500 하나, 가짜 굵게(`font-synthesis`) 끔. 제목은 줄 끝 균형(`text-wrap:balance`), 낱말 중간 줄바꿈 안 함(`word-break:keep-all`).
- 외부 글꼴 링크 0(아이콘 글꼴만 기존 그대로).

## 4. 후킹 문장(대표 승인 문구만 사용)

| 화면 | 문장 |
|---|---|
| 첫 화면(동의 전) | 당신이 잠든 사이 / AI가 먼저 만나봅니다 |
| 이해 확인(SCENE 3) | 내 뜻과 다르면, / 바로 고칠 수 있어요. — 당신이 직접 들려준 이야기가 이해와 추천의 기준이 됩니다. |
| ECHO가 아는 나 | 같은 두 문장(작은 글) |
| 잠든 사이 연결 | 서로 선택하면, / 연결이 시작됩니다. — 나는 말하고, 찾는 건 ECHO가 해요. |
| 후보 목록 | 추천은 시작일 뿐, 선택은 당신의 몫이에요. |
| 찌릿 | 찌릿! 텔레파시가 통했어요 / 서로의 선택이, / 하나의 대화로. → 첫 대화 시작하기 |

금지어·가격 숫자·확인 안 된 숫자는 넣지 않았다.

## 5. 지운 옛 모바일 디자인

- 그림: `public/doit/bg/echo-mobile-bg.webp`, `public/doit/echo-ribbon.webp`, `public/doit/art/{ribbon-01,ribbon-02,ribbon-03,candidate-gallery,wait-avatars,wait-ribbons,zzarit-current,key-glass}.webp`
  (사주·타로 시작 그림 2장은 무료 콘텐츠 화면이 계속 쓰므로 남김)
- 파스텔 청록 바탕(`#5fd6d6`)·리본 그림 층: `pastel-bg.css`를 밤하늘 한 줄로 줄임. 브라우저 위 띠 색·첫 화면 색도 `#010b24`.
- 여러 옛 층(echo-ui · visual-parity · mobile-polish · chat-ref …)의 어두운 청록 유리·둥근 모서리·흰 테두리를 Flora 값으로 바꿈.
- 되돌릴 기준점: echo-qa `6b3d381`.

## 6. 코덱스와 함께 일하는 방식

- 홈페이지: 잠금. 디자인·문구 변경 제안은 받지 않는다. 깨짐·잘림·겹침·링크·접근성·보안·성능 같은 재현되는 결함만 받고 Claude가 고친다.
- 모바일웹: Flora가 기준이다. 코덱스가 잘하는 것만 부탁한다.
  1. 서버가 확인한 상태로만 화면이 바뀌는지(단계 완료·연결·결제를 화면이 혼자 확정하지 않는지)
  2. 버튼·입력·뒤로가기·새로고침 회귀
  3. 360/390/430 폭에서 글자 대비·잘림·겹침
  4. 금지어·가격 숫자·확인 안 된 숫자
- 취향 의견(색·글꼴·배치)은 이 기준과 다르면 받지 않는다.

## 7. 확인 상태

| 항목 | 상태 |
|---|---|
| PC 브라우저 모의 화면(390 폭, 소프트웨어 그래픽) 14장 | 확인함 |
| 실제 서버·실제 AI와 함께 본 화면 | 확인 불가(QA 게시 후 확인) |
| 아이폰 실기기 | 확인 불가(대표 기기 확인 필요) |
