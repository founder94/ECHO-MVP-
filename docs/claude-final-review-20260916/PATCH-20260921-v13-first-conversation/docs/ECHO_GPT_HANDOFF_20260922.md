# ECHO(DO IT) 「당신이 잠든 사이」 AI 대화 — 현재 상태 총정리 (2026-09-22, GPT 전략 검토용)

> ⚠️ **폐기된 옛 가격 표시 (2026-09-26 대표 결정)**: 이 문서의 4,900원은 **폐기된 옛 구조(legacy)** 이며 현재 가격이 아닙니다. 현재 가격은 미확정입니다. 과거 기록 보존을 위해 본문은 그대로 둡니다.

## 1. 제품·구조(대표 확정)
- 제품 = 만남 목적 중심 개인화 AI. 브랜드 홈 do-it.company(브랜딩만) / 제품 앱 app.do-it.company(PWA, 로그인·대화·사진·연결). 코드 한 벌, 빌드 스위치 VITE_SITE_ROLE=brand|app.
- 기술: Vite+React 19, Supabase(Auth·DB·RLS·Edge Functions), OpenAI(gpt-4o-mini, Edge Function 안에서만 호출), Netlify 수동 ZIP 배포. Stripe 없음, 가격 4,900원 단건 유지.
- 대원칙: 사용자 원문이 진실. LLM은 후보만 만든다. 최종 질문·상태 변경은 서버가 검증 후 확정. 프론트는 상태를 만들지 않는다(RLS SELECT만).

## 2. 대화 흐름(지금 코드 기준)
1) 첫 화면(/doit/start-journey): "어떤 만남을 원하세요?" 목적 타일 + 한 줄 적기 → profiles.purpose_id, 한 줄은 doit_records 에 원문 저장.
2) 대화(/doit/conversation): 회차에 아직 말이 없으면 고정 첫 질문 1개 — "당신이 잠든 사이, 요즘 가장 자주 떠오르는 사람이나 마음은 뭐예요?".
3) 사용자 답 → record_create(원문 그대로 저장, 연락처·링크·성적 표현은 규칙 차단) → insight_generate(AI 이해 후보 최대 3개, 상태 candidate=TENTATIVE).
4) 4버튼: 맞아요→confirmed / 조금 달라요→corrected(사용자 문장, 원래 AI 문장은 ai_text 보존) / 그게 아니에요→rejected / 직접 설명할게요→origin self + confirmed. 전이는 DB 함수만(revision 검사).
5) followup_generate(다음 질문): 서버가 전략을 정함 → 정정 뒤 ACKNOWLEDGE_CORRECTION, 직접 설명 뒤 EXPLORE_USER_MEANING, 거절 뒤 RECOVER_FROM_REJECTION, 확인 뒤 DEEPEN, 행동 없음+짧은 답 CHANGE_DIRECTION(아직 안 나온 주제: 끌리는 스타일→중요한 성향→나의 모습→요즘 마음, 참고용 나침반이지 고정 순서 아님). LLM은 주제 전환(원문 인용 필수)·두 갈래 되묻기만 제안 가능.
6) LLM 입력: 직전 원문, 확인·정정·직접 설명한 말(정정 최우선), 거절한 해석, 정정 전 AI 문장(superseded, 전제 금지), 이미 물은 질문, 목적, 전략, 참고 주제. DB 행·인증정보는 안 넘김.
7) 서버 검증: 질문 존재·200자 / 질문 하나 규칙(물음표 1개, "A? 아니면 B?"만 2개, 의문사 3개 이상 불허) / 이미 물은 질문과 같은 뜻 폐기 / 직전 말과 이어지는지(새 갈래 제외) / 거절 뜻 글자 겹침 차단 / AI 판정(단정·유도·반복·정정 무시 불허) / 거절 의미 판정. 실패해도 멈추지 않고 고정 대체 문장(거절 뒤 "제가 방향을 잘못 잡았네요…", 그 외 주제 문장)으로 이어감.
8) 저장 순서: 사용자 입력 저장 → 상태 계산 → LLM → 검증 → AI 결과 저장(context_hash 재검사) → 응답. 같은 requestId 재전송은 저장된 결과 반환(멱등: UNIQUE(user_id, request_id)+advisory lock+payload_hash).
9) 처음부터 다시: 회차 시각(user_metadata.doit_round_started_at)만 바꿈. 이전 회차 자료는 지우지 않고 "이전 회차 이야기"로 다시 볼 수 있음.
10) 당신이 잠든 사이(/doit/connections): 연결 자격 = 전화 인증 + 확인한 이해 5개 + 필수 사진 3장 + 소개. 같은 목적 사람 중 확인한 말이 겹치는 후보 수·겹친 내 말(≤3)만 표시. 사람을 자동 선택하지 않음(첫 100명 대표 수동 승인). 이름·사진은 공개 안 함(blind-first).

