# ECHO 전체 흐름 · 안전 — 서버 부족분 계약 (Codex 전달용)

작성: 2026-10-01 · 기준 `echo-qa` `cf53197` + 이 브랜치 · 작성: Claude(프론트 + doit-connect 소폭)
원칙: 서버가 상태를 정한다. 화면은 서버가 준 것만 그린다. 아래 항목은 **서버가 없어서 화면에 만들지 않은 것**이다(가짜 KEY 잔액·가짜 구매·가격·가짜 상태 0).
DB · RLS · Migration · Storage policy · 결제 · 가격 · PROD 는 이 문서로 승인되지 않는다. 표의 「대표 승인」 칸 참고.
프로필 공개 관련 G1~G5 는 `PROFILE_REVEAL_CONTRACT_20261001.md`. 그중 **G5(후보 신고)는 이번에 구현됨**(아래 0 참고).

## 0. 이번에 서버에서 한 것 (doit-connect v2.1 · DB 변경 0)

| 항목 | 내용 | 근거 |
|---|---|---|
| 신고 사유 | `leave` 에 `reason ∈ {unpleasant, scam, fake, threat, spam, other}`. 저장 `user_reports.reason = "connection:<code> <한국어>"`, `detail = null`(자유 글 0). 모르는 사유 400 | `REPORT_REASONS`, `recordSafety()` |
| 후보 차단·신고(G5) | `choose` 에 `choice ∈ {no, hide}` + `block` / `reason`. `blocks.reason = "candidate"`, `user_reports.reason = "candidate:<code> <한국어>"`. `yes` + 차단은 400. 기다리는 중(yes)에도 차단·신고 가능(선택 철회) | `choose` 블록 |
| 멱등 | 같은 신고자·대상·사유 신고는 1건만. 차단은 `(blocker_id, blocked_user_id)` 고유키 | `recordSafety()` |
| 응답 | `blocked`, `reported` = **실제로 저장된 것만** true. 화면은 `reported` 일 때만 「접수했어요」 | 화면 `SafetySaved` |
| 예전 화면 호환 | `report: true` + 사유 없음 → 그대로 `reason = "connection"` | 서버 검사 「v2.1 안전」 |
| **규모 버그 수정** | QA 실배포 확인 중 발견: 사람 449명의 id 를 `in(…)` 하나에 넣어 요청 주소가 약 17.5KB → agent_session 읽기 실패 → **my_candidates 가 모든 사용자에게 500**. `inChunks()` 로 100명씩 나눠 동시에 묻는다(loadMembers · blockedPairs). 460명 검사: 고치기 전 실패 · 뒤 통과. **운영(PROD) doit-connect 에도 같은 코드가 있다 — 운영 인원이 약 450명을 넘기 전에 반영 필요(운영 배포는 대표 승인)** | `inChunks()` |
| 오류 기록 | 전체 오류 처리(catch)에 오류 종류·짧은 이유만 기록(따옴표 안 값 지움 · 사용자 원문 0) | 같은 파일 끝 |
| 관리자 | 한국어 사유가 reason 에 있어 기존 「중대 의심」 글자 검사(위협·사기)가 그대로 잡는다 | `admin-web/logic.ts` `SEVERE` |

QA 실DB 확인(읽기 전용): `user_reports.reason` text · CHECK 없음, `blocks` 고유키 `(blocker_id, blocked_user_id)` → 새 칸·표 불필요.

---

아래 각 항목 형식: NAME · Current · Needed · Request · Response · State · Security · Persistence · Idempotency · QA · DB/RLS · 대표 승인.

## C1. KEY (잔액·사용)
- Current: 없음. `/doit/key` 라우트는 출시 범위에서 숨김(`visibleInRelease`). 화면에 잔액·가격 0.
- Needed: 서버가 계산한 잔액, 사용 이유(무엇을 열었는지), 사용 기록.
- Request: `{ action: "key_balance" }` / `{ action: "key_spend", purpose: "<서버 정의 코드>", targetId, idempotencyKey }`
- Response: `{ balance: number, ledger: [{ id, delta, purpose, created_at }] }` / `{ ok, balance, spent: boolean }`
- State: 잔액은 원장 합계(서버만). 화면 계산 0.
- Security: 본인만. 금액·잔액을 화면이 보내지 않는다. 결제 연결 시 Toss 서버 검증 후 원장 기록.
- Persistence: 원장 표(append-only).
- Idempotency: `idempotencyKey` 고유 → 같은 요청 두 번이면 한 번만 차감.
- QA: 동시 2회 사용 → 1회 차감 · 잔액 부족 409 · 다른 사용자 원장 0.
- DB/RLS: **필요**(원장 표 · RLS 본인 select only · insert 는 서버만).
- 대표 승인: **필요**(결제·가격·KEY 정책).

