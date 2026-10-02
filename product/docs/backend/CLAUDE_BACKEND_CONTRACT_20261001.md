# Claude v3 인계 — 2026-10-02 r3

기준 echo-qa 1da4294. #95는 merge됨; #96은 별도 진행 중이며 meetGate/index 소유권 유지. 이 PR은 기존 Connect/Agent/frontend를 수정하지 않는다. 격리 함수는 검수 서버이며 공유 웹 호출 대상을 바꾸지 않는다.

## 실제 계약
POST doit-connect-cto-qa, authenticated JWT와 QA public apikey. 비허용 로그인 주체 QA_FIXTURE_ONLY/403(non-ok); 무인증401. 관리자 action QA_ADMIN_DISABLED/403. 본문 user_id는 권한 근거가 아니다. 서명·서비스 조회도 fixtureScope에서 A/B 자료에 제한한다. 실제 C 검사는 승인 대기이며 모의 PASS와 구분한다.
my_candidates는 HTTP200 + ok=true를 먼저 검증한 뒤 eligible/missing/readiness를 해석한다. expired/invalid JWT를 eligible=false로 변환하지 않는다. choose의 mutual+match_id만 서버 연결 확정이며 optimistic mutual 금지.
answer는 {action:"answer",matchId,text}; message는 {action:"message",matchId,text,requestId:UUID}. 동일 논리전송만ID 재사용; 다른 내용/actor409. legacy ID없는 전송은 중복 방지 없음. 원래 response/code/status를 함께 확인한다.
my_matches의 candidate-safe/blind 단계에 full photo preload 금지. 현재full은 기존 connect-v1 양쪽동의+양쪽첫답변 gate이지 partial/새post-answer동의식 완료가 아니다.
zzarit_seen의 non-null event는 처음 receipt, ok=true/null은 already claimed다. 조건미충족/닫힘409, notowner404, DBerror500과 구분한다. animation once와 경제/권한 ledger는 별개다.

## 세 방향 비교와 통합
공통cf53197 / Claude95+96 / 보존Codexce8590e를 구분한다. 이미반영: six safety reasons, waitingYES withdrawal,100-ID chunk. 최신Claude 보존필수: paginated range, stable order/latest correction, page-limit fail-closed, bounded concurrency, StageError diagnostic. Codex 추가검토: deterministic reportPK, blockwrite failure, choice CAS/orphan retry, answer/message replay, reveal recheck, persisted ZZARIT receipt. 원자성은 미완성이다.
충돌: clientlocal ZZARIT와 server receipt, 기존idle72h projection과 최신 응답대기 정책. obsolete파일 전체교체 금지. #96 video/meeting policy를 oldcode로 되돌리지 않는다. 기존 통합 담당이 최소hunk를 반영하고 공유QA에서 다시 검증한다. QA whitelist는 제품에 복사하지 않는다.

## 제출과 확인
실제A/B47은 격리v3, 최신QA기준모의6/전체87은 제출branch 코드다. 두 결과를 합산하지 않는다. backend archive branch는 보존용이며 wholesale merge 대상이 아니다. v3manifest와진단/검사로그는 같은PR evidence에 있다.
표시 가능: 서버eligible/candidate/waiting/linkedmutual/blind/full/ownOutcome/closed. 표시 금지: partial완료, KEY잔액, mission/reward/trust/finalvideo/meetingpermission/accountdeleted 등 미구현 상태.
대표 전달문: “이 PR은 QA 도구와 검수 증거입니다. v2 실패는 양쪽 invalid JWT였고 재로그인 후 정상 자격이 확인됐습니다. v3 실제47은 통과했지만 C·실제타인자료·공유QA 통합은 미검증입니다. archive의 서버 보완은 최신pagination/logs/#96계약을 보존해 hunk 단위로 통합하세요.”
HANDOFF_PENDING: PR 생성은 Claude 수신확인이 아니다. 직접전달·수신증거 없음.
