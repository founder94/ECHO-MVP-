# 기억하는 AI · 사주타로 정정 매칭 · 유료 자유 대화 — 구현·검사 보고(2026-10-06)

대표 승인 2026-10-06 「기억 영수증」 1단계 + 「ECHO 최종 지시(A~G)」. 브랜치 `claude/memory-receipt-20261006` → echo-qa PR. 운영 변경 0 · main 병합 0 · DB 변경은 초안만.

## 1. 구현 범위(바뀐 파일)

| 영역 | 파일 | 바뀐 것 |
|---|---|---|
| A 영수증·인용 | `supabase/functions/doit-agent/agent.ts` | 정정이 상태에 반영된 뒤 고정 문장 `Receipt`(옛 뜻→고친 뜻) · 정정 직후 다음 질문 1회 인용(`cite`) · 모델 재료 `user_corrected` · `knownView`(네 칸) · `forgetKnown`(줄 지우기 · 재생성 차단) · `confirmKnown`(「맞아요」→USER_CONFIRMED) · 상태값 `FORGOTTEN` · 민감 주제 표시 `SENSITIVE_TOPIC` |
| A 서버 동작 | `supabase/functions/doit-agent/index.ts` | 턴 응답에 `receipt`·`cite`(상태 저장 성공 뒤에만) · `known` · 새 동작 `agent_confirm` `agent_forget` `agent_self_note` `agent_free_talk` · 자기 문장 보관 줄(`agent_self_notes`) · 자유 대화 상태(`freeStatus`) |
| A 후보 이유 | `supabase/functions/doit-connect/index.ts`, `agentSource.ts` | 고친 값(USER_CORRECTED)이 이유에 들어가면 「고쳐 주신 대로 「…」」 — 본인 화면만(상대 화면은 상대 자신의 말만) · [반영할게요] 자기 문장을 확정 재료에 추가(사주·타로 낱말 문장 제외 · 준비 칸 수에는 0) |
| A 화면 | `src/doit/components/feature/AgentProfileCheck.tsx` | 「맞아요」 = 서버 확인 · 정정 뒤 영수증 줄(서버 문장만) · 「ECHO가 아는 나 보기」 |
| A 화면 | `src/doit/components/feature/AgentConversation.tsx` | 자유 입력 정정·직전 답 고치기도 같은 영수증 줄 |
| A4 화면 | `src/doit/pages/do-it/understanding/page.tsx`, `understanding-pages.css` | 「ECHO가 아는 나」 네 칸(확인 / AI 짐작·확정 아님 / 고친 것 / 아니라고 한 것) · 줄마다 지우기 · 민감 주제 글자 미표시 |
| B 사주·타로 | `supabase/functions/doit-agent/reference-talk.ts`, `index.ts` | 해석 부정(`denyInterpretation`) = 고정 영수증 「사주보다/카드보다 당신 말이 맞아요. 「…」로 기억할게요.」 + `correction`(모델 0 · 저장 0) |
| B 화면 | `src/doit/app/plan-a/screens/RefTalk.tsx`, `ref-talk.css` | 「이 말, 내 프로필에도 반영할까요?」 [반영할게요]/[여기서만 기억] → 반영일 때만 `agent_self_note`(해석 원문 0) |
| C/D/E 서버 | `supabase/functions/doit-agent/free-talk.ts`(새) | 스위치 `FREE_TALK_ENABLED=on`(기본 꺼짐) · 맛보기 3회(계정당 평생) · 유료 권한(`doit_entitlements` 초안 또는 QA 시험용 `FREE_TALK_TEST_USERS`) · 하루 30회(`FREE_TALK_DAILY`) · 월 5,000원(`FREE_TALK_MONTH_KRW`) · 회사 월 10,000원(`FREE_TALK_COMPANY_MONTH_KRW`) · 요청당 호출 3 · 토큰 8,000 · 출력 768 · 요청당 0.01달러(`FREE_TALK_MAX_COST_USD` · 단가로 토큰 상한 재계산) · **단가(AI_POLICY openai.price)·환율(`FREE_TALK_KRW_PER_USD` 또는 `COMPANY_AI_KRW_PER_USD`) 없으면 호출 0(503)** · 유료 권한은 `doit_entitlements` 초안 · 계정 메타 `app_metadata.doit_free_talk=true` · `FREE_TALK_TEST_USERS` 셋 중 하나 · OpenAI 첫 후보만 · 가드(위기·연락처·성적·주입·역할극) · 답 글 저장 0(금액·토큰만) |
| C 화면 | `src/doit/pages/do-it/talk/page.tsx`(새) · `routes.tsx` · `agentApi.ts` | 「나를 기억하는 ECHO와 무엇이든 대화」 · AI 표시 · 모델명 0 · 가격 숫자 0 · 결제 버튼 0(토스 심사 중) · 스위치 꺼짐 안내 |
| DB 초안 | `supabase/drafts/PENDING_20261006_free_talk.sql` | 유료 권한 표(실행 금지 · 승인 대상) |
| 검사 | `qa/memory-receipt-20261006.test.mjs`, `qa/free-talk-20261006.test.mjs`, `qa-real/qa-memory-live.mjs`, `.github/workflows/echo-qa-agent-live.yml` | 모의 검사 2벌 · QA 실서버 검사 1벌(워크플로에 연결) |

