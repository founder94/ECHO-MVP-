# 승인 항목 유지 — 2026-10-02 r3

새 승인을 실행하지 않은 검토 문서다. 최신 지시에 따라 A~D는 승인 전 HOLD. 이번 QA overlay·로그인·검사·보존·PR은 기존 범위이며 DB/RLS/Storage/Auth구조/Secret/PROD 변경이 아니다.

|묶음|이유·대상·최소 변경|영향·검사·복구·순서·승인 범위|
|---|---|---|
|A 핵심 정합성|기존 candidate/match/block/message/event 다중 write는 transaction아님. service-only finalize_mutual(actor,candidate,request) 및 connection_action(actor,connection,action,request,payload) RPC; ordered pair/row lock, ownership+safety+idempotency와 parentlink/write를 같은transaction으로 처리|모든 writer가같은lock을사용해야보장. 기존unique/rows삭제0, client권한확대0. 동시YES/block/message·실패rollback·crossactor검사. Edgeoff는RPC권한복구가아님; exactrestoreSQL별도, event/message 삭제금지. exactSQL검토→QA RPC/execute권한→격리writer→공유통합. QA 최소transaction/권한만 승인요청; 아직미실행|
|B 공개·영상·각자만남·관리자|versioned/revocable reveal consent, private stage assets, same-video-session의trusted participation evidence, 각자의appearance check/meeting intent, currentvalidconnection/window/safety gate, 개인정보 없는 admin집계와 availability 상태|통화연결과사람의확인은다름; KEY/admin우회0. 새개인정보/미디어/provider/Secret은정확대상·retention승인필요. generaladmin403·forged/replay/one-sided세션·실제두기기·DOM/cache검사. 기능off도assetpolicy/data복구아님; 이미받은bytes회수불가. 구버전동의가철회를무시하면oldAPI단순복귀불가. 정책→exactDDL/storage/API→fixture→실기기/사용성→공유통합. QA 범위만, realuser/PROD제외|
|C 운영정책|72h는 최초및진행중새응답대기를분리; delivery-confirmed기산후보, reply해소, pause/failure/expire/re-entry 정책표 확정 후 versioned wait/delivery 상태 저장|spam/연속message로기한갱신0, 시스템/마지막인사자동의무0. 기존room소급제재0. wait/DST/day-sleep/pause/장애검사. scheduleroff는waitdata/권한복구아님, revision으로종료관계자동복구금지. 정책확정→contract/SQL→QAworker. 삭제보존·장애복구 exact대상별승인. 새제한·제재적용0|
|D 선택확장|KEY/reward ledger+idempotent reference, mission A/B completion, reputation3축, bilateralTogetherExit. 각자만남의사는B핵심으로먼저진행|가격/보상/등급임의결정0, 돈=trust0, 실제지출없는KEY환급0. refund/restoration/compensation분리. ledgeroff도회계event보존; tabledrop/잔액삭제rollback금지. 정책→exactDDL/RPC→fixture→UI. payment/price/Secret/PROD별도승인|

현재 바로 결정할 검사 범위: 실제 로그인한 외부 C 한계정이 필요하지만 이번명령은 생성승인이 아니다. C생성/allowlist확대0. 실제제3자방·사진 검증에는 별도의격리자료승인이필요하며C입구403과동일검사가아니다. 기존A/B 종료·차단·보고기록은보존하고삭제/초기화하지않는다.

기존signedURL600초는download/cache/in-flight전체의차단후상한이아니다. 기간단축만으로즉시철회완료라고쓰지않는다. 새발급차단·기존URL·원본/파생본·CDN/browser/serviceworker·이미받은파일을따로검사하고권한검증proxy/privatevariant보완은Storage/개인정보승인후진행한다.
