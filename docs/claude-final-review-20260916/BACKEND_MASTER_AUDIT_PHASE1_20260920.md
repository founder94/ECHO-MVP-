# ECHO BACKEND MASTER AUDIT · PHASE 1 FINAL (2026-09-20)

> ⚠️ **폐기된 옛 가격 표시 (2026-09-26 대표 결정)**: 이 문서의 4,900원은 **폐기된 옛 구조(legacy)** 이며 현재 가격이 아닙니다. 현재 가격은 미확정입니다. 과거 기록 보존을 위해 본문은 그대로 둡니다.

읽기 전용 실측. 변경 0. 조사 시각 2026-09-20 08:00~08:20 UTC.

## A. 한 줄 결론

**부분 구현.** 자기이해 AI 백엔드는 실제로 완성되어 데이터까지 쌓였지만,
현재 배포된 Plan A 프론트에서 그 서버로 가는 스위치가 꺼진 채 빌드되어 있다.
그리고 Plan A 후반부(공간 → 상호작용 → 정보 공개 → 각자의 문 → 상호 선택 → 관계 열기)는
**DB 테이블 자체가 존재하지 않는다.**

## B. 운영 기술스택 (실측)

| 층 | 실제 |
| --- | --- |
| Frontend | React 19 + TypeScript + Vite 8 (out 정적 산출물) |
| Hosting | Netlify 수동 업로드 |
| Backend | Supabase Edge Functions (Deno) 7개 |
| Database | PostgreSQL · public 스키마 테이블 21개 |
| Auth | Supabase Auth + Google OAuth |
| RLS | 21/21 테이블 ON |
| RPC | public 함수 17개 (대부분 SECURITY DEFINER + service_role 전용) |
| Storage | 버킷 1개 `profile-photos` (private, 5MB 제한, 정책 4개) |
| AI | OpenAI (gpt-4o-mini, Edge 안에서만 호출) |
| Payment | Toss Payments · 4,900원 단건 · `review_pending`으로 잠김 |
| Admin | admin-conversations v2 · admin-dashboard v1 |
| Observability | audit_logs (0행) · openai_rate_limits · *_request_events |

## C. 운영 자산 숫자

Tables 21 · Views 0 · RPC 17 · Edge Functions 7 · Storage Buckets 1 ·
RLS 적용 테이블 21 · Policies 27 (+ storage 4)

## D. Edge Functions

| 함수 | Version | JWT | 역할 | Front 연결 | DB | 판정 |
| --- | ---: | --- | --- | --- | --- | --- |
| get-step-question | 48 | on | B 자기이해 STEP1·2·understanding·followup | legacy B 화면만 | conversations, messages, emotions, understanding_results | 완성 / **Plan A 미연결** |
| echo-journey | 26 | on | B STEP3~7·리포트 | legacy B 화면만 | 동일 + reports | 완성 / **Plan A 미연결** |
| doit-understanding | 4 | on | A구조 자기이해 상태머신 | `/doit/*` 화면 (스위치 off) | doit_records, doit_insights (RPC 경유) | 완성 / **스위치 꺼짐** |
| echo-payment | 2 | on | Toss 주문·승인 | `/payment` (legacy) | payments | 완성 / 게이트 잠김 |
| openai-chat | 2 | **off** | 사주·타로 무료 콘텐츠 | `/doit/fortune` | openai_rate_limits | 완성 / Origin+세션 제한 |
| admin-conversations | 2 | on | 관리자 대화 조회 | `/admin/*` | 전 테이블 (service_role) | 완성 / 연결됨 |
| admin-dashboard | 1 | on | 관리자 집계 | `/admin/*` | 전 테이블 (service_role) | 완성 / 연결됨 |

**프론트가 부르는데 서버에 없는 것 2개**
- RPC `admin_analytics` — `src/doit/pages/do-it/admin/hooks/useAnalytics.ts:80`에서 호출. DB 함수 목록에 없음.
- Edge `pa_analytics_ingest` — `src/doit/lib/analytics.ts:163`에서 호출. Edge 목록에 없음.

## E. Plan A Backend Completion Matrix

