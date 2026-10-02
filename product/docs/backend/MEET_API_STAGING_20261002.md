# PR99 실제 연결 준비 — v2 · 2026-10-02
현재 제출 단위: CODE/MOCK READY; 공유 라우트·실DB·영상 활성화 아님.
기존 PR97/원격 보존/인수·AI복구·PR98 CLOSED 유지. PR98 검사 재실행0.
PR99 8f2a7c46006c332bf314fefbe9589417f494d595는 작업 중 Claude가 병합함. 통합183b2fb59fcd1c93da6fc8c4cade7ee7789160ce/문서후속a37ac998490b5c1c1ab4999fdf0327e1ad68d00b 기반 후속 제출. 병합PR재개0. 공유 echo-qa 1da4294 그대로(이번에 HEAD를 실제 확인한 값).
기존 meetApi.ts/meetGate.ts 및14개 검사 재사용. meetGate.ts 변경0. Claude요청 sessionId 응답 확장으로 기존1개 객체기대값에 sessionId를 추가(기존불허/허용기대값 약화0), 노출경계 새1개 검사 추가.
코드가 바뀐 meetApi 영향으로 기존14개를 최종 조합에서 다시 검증(같은 조건 재실행 아님).
QA 메타데이터 읽기: doit_matches/blocks 있음; doit_video_sessions/doit_video_participation/doit_meet_checks/doit_meet_intents 없음. 개인정보 행 원문 조회0.

## 담당과 파일
Codex: meetApi.ts 변경, meetRuntime.ts 신규, meetVideoEvidence.ts 신규, 관련 모의검사·이 문서.
Claude: 공유 index.ts 라우트/APP/ADMIN/QA 단일통합·게시, 기존 PENDING_20261002_meet_gate_B.sql/rollback 초안.
공통 초안은 Claude 한 명 유지. 기존 SQL/라우트/Agent/관리자/워크플로 수정0. 새 공통 타입은 각 신규 모듈에서 export; 병렬 gate/type 정의0.

## 실제 연결한 코드 (아직 실제 엔드포인트 아님)
1. createMeetRuntime(admin, config).handle(sb, action, body):
   sb.auth.getUser()로 요청별 실주체 확인; body.user_id/role/allowed/lastStepOpen 무시.
   현재 A/B Auth getUserById, 기존 blocks 양방향 조회를 서비스 권한 사용 전에 참가자 검사 후 실행.
   readCurrentState 콜백은 기존 서버 자격/마지막 구간/공개·자산 버전을 반환해야 함. 임의 CONFIRMED·새 단계 숫자 작성0.
   누락된 콜백/비활성/기존 connect-v1뿐인 설정은 503 MEET_NOT_CONFIGURED; 성공·정상0으로 바꾸지 않음.
2. Supabase-shaped 기존 meetApi 저장 어댑터:
   기존 B 표/칼럼 이름으로 기록 읽기·본인 확인/의사 insert. 요청 중복은 기존 제안 PK/unique 사용.
   현재 자격/공개가 유효하지 않으면 약속 권한0. evidence.context_version과 현재 서버 stateVersion 일치한 세션만 사용.
   저장 전 상태 버전 확인; 저장 뒤 현재 상태 재계산. 오래된 화면 STATE_CHANGED409.
3. createVideoEvidenceHandler(admin, config):
   일반 사용자 액션 아님. 공급자 verifyAndFetchFinalSession(req)이 서명/재전송시간을 검증하고 공급자 최종 서버자료를 조회해야 함.
   서명실패401, 진행중/순서뒤바뀐 알림은202 saved:false, 최종정규화자료만 NEW 제안 RPC doit_finalize_video_evidence 호출.
   콜백 본문 matchId/verified 완료값 무시. 근거인원·기간 유효성 검사. 실제 RPC receipt saved:true 및 replayed:boolean 없으면503.
   업체 어댑터 자체는 미구현/미선택; 모의 검증기를 실제 공급자 검증으로 보고하지 않음.
4. 관리자 내부 adminSummary(sb,matchId):
   getUser→현재 profiles.role=admin 확인. 일반사용자403, 권한조회오류503.
   현재 Connection 집계(세션 수 / 유효 공동세션 / 양쪽 자기확인 / 양쪽 yes / 현재 약속권한)를 구분.
   환경은 공유 라우트가 QA/PROD 표기와 함께 전달해야 함. observedAt/definitionVersion/단위/scope 포함.
   약속 합의 저장은 없음→planAgreement:{state:not_connected,value:null}, 원문/상대의 no/not_now/공급자방주소0.
   역할검사 전에 집계 호출 금지. 사용자 handle에 관리자 액션 등록0.
5. authorizePlan(sb,matchId,stateVersion):
   로그인 주체와 현재 gate 재검사. 실제 약속 생성/예약 아님; 단독 guard로 원자성을 주장하지 않음.