## 3. 데이터(운영 DB 실제 확인, 변경 없음)
- doit_records: original_text(원문), text, status, revision, request_id
- doit_insights: text, ai_text, category(value/pattern/memory), status(candidate/confirmed/corrected/rejected), origin(ai/self), source_record_id, revision
- doit_request_events: request_id, action, payload_hash, status(pending/applied/failed), response_payload(질문·구제 저장), context_hash, lease_token
- RPC 14개(doit_apply_*, doit_begin/finish_followup, doit_begin/finish_insight_generate, doit_followup_context, doit_get_followup). 본문 6개 = 로컬 초안과 md5 동일.
- 새 테이블·칼럼 필요 없음(§21 계약 B=0건).

## 4. §21 AI 입력·출력 계약 대조 결과
- 일치: 사용자 원문 보존, confirmed/tentative/rejected 3상태, 거절 처리(id 식별→rejected→LLM 자료→이중 차단), 중복 요청 방지.
- v13.5에서 보완: 전략 필드(서버 결정), 이미 물은 질문 전달·반복 차단, 질문 하나 규칙, 정정 전 문장 전제 금지, 응답에서 내부 진단(trace)·구제 종류(kind) 제거, 실패 로그 detail.
- 남은 부분 일치: 구조화 출력은 json_object(strict json_schema 아님), 화면 오류 코드는 AI_ERROR 하나(로그에서만 timeout/no_candidate/provider_error 구분), 주제 이탈 재판정은 비용 문제로 보류.

## 5. 검사 현황(진짜/가짜 구분)
- 가짜 AI 기준(서버 실제 코드 + 가짜 OpenAI/가짜 DB): 흐름 검사 24/24 통과 — TEST A 맥락 연결, B 거절, C 정정, D 직접 설명, E 주제 전환, F 반복 방지, 질문 하나 규칙, 응답 노출 검사 포함.
- 화면 검사 39/39, 전체 단위 234/235(실패 1건은 기존 step7-contract, 범위 밖). tsc 0, eslint 0, 빌드 통과, 앱 스모크 10/11(실패 1 = 샌드박스 Supabase 차단).
- 실제 서버 기준: 운영 doit_request_events 에서 옛 서버(v13.3)의 AI_ERROR 2건·빈 되묻기 구제("어떤 질문을 하고 싶으신가요?") 확인 → 이번 수정의 근거.
- 실AI·실기기: 확인 불가(v13.5 미배포, 실계정 토큰 미사용). "완료" 아님.

## 6. 배포 상태
- 서버 doit-understanding: 운영 = 버전 15(v13.3). 로컬 = v13.5(v13.4 회차·연결 준비·대체 문장 포함). 대표 "서버배포승인" 대기.
- 앱: 14차 ZIP(첫 질문 카드·전략 응답 수용) 전달, Netlify doitmobile 에 대표가 수동 업로드. 브랜드: 13차 ZIP.
- doit-photo-check: 버전 1 배포됨(판정 결과 저장 칼럼 SQL 미실행 → 화면 반환만).
- STOP 항목 변경 0: DB·RLS·Migration·Edge 운영배포·모델·Secret·결제·Netlify.

## 7. 다음 순서
1) 서버배포승인 → v13.5 배포 → 올라간 파일 글자 단위 대조 → 무인증 401 확인.
2) 앱 14차 업로드 → 실기기: 목적 타일 → 답 → "그게 아니에요" → 다음 질문 변화 확인(핵심 차별성 증명).
3) 그 뒤: PENDING SQL(사진 판정 저장 칼럼·동의 기록) 승인·실행, 전화 인증, 연결 후보 테이블 초안, 대표 수동 승인 화면.

## 8. 보안·운영 규칙(불변)
- 비밀번호·OTP·JWT·API 키를 채팅·코드·로그·문서에 넣지 않는다. 실계정 검사는 0423doit@gmail.com 하나만. 사용자 원문은 로그에 남기지 않는다.
- Anonymous Sign-In 금지, Email Confirm 유지, 운영 Auth 설정 변경 금지, 관리자 권한 부여 금지.
- 코드 수정 승인과 운영 배포 승인은 별개. DB·RLS·마이그레이션·배포·결제·파일 삭제는 대표 승인 뒤에만.