| 단계 | Front | Server | DB | RLS | 상태머신 | 복원 | 판정 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 가입 전 체험 | 있음 | 없음 | 없음 | — | 없음 | 없음 | C 프론트만 존재 |
| Auth | 있음 | 있음 | profiles | 있음 | 있음 | 있음 | A 완성 |
| Purpose | 있음 | 부분 | purposes, profiles.purpose_id | 있음 | 부분 | 있음 | B 부분 구현 |
| 목적별 정보 | 있음 | 없음 | 없음 | — | 없음 | 없음 | C 프론트만 존재 |
| 동의 | 부분 | 없음 | profiles.consent_version | 있음 | 없음 | 부분 | B 부분 구현 |
| 본인확인 | 있음 | 없음 | profiles.verification_status (전부 pending) | 있음 | 없음 | 부분 | C 프론트만 존재 |
| 사진 | 있음 | 부분 | profile_photos (6행), Storage | 있음 | 없음 | 있음 | B 부분 구현 |
| Profile | 있음 | 있음 | profiles | 있음 | 부분 | 있음 | B 부분 구현 |
| Profile 수정 | 있음 | 있음 | profiles upsert | 있음 | 부분 | 있음 | B 부분 구현 |
| 목적 공간 | 있음 | 없음 | spaces (0행, 껍데기) | 있음 | 없음 | 없음 | C 프론트만 존재 |
| Membership | 있음 | 없음 | **없음** | — | 없음 | 없음 | D 백엔드 없음 |
| 협동 행동 | 있음 | 없음 | **없음** | — | 없음 | 없음 | D 백엔드 없음 |
| 상호작용 | 있음 | 없음 | **없음** | — | 없음 | 없음 | D 백엔드 없음 |
| 정보 점진 공개 | 있음 | 없음 | **없음** | — | 없음 | 없음 | D 백엔드 없음 |
| 각자의 문 | 있음 | 없음 | **없음** | — | 없음 | 없음 | D 백엔드 없음 |
| 상호 선택 | 있음 | 없음 | **없음** | — | 없음 | 없음 | D 백엔드 없음 |
| 관계 열기 | 있음 | 없음 | **없음** | — | 없음 | 없음 | D 백엔드 없음 |
| 관계 종료 | 없음 | 없음 | 없음 | — | 없음 | 없음 | D 백엔드 없음 |
| 신고 | 있음 | 없음 | user_reports (0행) | 있음 | 없음 | 있음 | B 부분 구현 |
| 차단 | 있음 | 없음 | blocks (0행) | 있음 | 없음 | 있음 | B 부분 구현 |
| SCENE 3 (B) | legacy | 있음 | conversations/messages/understanding_results | 있음 | 있음 | 있음 | A 완성 / Plan A 미연결 |
| SCENE 3 (A) | 있음 | 있음 | doit_records/doit_insights | 있음 | 있음 | 있음 | **A 완성 / 스위치 꺼짐** |
| 관리자 | 있음 | 있음 | 전체 | 있음 | — | — | B 부분 구현 (분석 2개 누락) |
| 결제 | 있음 | 있음 | payments (0행) | 있음 | 있음 | 있음 | B 부분 구현 (게이트 잠김) |
| KEY | 데모 | 있음 | key_balances/key_ledger/key_request_events | 있음 | 있음 | 있음 | B 부분 구현 (정책 저장소 없음) |
| Just Try | 준비중 | 없음 | 없음 | — | 없음 | 없음 | C 프론트만 존재 |
| 등급 | 데모 | 없음 | profiles.grade (전부 null) | 있음 | 없음 | — | D 백엔드 없음 |
| 감사로그/관측 | 부분 | 부분 | audit_logs (0행) | 있음 | — | — | B 부분 구현 |

## F. Plan A Server Chain

```
가입 전 체험 --[FRONT ONLY]--> Auth --[CONNECTED]--> Purpose --[PARTIAL]--> 목적별 정보
  --[MISSING]--> 동의 --[PARTIAL]--> 본인확인 --[FRONT ONLY]--> 사진 --[PARTIAL]-->
Profile --[CONNECTED]--> 확인·수정 --[CONNECTED]--> 목적 공간 --[FRONT ONLY]-->
Membership --[MISSING]--> 협동 --[MISSING]--> 상호작용 --[MISSING]--> 정보 공개
  --[MISSING]--> 각자의 문 --[MISSING]--> 상호 선택 --[MISSING]--> 관계 열기
```

CONNECTED 3 · PARTIAL 3 · FRONT ONLY 3 · MISSING 7.
**Plan A 전체 백엔드 완성이 아니다.**

## G. 상태머신 MASTER MAP (실제 존재하는 것만)

