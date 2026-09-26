# ECHO Failure Dataset · DB 설계 판단 (2026-09-26 · 설계만 · 실행 0)

대표 「FINAL PRODUCT/AGENT IMPLEMENTATION DIRECTIVE」 §8·§33. 이 문서는 설계 보고다. 테이블·컬럼·RLS·Migration 은 만들지 않았다.

## 결론
- **v3 구현에 새 DB 는 필요 없다.** 실패 데이터는 저장소 문서(`docs/failure-intelligence/data/*.json`)로 관리한다. 운영 DB·사용자 Canonical State 와 물리적으로 분리돼 있어 섞일 위험이 없다.
- Agent 상태(정정·거절·정보 상태·seed)는 지금처럼 `doit_request_events.response_payload`(action = `agent_session`)의 JSON 안에 판 번호(`agent`)와 함께 남는다. v3 에서 늘어난 필드(`input_type`·`action`·`listening`)도 같은 JSON 안이다 — 스키마 변경 0.

## 나중에 DB 가 필요해지는 경우(대표 승인 대상)
1. **운영 실패 자동 수집**(관리자 화면에서 실패 후보를 모으기): 기존 `doit_request_events`(action = `agent_turn`)에 이미 턴 기록(`response_payload.turn`: 입력 종류·행동·가드·재시도)이 있다 → 먼저 **기존 테이블 재사용**(읽기 전용 관리자 뷰)을 검토한다. 새 테이블은 그다음.
2. **매칭 반영(중요 · 별건)**: `doit-connect` 는 Agent 의 확정 값을 읽지 않고 `doit_records`(원문 답) 개수만 센다. 사용자가 정정하면 옛 답 원문 행이 `doit_records` 에 그대로 `confirmed` 로 남을 수 있다(미확인). 매칭이 Agent 확정 값만 쓰게 하려면 설계가 필요하다:
   - 안 A(권장): `doit-connect` 가 `agent_session` 의 `profile`(CONFIRMED 만)을 읽도록 함수 코드만 변경 — DB 변경 0.
   - 안 B: 정정 시 `doit_records.status` 를 `superseded` 로 바꾸는 RPC — 기존 컬럼 사용 여부 확인 필요 · 운영 데이터 수정이라 승인 대상.

## 만약 실패 데이터 전용 테이블을 만든다면(초안 · 실행 금지)
- 이름: `echo_failure_events` · 사용자 id·원문 컬럼 없음(개인정보 0) · 관리자만 읽기(RLS: `profiles.role = 'admin'`) · 쓰기는 서버(서비스 역할)만.
- 컬럼: `id text pk` · `source_type text check (FOUNDER_AI|STRATEGY_HQ|CLAUDE_IMPLEMENTATION|ECHO_AGENT|UX_RESEARCH)` · `occurred_at timestamptz` · `raw_context text`(사적 내용 금지) · `failure_type` · `root_cause` · `expected_behavior` · `linked_engine` · `reproduction_test` · `severity text check (P0|P1|P2)` · `resolution` · `retest_result` · `status` · `refs text[]` · `created_at`.
- 롤백: `drop table echo_failure_events;`(다른 테이블 참조 0).
