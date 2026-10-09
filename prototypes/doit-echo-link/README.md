# DOIT COMPANY × ECHO 연결 시안

대표 「DOIT COMPANY × ECHO 최종 연결 시안 제작 지시서」(2026-10-09)의 실행 가능한 시안이다.
**운영 배포·결제·데이터베이스·인증과 무관한 독립 시안**이며, 운영 앱(`product/`)의 코드·빌드·테스트에 손대지 않는다.

```
/              DOIT COMPANY 홈페이지 — Clarix 원본 엔진(three 0.184.0 · lenis 1.3.23)
/echo/         ECHO 도입 — Flora 원본 엔진(three 0.186.0 · lenis 1.3.26, 별칭 three-flora · lenis-flora)
/echo/story/   이야기 쓰기 → 확인·수정 → 다음 단계 안내(로컬 체험 · AI·서버 연결 없음)
```

## 실행 방법

```bash
cd prototypes/doit-echo-link
npm ci
npm run dev            # http://localhost:5173/  (/echo/ · /echo/story/)
npm run type-check
npm run lint
npm run build          # dist/ — 정적 파일. 폴더 주소(/echo/)를 그 폴더의 index.html 로 내주는 곳이면 어디든 올라간다.
```

## 구조

| 경로 | 내용 |
|---|---|
| `src/clarix/` | Clarix ZIP 원본 소스(Next → Vite 로 옮긴 부분만 수정, 수정마다 한국어 주석) |
| `src/flora/` | Flora(Stemline) ZIP 원본 소스(같은 방식) |
| `src/pages/home/` | 홈페이지 화면·글(`content.ts` = 대표 확정 카피 §4) · 가독성 규칙(`home.css`) |
| `src/pages/echo/` | ECHO 도입 화면·글(`content.ts` = §8 여섯 장면 대응) |
| `src/pages/story/` | 이야기 쓰기 화면·글 |
| `src/shared/` | 쪽 주소(`paths.ts`) · 홈에서 온 방문 표시(`handoff.ts`) · 이 기기 임시 글(`story-draft.ts`) |
| `public/brand/doit-symbol.png` | D 심볼(아래) |

세 쪽은 각자 따로 불러오는 페이지다(MPA). 두 디자인의 CSS·글꼴·WebGL 이 섞이지 않고, 쪽을 떠나면 브라우저가
그 쪽의 렌더 루프·리스너·WebGL 자원을 함께 정리한다. 뒤로가기는 브라우저 기록 그대로
(이야기 확인 → 이야기 쓰기 → ECHO 도입 → 홈페이지).

## 원본에서 바꾼 것(요약)

- **브랜드**: 회사 = DOIT COMPANY(심볼 D · JUST TRY.), 서비스 = ECHO. ECHO 쪽 표기는 `ECHO by DOIT COMPANY`.
- **D 심볼**: 저장소의 공식 심볼 원본(`product/public/brand/doit-symbol-original.png`, 검은 배경 사진형)에서 배경을 투명하게 뺀 판
  (`doit-symbol-intro.webp`, 이전 승인분)을 여백만 잘라 썼다. **벡터 재구성 없음 · 원본 벡터 아님**(원본 SVG 는 받지 못함).
  Clarix 입자 조립은 이 그림의 **알파 마스크**로 샘플링한다(배경·가운데 구멍은 투명 → 입자 0).
- **Clarix**: 원본 2800vh · 26 화면 동안 0→1 · 마지막 1 화면 정지(재구성본의 1930vh 재조정 키 대신). 휴대폰에서 원본 재구성본이
  쓰던 정지 사진(Clarix 로고가 박힌 캡처)을 쓰지 않고 장면을 끝까지 실제로 돌린다(픽셀 비율 최대 2).
  고객사 로고 띠·200+/97%/10X·이메일 칸·바닥글 링크 묶음 삭제.
- **Flora**: 금융·네트워크 문구, ETH/GWEI/Relay 숫자, 접속 수 칩, 중계 패널(가짜 실시간 값), 갈 곳 없는 링크 삭제.
  장면 창·스크롤 구간·셰이더·입자 등급은 원본 값 그대로.
- **가독성(홈페이지)**: 제목 #050505 · 본문 #111 · 보조 #202020 · 정착 opacity 1 · 본문 500 · 휴대폰 본문 16px 이상 ·
  작은 표기 13px 이상 · 줄 간격 1.62 · keep-all · 본문 뒤 국소 밝은 막(`.scrim-soft`) · 한글 Pretendard(실제 굵기).
- **가독성(ECHO · 대표 최종 수정 지시 2026-10-09)**: 주요 제목 흰색 #FFFFFF(`--title` — 라임 `--accent` 와 분리, 라임은
  버튼 화살표·작은 강조에만) · 주요 설명 #F2F4F8 · 작은 보조 #DCE3ED · 설명 굵기 한 단계(400→500, 500→600) ·
  설명 행간 1.55 · 휴대폰 설명 16px 이상 · 읽는 글의 흐림 막(0.6) 제거, 큰 대기 문장 막은 0.9 까지만.
- **움직임 줄이기**: Clarix 는 스크롤을 따라가는 전환만 남기고 저절로 흐르는 움직임(배경 물결·입자 표류·모델 애니메이션)을 멈춘다.
  Flora 는 원본 규칙(등장 후 정지 프레임).

## 연결되지 않은 것(이 시안의 한계)

- AI 분석·추천·상호 선택·로그인: **실행되지 않음**(화면에 그대로 표시). 이야기는 이 기기 localStorage 에만 저장, 외부 전송 0.
- 실기기(iPhone·Android) 확인, 실제 키보드 표시 상태: 확인 불가(모의 브라우저 검사만).