```
[없음: 가입 전 체험]  (서버 상태 없음. 브라우저에만 존재)
      |
[auth.users + profiles]  -- 트리거 handle_new_user --> profiles 생성
      |  서버 검증: Supabase Auth (SERVER)
      v
[profiles.purpose_id]  -- savePurpose → profiles.upsert (CLIENT가 직접 DB 쓰기)
      |  서버 검증: RLS (auth.uid() = id) 만
      v
[profiles.nickname/intro/region/life_rhythm]  -- saveProfileText → upsert
      |
      v
[profiles.verification_status = 'pending']  (5/5 전부 pending. 변경 서버 없음)
      |
      X  여기서 끊김 — 공간·관계 상태를 저장할 테이블이 없다

별도 계통 (Plan A 자기이해, 현재 스위치 off):
[doit_records] --RPC doit_apply_record_create--> [doit_insights]
   origin: ai(435) / self(156)
   status: confirmed(435) / corrected(102) / rejected(54)
   서버 검증: getUser + RPC 소유권 + payload_hash 멱등 (SERVER)

별도 계통 (B 자기이해, legacy 화면에서만):
[conversations.status] step1→step2→understanding→followup→step3..7→report_ready
   608건, messages 11,856, understanding_results 599
   서버 검증: get-step-question / echo-journey 상태머신 (SERVER)
```

## H. AI 핵심 — 가장 중요한 발견

### H-1. B 자기이해(FINAL100V4 검증 완료)는 Plan A에서 호출되지 않는다
`src/lib/echo/api.ts`가 `get-step-question`·`echo-journey`를 부르고,
이 파일을 쓰는 화면은 전부 `/weather` 계열 legacy다.
FINAL 프론트 기준 그 화면들은 정상 UI로 도달 불가다.

**판정: AI 서버 완성 / Plan A 연결 미완.**

### H-2. A 자기이해(doit-understanding)는 완성됐는데 스위치가 꺼져 있다
`src/doit/lib/understandingApi.ts:4`
```ts
export const A_STRUCTURE_SERVER_ENABLED = import.meta.env.VITE_A_STRUCTURE_SERVER_ENABLED === 'true';
```
이 환경변수는 `.env.example`에 없고 FINAL 빌드에도 주지 않았다. 따라서 **false**.
`useUnderstanding.tsx:109`의 `useServer`가 false가 되어
Plan A 첫 기록·통찰이 `localStorage`에만 저장된다.

**판정: 서버·DB·RPC 완성 / 프론트 스위치 off → 사용자 데이터가 브라우저에만 남는다.**
재로그인·다른 기기·브라우저 정리 시 복원 불가.

### H-3. Information Status 구조는 DB에 실재한다
`doit_insights`에 `origin`(ai/self)과 `status`(confirmed/corrected/rejected)가 분리 저장된다.
실제 데이터 591건이 그 구분대로 쌓여 있다. AI 추론과 사용자 확정이 같은 컬럼에 섞이지 않는다.

### H-4. AI 실패 방지 스택 매핑

| 요구 | 실제 | 근거 |
| --- | --- | --- |
| Direction Lock | 다른 로직에 포함 | gsq/ej `blockReason` 앵커·근거 규칙 |
| Context Memory | 구현 있음 | `memoryNote`/`[내가 확인한 기억]` 프롬프트 주입 |
| Correction Engine | 구현 있음 | `pendingCorrection` + `correction_ignored` 차단 |
| Rejected Semantic Block | 구현 있음 | `rejected_key`/`rejected_meaning` + doit-understanding `judgeSemanticBlock` |
| Information Status | 구현 있음 | `doit_insights.origin`/`status` |
| Hallucination Detection | 부분 구현 | `not_grounded`/`unsupported_anchor` 차단 |
| Action Router | 부분 구현 | `answer_hold`(되물음 시 단계 유지) |
| Free-form Input | 구현 있음 | 자유 입력 + "모르겠어요" 허용 |
| AI Core Orchestrator | 다른 로직에 포함 | Edge 안의 시도·구제 체인 |

### H-5. 반복 패턴 엔진
**없음.** 패턴 저장 테이블·추출 함수 모두 존재하지 않는다.
`/doit/pattern` 화면은 있으나 서버가 없다.

## I. Security