## 2. 검사 숫자(실제 실행한 것만)

| 검사 | 결과 |
|---|---|
| 앱 type-check / lint | PASS / PASS |
| 서버 함수 타입 검사(기준선 대조) | 기준선과 같음(Deno 전역 미인식 7→9건은 새 파일의 `Deno.env` 참조 · 기존과 같은 종류) |
| qa 단위 검사(모의) | 아래 「최종 수치」 |
| qa-independent | 아래 「최종 수치」 |
| 브라우저 흐름(Playwright · 가짜 서버) | 아래 「최종 수치」 |
| QA 실서버·실제 AI(`qa-memory-live.mjs`) | **확인 불가(아직)** — QA 서버 배포 뒤 워크플로가 돈다(병합 조건 §6 참고) |

모의 검사 PASS ≠ 실제 AI 검사 PASS. 실제 AI 검사는 QA 배포 뒤 결과를 따로 적는다.

## 3. 턴당 비용 실측(QA 최근 7일 · 실제 사용량 기록 doit_request_events · 읽기만)

| 경로 | 건수 | 평균 입력 토큰 | 평균 출력 토큰 | 평균 호출 수 | 최대 입력 |
|---|---|---|---|---|---|
| 핵심 대화 턴(agent_turn) | 279 | 10,560 | 574 | 4.30 | 25,239 |
| 참고 이야기(agent_ref) | 19 | 413 | 44 | 1.42 | 673 |
| 타로 해석(agent_card) | 7 | 265 | 231 | 1.43 | 265 |

단가(OpenAI 공개 가격 · 2026-10-06 검색 확인 · GPT-4o mini): 입력 $0.15/1M · 출력 $0.60/1M. 환율은 **가정값 1,400원/USD**(운영 환율은 `COMPANY_AI_KRW_PER_USD` 설정값으로 확정 필요).

| 경로 | 턴당 평균 비용 | 턴당 최대(어림) |
|---|---|---|
| 핵심 대화 턴 | 약 2.7원 | 약 6원 |
| 참고 이야기 | 약 0.12원 | 약 0.2원 |
| 자유 대화(예상 · 재료 known+앞 줄 8개 포함 입력 ≈ 1,500 · 출력 ≈ 150) | **약 0.4~0.5원** | 호출 3회 상한 시 약 1.5원 |

자유 대화는 아직 실호출 0건 → 위 자유 대화 값은 예상치. QA 에서 켠 뒤 실측해 갱신한다.

### 상한 추천 3안(월 비용 상한 5,000원 기준)
| 안 | 하루 상한 | 월 상한 | 뜻 |
|---|---|---|---|
| 1안(보수) | 20회 | 3,000원 | 턴당 0.5원이면 월 600턴 · 비용보다 「습관 과몰입」 방지 목적 |
| 2안(권장 · 지시값) | 30회 | 5,000원 | 지시값 그대로 · 턴당 0.5원이면 월 900턴 상한 전에 하루 상한이 먼저 걸림 |
| 3안(넉넉) | 50회 | 5,000원 | 유료 사용자 체감 제약 최소 · 월 1,500턴 ≈ 750원 |

→ 어느 안이든 월 5,000원에 닿으려면 턴당 비용이 지금 어림의 10배 이상이어야 한다. 실측 뒤 월 상한보다 **하루 상한**이 실질 조절값.