## C2. 72시간 방(72H Room)
- Current: 연결은 `doit_matches.status = approved/closed` 뿐. 만료 시각 없음. 화면에 남은 시간 0.
- Needed: 연결 열림 시각 + 만료 시각(서버) · 만료 시 자동 닫힘 · 남은 시간은 서버 시각 기준.
- Request: `my_matches` 항목에 추가.
- Response: `{ opened_at, expires_at, expired: boolean }`
- State: open → (expires_at 지남) → expired(=closed 와 같은 공개 규칙: 상대 정보 0).
- Security: 만료 뒤 `message`/`answer` 409(서버). 화면 시계는 표시용.
- Persistence: `doit_matches.expires_at` 칸 또는 계산 규칙(opened_at + 72h).
- Idempotency: 만료 처리는 조건부 update(`status='approved' and expires_at < now()`).
- QA: 만료 직전·직후 메시지 · 시계 조작한 화면이 보내도 서버 거절.
- DB/RLS: **필요**(칸 추가 시). 계산만이면 불필요.
- 대표 승인: **필요**(제품 규칙 · 72시간 확정).

## C3. 미션(Mission)
- Current: 없음.
- Needed: 서버가 고른 가벼운 미션(대화 안에서 할 수 있는 것만 · 만남·이동·금전·사진 요구 0), 완료 표시.
- Request: `{ action: "mission_get", matchId }` / `{ action: "mission_done", matchId, missionId }`
- Response: `{ mission: { id, text, kind: "talk" } | null, done_by_me, done_by_partner }`
- State: none → offered → done(각자). 상대 완료 여부는 둘 다 완료 뒤에만 공개(blind 유지).
- Security: 미션 문장은 서버 고정 목록 또는 AI 후보 + 서버 금지 규칙 검사(위험 행동·위치·연락처·금전 0).
- Persistence: 미션 표 또는 `doit_matches` 칸.
- Idempotency: `(matchId, userId, missionId)` 고유.
- QA: 금지 문장 0 · 차단·만료 뒤 409.
- DB/RLS: **필요**. 대표 승인: **필요**.

## C4. 신뢰 · 활동 · 응원(Trust / Activity / Support)
- Current: 없음. 화면에 점수·배지 0.
- Needed: (정의 필요) 사람을 숫자로 평가하지 않는 범위의 신호 — 예: 「최근 7일 대화함」 같은 사실만.
- Request/Response: 정의 뒤 작성. 점수·퍼센트 노출 금지.
- Security: 신고·차단 이력은 상대에게 절대 노출 0.
- DB/RLS: 정의에 따라 **필요 가능**. 대표 승인: **필요**(제품 정의).

## C5. 보상(Reward)
- Current: 없음.
- Needed: 무엇을 하면 무엇을 받는지(서버 규칙) · 지급 기록.
- Request: `{ action: "reward_claim", reason, idempotencyKey }` · Response: `{ ok, granted: boolean, balance? }`
- Idempotency: reason + 기간 고유. 화면이 지급을 만들지 않는다.
- DB/RLS: **필요**(KEY 원장과 같이). 대표 승인: **필요**.

## C6. 함께 나가기(Together Exit)
- Current: `leave` 는 한쪽이 끝내기만. 합의 흐름 없음.
- Needed: 한쪽이 요청 → 다른 쪽 동의 → 연결 종료(둘 다 「좋게 끝남」 기록). **상대 계정 삭제 0**.
- Request: `{ action: "together_exit_request", matchId }` / `{ action: "together_exit_answer", matchId, accept: boolean }`
- Response: `{ state: "requested" | "accepted" | "declined" }`
- State: open → exit_requested(요청자만 앎) → closed(둘 다 동의) / open(거절).
- Security: 거절해도 요청자에게 거절 사실만, 이유 0. 차단·신고와 별개.
- Persistence: `doit_matches` 칸(`exit_requested_by`, `exit_at`).
- Idempotency: 같은 요청 두 번 → 하나.
- DB/RLS: **필요**. 대표 승인: **필요**.

## C7. 쉬기 · 돌아오기(Pause / Come back)
- Current: 없음. 탈퇴(`AccountDeletion`)는 있음(숨기지 않음 · 설정 「내 정보 관리」).
- Needed: 쉬기 켜면 새 후보 준비 0 · 내 프로필 후보 노출 0 · 진행 중 연결은 그대로(또는 선택). 돌아오면 그동안의 이해를 이어서(「come back smarter」는 기존 이해 데이터 재사용만).
- Request: `{ action: "pause", on: boolean }` · Response: `{ paused: boolean, since }`
- State: active ↔ paused. `my_candidates` 는 paused 면 준비 0, `admin_candidates` 에서 제외.
- Persistence: `profiles.paused_at` 칸 또는 user_metadata(서버만 신뢰).
- Idempotency: 같은 값 다시 → 변화 0.
- DB/RLS: 칸이면 **필요**. 대표 승인: **필요**.