| 등급 | 항목 | 근거 |
| --- | --- | --- |
| **P1** | `is_admin()`이 `anon`에게도 EXECUTE 허용 | Supabase 보안 권고 0028. 함수 자체는 `auth.uid()` 기반이라 비로그인 호출 시 false를 반환하므로 정보 유출은 없다. 그래도 anon 노출은 불필요 |
| P2 | RLS ON + 정책 0 테이블 4개 | doit_handoffs, doit_request_events, key_request_events, openai_rate_limits. 클라이언트 접근이 완전 차단되고 service_role만 쓰는 **의도된 설계**로 보인다 |
| P2 | 유출 비밀번호 보호 꺼짐 | Supabase Auth 설정 |
| INFO | `key_spend()`가 authenticated 실행 가능 | 내부에서 `auth.uid()`로 본인 확인, advisory lock, 멱등 키, 원장 append, 잔액 FOR UPDATE까지 갖춤. 게다가 feature 정책 저장소가 없어 현재는 항상 차단된다 |

**타 사용자 데이터 접근**: 모든 사용자 테이블 정책이 `auth.uid() = user_id` 형태다.
`spaces`만 `auth.role() = 'authenticated'`로 전체 조회가 열려 있으나 개인정보 컬럼이 없고 0행이다.
**클라이언트 user_id 위조 저장**: profiles·profile_photos·spaces·user_reports 모두 `WITH CHECK (auth.uid() = ...)`로 막혀 있다.

## J. 관리자

서버 두 함수 모두 **이중 검사**를 한다. `auth.getUser()`로 토큰 실검증 후
service_role 클라이언트로 `profiles.role = 'admin'`을 다시 확인한다.
프론트 AdminGuard는 화면 가드일 뿐이고 서버가 독립적으로 막는다.

**연결 상태**: `useAdminConversations.ts`, `useAdminData.ts`가 실제 Edge를 호출한다 → 연결됨.
**미완**: `admin_analytics` RPC와 `pa_analytics_ingest` Edge가 존재하지 않아 분석·이벤트 수집 화면은 동작하지 않는다.

## K. 결제

| 항목 | 실측 |
| --- | --- |
| PG | Toss Payments (`api.tosspayments.com/v1/payments/confirm`) |
| 가격 | 서버 상수 `PRICE_KRW = 4900` |
| 게이트 | `PAYMENT_MODE = "review_pending"` → create·confirm 모두 `PAYMENT_NOT_CONFIGURED` 반환 |
| 금액 검증 | 서버에서 `amount !== PRICE_KRW || payment.amount !== PRICE_KRW` 이중 확인 |
| 키 분리 | `tossSecret.startsWith("test_")` 아니면 거부 → 운영키 사용 불가 |
| 쓰기 권한 | payments는 service_role만 쓰고 사용자는 본인 행 읽기만 |
| Stripe | src 내 참조 0건 |
| 데이터 | payments 0행 |

**결제 성공을 프론트가 만들 수 없다.** Toss 승인 응답으로만 인정한다.

## L. KEY / Just Try / 등급

- **KEY**: RPC 완성도가 높다. advisory lock, payload_hash 멱등, 원장 append, 잔액 FOR UPDATE,
  balance 캐시 손상 감지까지 있다. 다만 `key_feature_policies` 저장소가 없어
  `key_spend`는 현재 **항상 `FEATURE_POLICY_MISSING`으로 차단**된다. 프론트는 RPC를 호출하지 않고 데모 화면만 보여준다.
- **Just Try**: 서버·테이블 모두 없음. 화면은 "준비 중" 배지로 잠겨 있다.
- **등급**: `profiles.grade` 컬럼이 있으나 5/5 전부 null. 계산 서버 없음. 화면은 mock 값을 "데모 미리보기"로 표시.

## M. 운영 데이터 COUNT (2026-09-20 08:15 UTC)

| 테이블 | count | | 테이블 | count |
| --- | ---: | --- | --- | ---: |
| messages | 11,856 | | profile_photos | 6 |
| conversations | 608 | | profiles | 5 |
| emotions | 608 | | key_ledger | 4 |
| understanding_results | 599 | | key_balances | 1 |
| doit_insights | 591 | | doit_records | **0** |
| purposes | 10 (활성 4) | | spaces · payments · reports · user_reports · blocks · audit_logs · doit_handoffs | **0** |

`understanding_results.choice`: agree 442 · explain 60 · no 54 · alittle 43.
4버튼이 실제로 눌렸고 서버에 저장됐다.

## N. GAP LIST

