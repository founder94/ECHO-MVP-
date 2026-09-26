# ECONOMY P1 · 읽기 전용 실측 메모 (2026-09-13 · 설계 원문 미보유 상태)

> ⚠️ **폐기된 옛 가격 표시 (2026-09-26 대표 결정)**: 이 문서의 4,900원은 **폐기된 옛 구조(legacy)** 이며 현재 가격이 아닙니다. 현재 가격은 미확정입니다. 과거 기록 보존을 위해 본문은 그대로 둡니다.

P2 01/02 및 Edge 설계 원문은 이 작업공간에 없어 이어쓰기 불가. 아래는 원문 도착 후 대조할 실측값만 기록한다.

## PHASE B · Feature Policy 저장소
- 기존 정책 테이블: 없음. `purposes`(콘텐츠 목록), `openai_rate_limits`(호출 제한)만 존재 → 정책 canonical 아님.
- key_spend 본문에 예약된 조회 지점(주석): `select to_jsonb(p) from public.key_feature_policies p where p.feature = p_feature`
  → 이름 후보 `key_feature_policies`, 필드 후보 feature / cost / reward_allowed / revenue_only / payment_required (본문이 읽는 키 그대로).
- key_spend 현재 상태: v_policy := null → FEATURE_POLICY_MISSING 차단(비활성). cost<=0 도 MISSING, cost<>p_amount COST_MISMATCH, payment_required → PAYMENT_REQUIRED, revenue_only 또는 reward 불허 → Revenue 만, 그 외 Reward 우선 후 Revenue.
- ACTUAL key_spend POLICY INTEGRATION = NOT VERIFIED (변경 없음).

## PHASE C · Edge integration
- 운영 Edge Function 5개: get-step-question, echo-payment(verify_jwt), echo-journey, openai-chat(verify_jwt=false), doit-understanding(v4).
- Edge canonical(doit-understanding 실측): Authorization Bearer → anon client + getUser() 실검증 → service_role client 로 DB RPC 호출 → RPC 반환 code 를 HTTP 로 매핑(REQUEST_CONFLICT 409 등) · requestId UUID 검증 + canonical payload sha256 · CORS_ALLOWED_ORIGINS 환경변수 기반 corsHeaders() · 본문 64KB·분당 60회 제한.
- 향후 key_* Edge 는 이 패턴을 재사용해야 하며 echo-payment(B 4,900원, conversation 종속)는 재사용 금지.
- 배포 여부 = STOP. 이번 실측으로 설계·배포 승인이 늘어나지 않음.