## 이미 통합된 라우트와 Claude 후속 연결 지점
공유QA doit-connect v55: package b0ba55012b74cbd71d2f1668f4393a61aa411589289f44e1af77866ebbb983c5, 포함5모듈 전부183b2fb와 같음(읽기전용대조).
Claude가 원래meetApi3액션을 index.ts에 연결함. 기본MEET_API_ENABLED!==true, lastStepOpen:false 상태를 유지. 이번Codex공유index편집/배포0.
현재통합meetPolicy는차단/미처리신고/동의재조회; 자격·공개버전/마지막구간을완성한새runtime으로교체는Claude담당.
기존라우트영향5/5 PASS, exit0: node --test --test-isolation=none --test-name-pattern='\\[PR99\\]' qa/connect-server.test.mjs (183index + 이번최종module조합).
현재 공유 index.ts의 getUser/action 파싱 이후 등록: meet_status/meet_check/meet_intent.
const runtime=createMeetRuntime(admin,{enabled:false}); // 기본 OFF 유지
const result=await runtime.handle(sb,action,body);
return json(result.body,result.status,origin); // 기존 공통 CORS/private-no-store 응답 경로 재사용
승인·서버 콜백 연결 전 enabled:true 금지. 공유 웹이 격리 함수로 전환되는 변경0.
readCurrentState 구현은 Claude 기존 loadMembers/readiness를 재사용해 eligibleA/B 산출.
lastStepOpen은 확정된 기존 마지막 확인 구간의 SERVER 상태에서만; 현재 영속 단계가 없으면 false/미연결.
revealValid는 현재 공개/자산 판 검증. stateVersion은 두 사람의 현재 동의판·동의시각·공개/자산·단계판의 SHA256 불투명 토큰.
이 콜백을 body/localStorage/AI추론으로 대신하지 않음. 사용자 Auth 메타데이터는 본인 공개 동의에만 사용, 자격/관리자/단계 권한에 사용0.
공급자 콜백은 별도 서버 라우트: 서명검증 업체어댑터와 서비스전용 RPC 승인 뒤.
관리자 라우트는 adminSummary 결과에 환경 표기 결합. 현재 B 표 미생성 상태는 '미연결', 조회오류는 '실패', 실제 연결된 빈집계만 '0'.

## 요청/응답/현재 상태
meet_status {matchId} →200 {ok,state,allowed,stateVersion,sessionId?}. sessionId는현재참가자/연결/공동영상/차단/동의/마지막구간이유효하여본인확인이가능할때만반환. unavailable/기존OFF에서는노출0. Claude요청5951673122 처리.
meet_check {matchId,sessionId,stateVersion} →200 동일상태+replayed(처리기록), 본인 확인 저장만.
meet_intent {matchId,sessionId,intent:yes|not_now|no,requestId,stateVersion} →200 동일상태+replayed.
같은 논리적 요청은 같은ID; 변경은 새ID; 같은ID 다른내용409 REQUEST_CONFLICT.
상대의 no/not_now 차이는 응답0. state는 기존 allowed/need_video/need_my_check/need_my_intent/waiting_partner/unavailable 재사용.
과거 처리 성공과 현재 allowed를 구분. 허용=false는 기록 지워짐을 뜻하지 않음.
에러: UNAUTHORIZED401, NOT_FOUND404, FORBIDDEN403, BAD_REQUEST400, STATE_CHANGED/REQUEST_CONFLICT/MEET_UNAVAILABLE409,
MEET_NOT_CONFIGURED/MEET_POLICY_NOT_CONNECTED/MEET_PERMISSION_READ_FAILED/MEET_READ_FAILED/MEET_WRITE_FAILED/MEET_READ_INCOMPLETE/MEET_INTENT_ORDER_UNRESOLVED503.
업체콜백 오류는 VIDEO_* 코드, 원문/토큰/SQL상세 노출0.
정상앱 대화/그만하기 기존라우트 변경0; 영상/만남 거절을 신뢰에 반영0. OFF 상태에서 완료/영상 정상0 UI 표시 금지.

## 테스트와 증거
node --test --test-isolation=none qa-independent/meet-api.test.mjs qa-independent/meet-runtime.test.mjs qa-independent/meet-video-evidence.test.mjs
최종 조합35 PASS/0fail/0skip/0todo, 실제 프로세스 exit0. 기존14 + sessionId 경계1 + 새runtime13 + 새영상경계7; 순수/모의자료로 한정.
DENO_TLS_CA_STORE=system deno check --no-config --no-lock --node-modules-dir=none supabase/functions/doit-connect/meetRuntime.ts supabase/functions/doit-connect/meetVideoEvidence.ts → exit0.
로그 evidence/meet99-v2-mock.log 및 evidence/meet99-route-183.log 제공. 이35개와공유라우트5개를실서버/실기기PASS로합산하지않음. 새로고침/재로그인 복원은 같은 모의DB로 새runtime 생성하여 읽기만 모의확인. 실제 Auth 재로그인/실저장/실영상/실기기 미실행.
인증 실패/타인 대상/서버 자격/현재 동의·차단/정책판/중복/동시A/B yes/저장실패재시도/관리자권한철회 검사.
위조·진행중 콜백 차단은 모의 업체어댑터 검사. 실제 공급자 서명·실계정 철회 순간·약속+차단 경합은 미검증.
C/실제 제3자 방·사진 HOLD 그대로, 새 계정/기존 차단·종료 초기화0.
이미 내려간 URL/캐시/파일 회수 미해결을 독립 유지.