## 4. 개인정보 처리방침 확인(B.7)
`src/lib/legal/documents.ts` 「2. 개인정보의 이용 목적」 ⑧에 「ECHO가 대화를 바탕으로 작성한 프로필 초안(「ECHO가 이해한 나」)의 표시·확인·정정」이 있다. 이번 기능 중:
- 정정 영수증·네 칸 표시·줄 지우기 = ⑧ 범위 안(표시·확인·정정).
- **사주·타로 이어 대화에서 회원이 「반영할게요」로 직접 남긴 자기 문장을 연결 후보 선정 재료로 쓰는 것** = ⑦·⑧에 명시가 없음 → 문구 초안 필요(아래 §5-3). 적용·동의 버전 변경은 대표 승인 뒤(임의 변경 0). 사주·타로 해석 원문은 저장·매칭 사용 0(기존 기준 유지).
- 유료 자유 대화 = ③(유료 결제) 범위 · 「대화 내용을 서버에 저장하지 않음(사용량·금액만)」은 처리방침에 적는 편이 안전(아래 §5-2).

## 5. 법무 문구 초안(G.23 · 초안만 · 적용은 대표 승인 뒤)
### 5-1 유료 자유 대화 해지·환불 안내(이용약관 제5조 보강안)
> 「나를 기억하는 ECHO와 무엇이든 대화」 이용권은 결제일부터 사용할 수 있고, 언제든 앱의 설정에서 해지할 수 있습니다. 해지하면 다음 결제가 되지 않고, 이미 결제한 기간은 끝까지 쓸 수 있습니다. 결제 뒤 7일 안에 이용권으로 한 번도 대화하지 않았다면 전액 환불합니다. 7일 안에 대화를 시작했다면 남은 기간을 일할 계산해 환불합니다. 회사의 장애로 이용하지 못한 날은 그만큼 기간을 늘리거나 환불합니다. 환불 요청은 회사 이메일로 접수하며 3영업일 안에 결과를 알립니다.

### 5-2 AI 고지 문구(화면 · 처리방침 공통)
> ECHO의 답은 AI가 만듭니다. ECHO는 회원이 직접 확인하거나 고친 이야기만 기억하고, 다른 회원의 정보는 알지 못합니다. AI의 짐작은 사실이 아니며, 회원은 「ECHO가 아는 나」에서 언제든 확인·정정·삭제할 수 있습니다. 자유 대화의 내용은 서버에 저장하지 않고, 이용 횟수·사용량·금액만 기록합니다. 위급한 상황에서는 전문 기관(자살예방상담전화 109)에 연락해 주세요.

### 5-3 사주·타로 정정 → 연결 재료 사용 목적 문구(처리방침 ⑦·⑧ 보강안)
> ⑩ 사주·타로 결과 뒤 이어진 대화에서 회원이 해석을 바로잡으며 직접 적고 「반영할게요」로 고른 문장은, 회원 자신의 말로서 「ECHO가 아는 나」에 표시되고 연결 후보 선정 재료에 더해집니다. 사주·타로 해석 자체와 생년월일·시간은 연결 재료로 쓰지 않습니다. 회원은 그 문장을 언제든 지울 수 있습니다.

## 6. 2단계 계획서(1단계 지시 6·7 · 실행은 대표 승인 뒤)
- **6(사주·타로 정정 → 프로필 후보)**: 이번 구현으로 「회원 확인([반영할게요]) 뒤 자기 문장만 저장」까지 들어갔다. 남은 것 = 처리방침 ⑩ 문구 적용(동의 버전은 바꾸지 않음 · 대표 결정) · 자기 문장을 「원하는 만남 알아보기」 대화의 heard 재료로도 넘길지(지금은 네 칸·연결 재료에만).
- **7(짐작 질문 · 회차당 1번 · 짐작임을 명시 · 단정 금지)** 문구 3안:
  1. 「제 짐작인데 맞을지 모르겠어요. 혹시 ○○ 쪽에 더 가까운가요?」
  2. 「틀릴 수도 있는 짐작 하나만요. ○○이 편한 편이에요? 아니면 다른가요?」
  3. 「확인은 안 된 제 느낌인데, ○○ 같아 보여요. 맞으면 맞다고, 아니면 아니라고 해 주세요.」
  → 서버가 회차당 1번만 허용(`st.guess_asked`) · 답은 USER_CONFIRMED/거절(RETRACTED)로 기록 · 「모르겠어요」도 정상. 구현은 승인 뒤.

