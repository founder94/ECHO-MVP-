# ECHO — 레디(Readdy) B구조 작업본 · 클로드 코드 하드닝판 (2026-09-04 · 여정 확장 2026-09-05)

히어로 문장(고정): **오늘 내 마음의 날씨는 어때?**

## 구조
- 프론트: Vite + React 19 + react-router 7 + Tailwind 3 (`src/`)
- 서버: Supabase Edge Function `get-step-question` (`supabase/functions/get-step-question/`)
  - `index.ts` — HTTP 진입·인증·행동(start/resume/answer/choose) 상태 전환
  - `ai.ts` — OpenAI 호출·프롬프트·후보 생성
  - `db.ts` — DB 접근·중복 요청 선점·상태 응답
  - `logic.ts` — 순수 로직(상태머신 전이표·후보 스키마 검증·의미 차단) → 단위 테스트 대상
  - `logic_test.ts` — `deno test`
- 서버: Supabase Edge Function `echo-payment` (`supabase/functions/echo-payment/index.ts`, 단일 파일) — Toss 단건결제(**현재 가격 미확정 → 결제 잠금**: `PRICE_KRW = null` 이면 주문 생성·승인을 `PRICE_NOT_SET` 으로 거절. 옛 4,900원은 폐기, 대표 결정 2026-09-26) 주문 생성·승인 확인(서버 금액검증·멱등·테스트 키만 허용)
- 서버: Supabase Edge Function `echo-journey` (`supabase/functions/echo-journey/index.ts`, 단일 파일) — STEP 3~7 질문(후보→서버 선택·차단)·답변·리포트 생성·보관함 목록
- 단일 파일 배포판: `supabase/single/get-step-question.index.ts` — 위 4개 모듈을 기계적으로 이어 붙인 것(로직 동일). 레디처럼 단일 파일만 받는 배포 도구나 Supabase 대시보드 편집기에 붙여넣을 때 사용. 수정은 원본 모듈에서 하고 다시 생성한다.
- DB 초안: `supabase/drafts/PENDING_*.sql` — **대표 승인 전 실행 금지**

## 실행
```bash
npm ci            # package-lock.json 기준
cp .env.example .env   # 공개값(VITE_PUBLIC_*)만 채운다
npm run dev       # http://localhost:3000
```

## 검사
```bash
npm run type-check   # tsc (strict)
npm run lint         # eslint --max-warnings 0
npm run build        # vite build → out/  (sourcemap 미생성)
npm run server:check # deno check (Deno 2.x 필요)
npm run server:lint
npm run server:test  # 순수 로직 단위 테스트 8건
npm run check:all
```

## 서버 함수 비밀값 (Supabase 대시보드 > Edge Functions > Secrets)
- `OPENAI_API_KEY`, `OPENAI_MODEL` — 둘 다 없으면 `AI_NOT_CONFIGURED` (코드에 기본 모델명 없음). get-step-question · echo-journey 공용
- `TOSS_SECRET_KEY` — echo-payment 전용. `test_sk_` 로 시작하는 테스트 비밀키만 허용(운영 키는 서버가 거절 → 운영 결제 불가)
- 프론트 공개값: `VITE_PUBLIC_TOSS_CLIENT_KEY` (`test_ck_` 만 허용)

## DB 변경 (대표 승인 후 실행)
- `supabase/drafts/PENDING_20260905_echo_journey.sql` — payments · reports 표(+RLS 본인 읽기만) · conversations.status 허용값 확장. 비파괴.
- `supabase/drafts/PENDING_20260904_echo_hardening.sql` — 프로필 트리거·RLS 보강(별도)

## 흐름
`/` → `/weather` → `/weather-check` → `/story-start`(STEP 1) → `/step/2` → `/understanding-check`(SCENE 3 · 4버튼) → `/white-door` → `/payment`(가격 미확정 → 「결제 준비 중」만 표시, 결제 시작 불가) → `/payment/success`(서버 승인) → `/step/3` … `/step/7` → `/report` → `/locker` · `/next-journey`

상태값: `step1 step2 understanding followup white_door_ready` (get-step-question) → `step3 … step7 report_ready report_done` (echo-journey). 결제 승인(echo-payment)만 `white_door_ready → step3` 를 바꾼다.
모든 이동은 서버가 돌려준 `status` 로만 결정한다. 알 수 없는 상태는 STEP 1로 보내지 않고 명시 오류로 멈춘다.

## 아직 없는 것
운영 배포 · 운영 결제(운영 키 자체를 서버가 거절) · Google 콘솔 등록 · 사주타로 990원 상품(이번 릴리스 금지).