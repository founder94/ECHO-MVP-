-- PENDING · 대표 승인 전 실행 금지 · 초안 2026-09-14
-- 목적: 같은 사용자·같은 요청 토큰으로 대화가 두 번 만들어지지 않도록 DB 에서 최종 보장 (get-step-question start 의 dup 검사는 경합 시 뚫릴 수 있음).
-- 영향: 기존 행 0건(2026-09-14 기준 conversations 비어 있음) → 충돌 없음. 함수 코드 변경 불필요(insert 실패 시 기존 오류 경로 ERROR 응답).
create unique index concurrently if not exists conversations_user_request_token_uniq
  on public.conversations (user_id, request_token)
  where request_token is not null;
