# Model Capability Registry (v1 · 2026-09-25)

모델별로 **실제로 관측한 것만** 적는다. 관측 없는 칸은 「미관측」이다.

| 모델 | 어디서 | 관측(실제 AI) | 분리 여부 | 비고 |
|---|---|---|---|---|
| gpt-4o-mini(코드 기본값) | 운영 doit-understanding. **운영 Secret `OPENAI_MODEL` 값은 읽지 않아 실제 모델명은 확인 불가** | ① 표현만 바꾼 같은 뜻 질문 4회(GF-01) ② 「활동?갑자기?」를 answer 로 분류(GF-11, 당시 프롬프트 「애매하면 answer」) ③ 「활동」 칸 채우기형 질문(GF-08, 입력에 remaining 있음) ④ LLM 1호출 중앙 2,100ms · 최소 1,700 · 최대 4,040(n=15, 운영 Galaxy 11턴) | **모델 탓으로 분리 안 됨** — 매번 불리한 입력(Context)·서버 검사(Orchestration)가 함께 있었다 | JSON 형식 실패 기록은 이번 표본에 없음(없다는 뜻이지 검증 아님) |
| gpt-4o-mini · B-1.0 구조 | 로컬 하네스 | 미관측 — **REAL_AI = BLOCKED_BY_ENVIRONMENT**(키 없음 · 채팅 키 실행은 환경 보안 장치가 차단) | — | 입력·조건 사전 고정 완료(`FROZEN_INPUTS.json`) |
| Claude | — | 미관측 | — | 새 Provider 연결은 대표 승인 필요 |
| Gemini | — | 미관측 | — | 새 Provider 연결은 대표 승인 필요 |

## 모델 비교 Gate(다음 후보 · 지금은 열지 않음)
- 조건: 같은 B-1.0 구조·같은 Golden 입력으로 실제 AI 를 돌렸는데 **A·B 둘 다 약하다**는 블라인드 결과가 나올 때.
- 방법: `run-ab.mjs` 의 모델 호출만 Provider 어댑터로 바꾸고, 입력·서버 결정·검수표는 그대로 둔다.
- 필요 승인: 새 Provider API 키·연결(대표).
