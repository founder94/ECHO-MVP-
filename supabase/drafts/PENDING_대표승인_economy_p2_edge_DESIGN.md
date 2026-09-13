# ECONOMY P2 · Edge integration 설계 후보
**NEWLY AUTHORED · 2026-09-13 · 과거 원문 회수본 아님 · 운영 미적용 · 배포 STOP**
기준: 검증된 P1 r2 RPC(key_charge_revenue / key_grant_reward / key_reverse, service_role EXECUTE) + 운영 Edge canonical 실측(doit-understanding v4).

## 1. 기존 Edge canonical (실측, 재사용 대상)
doit-understanding/index.ts 에서 확인된 공용 패턴을 그대로 쓴다. 새 인증·CORS·멱등 코드를 만들지 않는다.
| 항목 | 실측 내용 |
|---|---|
| 인증 | `Authorization: Bearer` → anon client + `auth.getUser()` 실검증 → 실패 401 |
| 서버 권한 | `SUPABASE_SERVICE_ROLE_KEY` 로 별도 admin client → DB RPC 호출 (브라우저 노출 없음) |
| CORS | `CORS_ALLOWED_ORIGINS` 환경변수(콤마 구분) → `corsHeaders(origin)` · 미설정 시 `*` (운영은 반드시 설정) |
| 멱등 | body.requestId UUID 검증 + `canonicalPayload` sha256 → DB 함수의 (user_id, request_id, payload_hash) |
| 오류 계약 | RPC 반환 code → HTTP: REQUEST_CONFLICT 409 · FORBIDDEN 403 · INVALID_STATE/STALE 409 · BAD_REQUEST 400 · 그 외 500 |
| 제한 | 본문 64KB · 사용자당 분당 60회(인스턴스 메모리) |
| 재사용 금지 | echo-payment (B 4,900원 · conversation 종속) |

## 2. Revenue charge — 주문 도메인 (key_orders 후보)
**흐름**: 사용자 결제 요청 → key_orders 생성(pending) → Toss 승인(서버) → 서버가 금액·주문·사용자·상태 검증 → `key_charge_revenue(user, request_id, amount, 'key_order', order_id)` → 원장 append → balance.
- 브라우저의 "결제 성공" 신호로 KEY 를 만들지 않는다. Toss 승인 API 응답을 서버가 직접 확인한 뒤에만 charge.
- `source='key_order'`, `source_id=key_orders.id` → 같은 주문의 이중 충전은 `key_ledger_cause_uniq` 가 최종 차단.
- **key_orders 후보 컬럼**(NEW REQUIRED · 미생성): id uuid pk · user_id uuid · package_code text · amount_krw int · key_amount int · provider text('toss') · provider_order_id text unique · provider_payment_key text · status text(pending|paid|charged|failed|refunded) · request_id uuid(charge 멱등 키) · created_at · paid_at · charged_at. RLS: 본인 SELECT 만, 쓰기는 service_role.
- Merchant 주문·정산·수수료·B payments 와 테이블·함수·Edge 를 공유하지 않는다.
- KEY 패키지 가격·수량은 여기서 확정하지 않는다(package_code 만 설계).

## 3. Reward grant — 행동 검증 도메인
**흐름**: 행동 발생 → 서버 수집(기존 doit_* 상태머신) → 중복 검사(같은 행동 id) → 부정사용 검사 → 한도 검사 → 정책 검사(reward policy_version) → 의미 있는 TRY 판정 → `key_grant_reward(user, request_id, amount, 'action:<type>', action_id, policy_version, null)`.
- LLM 은 후보 분석만. 지급 여부·수량·완료는 서버 상태머신이 결정.
- expires_at 은 null 고정(EXPIRY_POLICY_UNDECIDED 유지). 보상량 정책값은 확정하지 않는다.
- 새 공개 지급 API·내부 시크릿 지급 API·큐를 추가하지 않는다. 지급 진입점은 행동을 검증하는 기존 서버 Edge 내부 한 곳.

## 4. Reverse — PG 환불과 분리
`key_reverse` 는 원장 상쇄 command 이지 환불이 아니다. 실제 환불: 환불 가능성 검증 → Toss/Commerce refund → 성공 확인 → 해당 charge 의 reversal → 감사 유지. 자동 환불 비활성. 환불 정책은 별도 PHASE.

## 5. 멱등·경쟁
- Edge 재시도·네트워크 재전송: 같은 request_id → DB 가 저장된 result_json replay(원장 추가 0). 로컬 P2 검증 T10·운영 P1 보완검사로 확인됨.
- 다른 request_id 로 같은 원인 재시도: key_ledger_cause_uniq → CAUSE_ALREADY_APPLIED (운영 실행 증거는 아직 검증 필요).
- key_spend 는 authenticated 가 직접 RPC 호출(Edge 불필요). 정책은 서버 테이블(key_feature_policies) 이 결정.

## 6. 환경변수 이름 (값 없음)
SUPABASE_URL · SUPABASE_ANON_KEY · SUPABASE_SERVICE_ROLE_KEY · CORS_ALLOWED_ORIGINS · TOSS_SECRET_KEY(서버 전용, charge Edge 에서만)

## 7. 이번 단계 STOP
Edge 배포 · key_orders 생성 · 실결제 · 실지급 · 정책 row 삽입 · 가격/보상량/수수료/환불 규칙 확정.