## C8. 전달 시간(Delivery window · 「당신이 쉬는 동안, ECHO가 찾아봤어요」)
- Current: 후보는 `my_candidates` 를 열 때 서버가 즉석 준비. 「쉬는 동안 찾았다」는 사실이 아니라 화면 문구는 기존 「당신이 잠든 사이」만 사용.
- Needed: 정해진 시각(예: 매일 밤) 서버 배치로 후보 준비 + 준비 시각 반환.
- Response: `my_candidates` 에 `prepared_at`, `batch: true`.
- 화면: `batch === true` 일 때만 「당신이 쉬는 동안, ECHO가 찾아봤어요.」.
- DB/RLS: 불필요 예상(`created_at` 있음) · 배치 실행 환경(크론) **필요**. 대표 승인: **필요**(운영 배치).

## C9. MBTI · 혈액형 · ECHO Lens
- Current: 사용자가 직접 말한 MBTI/혈액형은 agent 상태에 있음. 연결 화면에는 노출 0. 궁합 % 0.
- Needed: 공개 뒤(FULL) 상대가 **직접 말한** MBTI/혈액형을 「참고」로만. AI 추정 0 · 궁합/확률 0.
- Response: `partner.lens = { mbti?: string, blood?: string, source: "user_said" }`(공개 뒤만).
- Security: 공개 동의 문구에 항목 추가 필요 → `CONNECT_CONSENT_VERSION` 올림.
- DB/RLS: 불필요 예상(agent 저장소에서 읽기) · 동의 판 변경. 대표 승인: **필요**(개인정보 공개 범위).

## C10. 방 맥박(Room pulse)
- Current: 「상대의 답을 기다리고 있어요」 숨 쉬는 점 = 서버 `partner_answered=false` 그대로(구현됨). 접속·입력 중 표시는 없음.
- Needed(선택): 상대의 마지막 활동 구간(`today | this_week | older`)만. 정확한 시각·실시간 0.
- DB/RLS: 활동 시각 칸 **필요**. 대표 승인: **필요**.

## C11. 공개 거절 · 더 이상 공개 안 하기(Reveal decline / stop further reveal)
- Current: 공개는 둘 다 첫 답 → 전부. 「공개는 원하지 않아요」는 「이 연결 그만하기」로만 가능(구현됨 · 2탭).
- Needed: 단계 공개가 생기면(G1) 각 단계 직전 「여기까지만」 선택 + 서버가 그 뒤 단계 자산을 보내지 않음.
- 의존: `PROFILE_REVEAL_CONTRACT_20261001.md` G1. 대표 승인: **필요**.

## C12. 설정 — 차단한 사람 목록 · 차단 풀기
- Current: 차단은 저장되지만 목록·해제 동작 없음 → 설정에 항목을 만들지 않음.
- Needed: `{ action: "my_blocks" }` → `[{ id, created_at, where: "connection" | "candidate" }]`(상대 이름·사진 0 — 후보 단계 차단은 이름을 모른다), `{ action: "unblock", id }`.
- DB/RLS: 불필요(blocks 표 있음). 대표 승인: 정책 결정 필요(차단 풀면 다시 추천되는지).

## C13. 나이 · 자격
- Current: 성인 확인 서버 정책을 이 범위에서 찾지 못함 → 화면 추가 0.
- Needed: 가입 시 만 19세 이상 확인 기록과 연결 자격 조건 반영. 대표 승인: **필요**(법무).

## C14. 분석 깔때기(Analytics · North Star)
- Current: 관리자 화면은 실제 표 집계만(연결·결과 기록). 가짜 차트 0.
- 제안 North Star: **「서로 고른 뒤 첫 답까지 간 연결 수 / 주」**(= mutual → 둘 다 첫 답). 지금 표(`doit_match_candidates`, `doit_match_answers`)로 계산 가능.
- Needed: `admin-web` 에 `funnel: { candidates, yes, mutual, both_answered, talked, met }`(기존 표 집계 · 원문 0).
- DB/RLS: 불필요. 대표 승인: 불필요(QA) · PROD 배포는 승인.

## 30초 안내(온보딩)
- 시작·히어로·랜딩 수정은 승인 대상이라 **넣지 않음**. 대신 메뉴 「ECHO 사용법」 → 설정 `#guide`(9항목 · 각 3~5문장 · 실제 기능만).