## 기존 B에 반영할 최소 차이·결정 (새 B 문서 복제 아님)
권장 적용안: 기존 QA 4표 초안을 보존하며 불변 context_version + 최종증거 원자적 RPC를 먼저 추가, 업체 한 곳의 검증 가능한 최종 근거로만 proof를 확정. 이벤트순서만 믿거나 여러 insert 뒤 true로 바꾸는 방식 금지.
실제 대상/기존 초안 추가:
- doit_video_sessions: context_version text(64hex, 서버가 방 생성 시 고정), evidence_digest text(최종 정규화 근거 해시), finalized_at timestamptz. provider/ref 기존 unique 유지. 기존 finalized 근거 덮어쓰기0.
- 신규 서비스전용 함수 doit_finalize_video_evidence(evidence jsonb): 이미 서버가 생성한 provider/ref→connection/session 매핑을 조회/잠금. 클라이언트가 주장한 matchId로 방 생성0. 사용자ID는 그 connection의 A/B인지 확인.
  해당 session의 고정 context_version과 payload 일치 검사. 참여시각/카메라초 유효성 확인.
  final digest 동일 재시도={saved:true,replayed:true}; 다른 근거=충돌. 끝난 세션 근거와 참여행을 한 트랜잭션에서 기록하고 나서 signature_verified=true 확정.
  provider의 canonical terminal revision 기반; 불완전/오래된 이벤트로 finalized 근거를 낮추거나 다시 만들지 않음.
  SECURITY INVOKER; PUBLIC/anon/authenticated EXECUTE 회수, service_role만 허용. 공개 RPC 호출 자체가 공급자검증을 대신하지 않음.
- 현재 의사 시간 동일충돌은 코드에서503으로 닫음. 엄밀한 변경순서/최신철회를 보장하려면 사용자별 intent revision과 CAS 쓰기 RPC가 필요. 현재 초안 unique(user,request)는 중복만 보장.
- 실제 약속 생성은 미구현. 생성 전에 승인된 agreement 저장·논리적 request unique + 현재 차단/철회/연결 검사를 한 트랜잭션으로 묶어야 함.
  Connection 잠금 규칙은 차단/종료 작성 경로에도 공통 적용해야 하므로 Claude 소유 공유라우트 및 별도DB 정합성 승인 대상. 단독 read guard를 약속 생성 완료로 표시0.
- 마지막 확인 구간의 현재 서버 저장 위치가 아직 없으면 기존 단계표 기준으로 최소 서버 상태 칸 결정 필요. 숫자·단계 진행 조건 임의결정0.
공급자 결정/설정: 서명+replay window 검증, 서버 확정 방 매핑, 최종 공동참여·카메라활동 근거를 제공하는 업체 한 곳; API/서명 Secret은 기존 승인경로로 설정. 업체명/비밀값 임의등록0.
저장/목적: 영상/음성/전사0, 공급자방 참조·참가자ID·시각·카메라초·각자 자기확인·의사이력·버전/증거해시만. 이 메타데이터도 개인정보. 보존기간과 영상동의판 확정 필요.
기존 영향: 새표/칼럼/RPC를 구코드는 읽지 않음. 기존 동의·자료 덮어쓰기/기존상태소급0. SQL/Storage/Auth/Secret/PROD 실제 적용0.
순서: B QA저장·권한·동의/보존 승인 → Claude 초안/RPC 반영 → 업체선택/서버방매핑·서명어댑터 → 현재state reader/단일라우트 통합 OFF → 실DB멱등/권한/경합 → 두계정·두기기 → QA 활성화. PROD별도.
복구: 라우트/플래그 OFF는 새 요청만 막고 기록은 보존. 함수 EXECUTE 권한 복구/기존버전 복귀는 적용 전 권한 스냅샷 기준. 생성기록 삭제는 보존 승인·백업 없이는 불가. 진행통화/기존URL/외부업체 자료는 OFF만으로 회수/삭제되지 않음.
대표 필요한 결정: 기존 B QA4표/버전·증거RPC 범위, 업체·Secret설정/외부전송, 영상동의판·보존기간. 가격·보상·PROD·새 나이정보 수집 범위 밖.

## 제출/수신 상태
기존PR99는Claude인수/병합완료(댓글5951673122). 그인계를HANDOFF_PENDING으로되돌리지않음.
이번새runtime/context/callback/sessionId결과는최신Claude브랜치기반후속Draft PR로보존하고PR99댓글로반환. 새결과수신/실행은별도확인.
워크플로6개실제읽기: codex후속브랜치push/PR이배포/마이그레이션트리거에매칭되지않음. GitHub API게시로원격보존, git shellpush/PROD변경0.