## 7. 병합·게시 조건과 남은 것
- 최종 지시: 「echo-qa 병합·QA 게시는 Codex 통과 후」. Codex 는 2026-10-06 현재 사용 한도 초과(#147 자동 댓글) → **PR 을 올려 두고 Codex 재검수(토요일) 또는 대표 「병합」 한마디를 기다린다**. 대표가 Codex 없이 병합을 원하면 그때 QA 서버 함수 배포 요청 파일을 올리고 QA 게시·실서버 검사까지 진행한다.
- QA 에서 자유 대화를 켜려면 QA 함수 환경값 `FREE_TALK_ENABLED=on` · `FREE_TALK_DAILY=10` · `FREE_TALK_KRW_PER_USD=1400`(또는 기존 `COMPANY_AI_KRW_PER_USD`) · `AI_POLICY` 에 openai `price`(0.15/0.60) · `FREE_TALK_TEST_USERS=<시험 계정 id>` 설정이 필요(Secret 변경 = 대표 승인 대상). 켜지 않으면 QA 실서버 검사 ⑩은 「꺼짐=503」만 확인한다.
- 회사 월 예산 10,000원(E.17) 적용은 `COMPANY_AI_BUDGET` 장부(초안 미적용)와 함께 — 아직 꺼짐.
- 캡처: 모의 서버 기준 6장은 PR 본문·`docs/release/shots-20261006/`에 · QA 실화면 캡처는 QA 게시 뒤 추가.

## 8. 운영 배포 실행 순서(2026-10-06 대표 「테스트 진행 후 운영 배포」 · 대표 손으로 누르는 부분 표시)

이 세션에서 **할 수 없는 것**(자동 안전장치가 막음 · 우회하지 않음): ① PR #148 병합 버튼(「검토 없는 병합」으로 차단) ② 운영 배포 실행 ③ 운영 배포 워크플로 파일 추가. 아래 ★ 표시가 대표가 직접 누르는 단계다. 나머지는 병합 알림이 오면 이 세션이 이어서 한다.

| 순서 | 할 일 | 누가 | 방법 | 확인 |
|---|---|---|---|---|
| 1 | PR #148 → echo-qa 병합 | ★대표 | GitHub 앱 → Pull requests → #148 → **Merge pull request**(일반 merge) | 병합 뒤 Actions 에 `echo-qa-edge-deploy`(doit-agent · doit-connect 2개) · `echo-netlify-deploy`(검사만) 자동 시작 |
| 2 | QA 서버 함수 배포 확인 | 세션 | Actions 결과 읽기 · QA 함수 판 번호 증가(doit-agent 107→, doit-connect 70→) | 로그인 없는 요청 401 · 사전 요청 200 |
| 3 | QA 앱 게시(1곳 · 15 credits) | 세션 | `echo-netlify-deploy` 수동 실행 target=qa · qa_roles=app | https://echo-app-qa.netlify.app 새 판 |
| 4 | QA 실서버 버튼 검사(시작부터) | 세션 | `qa-real/qa-memory-live.mjs`(워크플로) + 전체 버튼 스윕 스크립트 · 캡처 | FAIL 0 이어야 5번으로 |
| 5 | 운영 서버 함수 배포(doit-agent · doit-connect · doit-understanding) | ★대표 | 방법 A: Supabase 대시보드 → 운영 프로젝트(zyyhhxyupizcqhxqnxuu) → Edge Functions → 각 함수 「Deploy」(echo-qa 파일 그대로) · 방법 B: `product/docs/release/DRAFT_echo-prod-edge-deploy.yml.txt` 를 `.github/workflows/echo-prod-edge-deploy.yml` 로 올린 뒤 Actions 에서 go=GO 로 실행(ECHO-PROD 승인) | 운영 판 번호 증가(doit-agent 17→, doit-connect 9→, doit-understanding 29→) · 로그인 없는 요청 401 |
| 6 | 운영 함수 비밀값 확인(값은 보지 않음 · 있음/없음만) | ★대표 | Supabase 대시보드 → Edge Functions → Secrets: `OPENAI_API_KEY` · `MATCH_SOURCE=agent` · `CORS_ALLOWED_ORIGINS`(app.do-it.company 포함) · `FREE_TALK_ENABLED` 은 **두지 않음(기본 꺼짐)** | 없으면 5번 배포 뒤 첫 대화가 503/500 |
| 6-2 | 사진 AI 확인(doit-photo-check)이 사진을 OpenAI 로 보내는 점과 처리방침 불일치(GF-95) — 재동의·일시중지·법무검토 중 결정 | ★대표 | 운영 배포 전 결정 · 이번 PR 은 그 함수를 건드리지 않음 | 결정 전엔 사진 확인 기능 안내 문구 검토 |
| 7 | 운영 웹·앱 게시(1회 빌드 · brand+app 2곳 = 30 credits) | ★대표 | Actions → `echo-netlify-deploy` → Run workflow: target=**prod** · prod_roles=**brand,app** · go=**GO** → ECHO-PROD 환경 승인 | do-it.company · app.do-it.company 새 판 · Stale Redirect Guard 통과 |
| 8 | 운영 확인(읽기만) | 세션/대표 | 홈 → 로그인 → 대화 시작 → 정정 1회 영수증 → 「ECHO가 아는 나」 → 사주·타로 시작 그림 | 실기기 1대 확인 전에는 「운영 확인 완료」라 쓰지 않음 |

Netlify 절약: QA 는 app 1곳만(brand 는 이번 PR 에서 안 바뀜) · 운영은 brand,app 을 **한 번의 실행**으로(빌드 1회 · 게시 2곳). admin 은 운영에 없음(QA 전용).

되돌리기: 운영 함수는 Supabase 대시보드에서 이전 판(doit-agent v17 · doit-connect v9 · doit-understanding v29) 복원 · Netlify 는 사이트 → Deploys → 이전 배포 「Publish deploy」.

주의(운영 전 대표 판단 필요): ① 사주·타로 시작 화면 그림 2장은 검색 결과 이미지라 저작권 확인 전에는 운영 노출을 권하지 않음(#147) ② 자유 대화는 운영에서도 스위치 꺼짐(503) — 토스 심사 뒤 켜기 ③ `doit_entitlements` 표는 초안만(운영 DB 변경 0).


## 9. 2026-10-06 21:30 인계(다른 세션 PR #149) 대조 · 보강 결과

같은 대표 지시를 두 세션이 각각 구현했다. **PR #148(이 PR)과 PR #149는 같은 파일 11개(agent.ts · index.ts · free-talk.ts · reference-talk.ts · RefTalk.tsx · AgentConversation.tsx · agentApi.ts · routes.tsx 등)를 다르게 고쳐서 둘 다 병합할 수 없다.** 아래 표대로 #149 에만 있던 것을 #148 에 보강했으므로, 권장 = **#148 병합 · #149 닫기(기록 보존)**. 최종 선택은 대표.

| #149(인계문) 항목 | #148 상태 | 보강(이번 커밋) |
|---|---|---|
| 영수증: 서버 저장 뒤 고정 한 줄(AI 0) | 있음(`turn.receipt`) | — |
| 건강·성·돈 이야기면 일반 문장 「알겠어요. 고친 내용으로 기억할게요.」 | 없었음 | **추가**(`makeReceipt` · 다음 질문 인용도 0) |
| 고치는 말일 때만 지시 한 줄(latest_may_fix) · 짚었는지 관측(fix_cited) | 다른 방식: 서버가 고정 문장으로 인용(`cite` · 모델에 맡기지 않음) + `user_corrected` 재료 | 관리자 탭에 「인용 턴 수」 표시로 관측 |
| 「ECHO가 아는 나」 4칸 · 줄 지우기 | 있음(/doit/understanding · 아니라고 한 것도 지우기 가능) | — (지우기 범위는 대표 선택) |
| 사주·타로 정정 → 영수증 → [반영할게요] → USER_CORRECTED | 있음(`agent_self_note` · 「내가 고친 것」 + 연결 재료) | — |
| 자유 대화 스위치 기본 끔 · 맛보기 3회 · 하루 30 · 한 사람 월 5,000원 | 있음 | — |
| 회사 한 달 10,000원 | 없었음(회사 예산 장부에만 의존) | **추가**(`FREE_TALK_COMPANY_MONTH_KRW` · 모든 사용자 합산 · 못 세면 닫힘 503) |
| 요청 하나 = 호출 3 · 토큰 8,000 · 0.01달러 | 호출·토큰만 | **추가**(`FREE_TALK_MAX_COST_USD` · 단가로 토큰 상한 재계산) |
| 단가·환율 없으면 호출 0 | 없었음(월 300턴 대체 상한) | **추가**(503 FREE_TALK_CONFIG · 대체 상한 삭제) |
| 권한 = app_metadata 또는 테스트 계정 목록 | 테스트 목록 + `doit_entitlements` 초안 | **추가**(`app_metadata.doit_free_talk` / `doit_free_chat`) |
| 사용자 잠금 안에서 상한 셈(동시 요청) | 있음(`freeCapped` · 자리 잠금 안) | — |
| 위기·성적·역할극·연락처 = 모델 0 · 재료 = 본인 것만 · 글 저장 0 | 있음 | — |
| 대화 중 말 종류 ask + 스위치 켜짐 → 「맛보기 N번 남았어요」 안내 | 없었음(참고 이야기 화면에만) | **추가**(AgentConversation · 기본 꺼짐이면 0) |
| 관리자 모바일 「기억·자유 대화」 탭 + admin_free_summary | 없었음 | **추가**(수치만 · 글 0 · 관리자 역할 서버 재확인) |
| 관리자 사이트 Revenue 에 자유 대화 이번 달 비용 | 없었음 | **추가**(admin/api.ts 에 doit-agent 허용 · 관리자 사이트 → doit-agent CORS 허용 주소는 QA 에서 확인 필요) |
| 추천 이유 「고쳐 주신 대로 ~」(doit-connect) | **#148 에만 있음** | — |
| 법무 초안 · 처리방침 확인 | 있음(§4·§5) | — |
| 검사(모의): #149 전체 1423/0 · 새 21 | #148 전체 아래 「최종 수치」 · 새 memory-receipt 9 · free-talk 12 | — |

#141(사주 이야기 · openai-chat 하루 제한 · KEY 안내)은 #148 과 파일이 겹치지 않는다(별도 병합 가능).

인계문의 열린 결정(대표): 자유 대화 한도(권장 하루 30 · 한 사람 월 5,000 · 회사 월 10,000) · KEY 값 · 처리방침 「사주 정정 매칭 사용」 문구 삽입 여부(재동의 포함) · 사진 AI 확인(doit-photo-check)이 사진을 OpenAI 로 보내는 것과 처리방침 불일치(GF-95 · 재동의/일시중지/법무검토).


## 10. QA 실서버 검사 결과(2026-10-06 · echo-qa 04d0086 · QA doit-agent v108 · doit-connect v71 · 앱 게시 run 37474883424)

| 검사 | 결과 | 근거 |
|---|---|---|
| 핵심 대화(실제 AI · qa-core-live) | **28 PASS / 0 FAIL** | run 37499187947 core_live |
| 타로 해석·참고 이야기(실제 AI · qa-tarot-ref-live) | **12 PASS / 0 FAIL** | 같은 run |
| 기억 영수증·아는 나·사주 정정·자유 대화 스위치(qa-memory-live) | **12 PASS / 0 FAIL** | 같은 run(⑥ 판정 보정 뒤 · PR #150) |
| QA 게시본 전체 버튼 검사(브라우저 · 실제 AI · qa-live-sweep) | **44 PASS / 0 FAIL** | run 37501471159 app_sweep(스크립트 흐름 보정 뒤 · PR #150) |

실서버에서 확인된 것(실제 AI): 자유 입력 정정 → 서버 저장 뒤 영수증 「알겠어요. 「연락은 매일 하는 게 좋아요」가 아니라 「주말에 한두 번 연락하는 것이 좋음」으로 기억할게요.」 · 다음 질문에 인용 「…으로 알아들었어요.」 · 거절된 뜻 재등장 0 · 「ECHO가 아는 나」 고친 것에 새 뜻 · 줄 지우기 · 사주 해석 부정 → 「사주보다 당신 말이 맞아요」 → [반영할게요] → 「내가 고친 것」 · 타로 시작 그림 → 카드 → 실제 AI 해석 → 「카드 이야기 듣기」 → 오픈 기간 문구 → 카드 참고 이야기 · 자유 대화 스위치 꺼짐(503) · 화면 JS 오류 0 · 서버 5xx 0.

중간에 난 FAIL 7건은 모두 검사 스크립트의 흐름·판정 문제였고 제품 결함은 0건(PR #150 표). 실기기(아이폰 사파리) 확인은 아직 0 — 「운영 확인 완료」가 아니다.