| ID | 기능 | 현재 | 목표 | 부족층 | 위험 | 근거 | 우선 | 범위 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GAP-01 | Plan A 자기이해 서버 연결 | 스위치 off, localStorage 저장 | 서버 저장·복원 | FRONT(빌드 env) | P1 | `understandingApi.ts:4` | 1 | S |
| GAP-02 | 공간 Membership | 테이블 없음 | 입장·나가기·중복 방지 | DB/RLS/SERVER/STATE | P1 | 테이블 목록 | 2 | L |
| GAP-03 | 상호작용·협동 행동 | 테이블 없음 | 서버 완료 판정 | DB/RLS/SERVER/STATE | P1 | 테이블 목록 | 2 | L |
| GAP-04 | 정보 점진 공개 | 테이블 없음 | 서버가 공개 범위 결정 | DB/RLS/SERVER | P0 후보 | 테이블 목록 | 2 | L |
| GAP-05 | 각자의 문 | 테이블 없음 | door 상태머신 | DB/SERVER/STATE | P1 | 테이블 목록 | 2 | M |
| GAP-06 | 상호 선택 | 테이블 없음 | 서버 mutual 판정(transaction) | DB/RPC/STATE | P1 | 테이블 목록 | 2 | M |
| GAP-07 | 관계 열기·종료 | 테이블 없음 | relationships 모델 | DB/RLS/SERVER/STATE | P1 | 테이블 목록 | 2 | L |
| GAP-08 | B AI의 Plan A 연결 | legacy 화면에서만 호출 | Plan A가 AI 자산 사용 | FRONT/STATE | P1 | `lib/echo/api.ts` 사용처 | 3 | M |
| GAP-09 | admin_analytics RPC 없음 | 프론트만 호출 | RPC 구현 | RPC | P2 | `useAnalytics.ts:80` | 4 | S |
| GAP-10 | pa_analytics_ingest Edge 없음 | 프론트만 호출 | Edge 구현 | EDGE | P2 | `analytics.ts:163` | 4 | S |
| GAP-11 | KEY feature 정책 저장소 | 항상 차단 | 정책 테이블 | DB | P2 | `key_spend` 본문 | 5 | M |
| GAP-12 | 본인확인 서버 | 상태값만 존재 | 제공자 연동·서버 검증 | SERVER/DB | P1 | verification_status 전부 pending | 2 | L |
| GAP-13 | 반복 패턴 엔진 | 없음 | 저장·추출·확인 | DB/SERVER | P2 | 테이블 목록 | 5 | L |
| GAP-14 | 가입 전 체험 서버 | 서버 상태 없음 | 익명 진행 복원 | DB/SERVER | P2 | 테이블 목록 | 5 | M |
| GAP-15 | is_admin anon 실행 | anon EXECUTE 허용 | authenticated 한정 | RPC | P1 | 보안 권고 0028 | 1 | S |

## O. 살릴 것 / 고칠 것 / 버릴 것 / 새로 필요한 것

**살릴 것** — 실제 자산이 있다
- doit-understanding + doit_records/doit_insights + RPC 7개 (Information Status 구조 포함)
- get-step-question v48 / echo-journey v26 (FINAL100V4 검증 완료)
- KEY RPC 계열 (멱등·원장·잠금 설계가 견고하다)
- echo-payment (서버 금액 검증·게이트)
- admin-conversations / admin-dashboard (이중 권한 검사)

**고칠 것**
- Plan A 자기이해 스위치 (GAP-01, 빌드 env 한 줄)
- is_admin anon 권한 (GAP-15)
- admin_analytics / pa_analytics_ingest 누락 (GAP-09, GAP-10)

**버릴 것**
- profiles.grade 컬럼과 화면의 등급 데모 (사람 등급제는 대표 결정 전까지 미사용)
- mocks/do-it.ts 기반 데모 통계 (서버 생기면 교체)

**새로 필요한 것**
- 공간 Membership · 상호작용 · 정보 공개 · 각자의 문 · 상호 선택 · 관계 (GAP-02~07)
- 본인확인 서버 (GAP-12)

## P. REPRESENTATIVE DECISION (기술만으로 못 정하는 것)

1. 정보 점진 공개의 단계와 조건 (무엇을 언제 보여줄지)
2. 상호 선택 변경·취소 정책
3. 관계 종료 시 기존 대화 보존 정책
4. 사람 등급제를 제품에 둘지 여부
5. KEY 경제를 실제로 운영할지 여부

## Q. 확인 불가

- 실제 Google OAuth 왕복
- 로그인 후 `/doit/*` 화면의 실제 렌더
- 실기기 동작
- Toss 심사 상태 (코드는 test 키만 허용)

## R. 변경 내역

코드 변경 0 · DB 변경 0 · RLS 변경 0 · Migration 0 · Edge 배포 0 · Netlify 배포 0 · 운영 데이터 변경 0
