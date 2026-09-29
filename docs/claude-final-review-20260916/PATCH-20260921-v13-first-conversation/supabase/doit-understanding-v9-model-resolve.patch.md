# doit-understanding v9 — 모델 이름 해석 보정 (최소 수정안 · 적용 전 · 배포 승인 별개)

작성 2026-09-21 · 대상: 운영 `doit-understanding` **v8** (ezbr `6081b474b1b5c5851013aee4e27b52edcce0740614acf011e529a6987eca0158`, 읽기 전용으로 내려받아 대조)

## 왜

| 함수 | OPENAI_MODEL 처리(현재 운영 소스) | 결과 |
|---|---|---|
| get-step-question v48 `ai.ts` | `resolveModel()`: 공백 제거 + 빈값/`gpt-40-mini`(숫자 40) → `gpt-4o-mini` | 09-20 06:30 UTC 정상 호출(`model=gpt-4o-mini` 로그) |
| echo-journey v26 | 같은 `resolveModel()` | 정상 |
| **doit-understanding v8** | `Deno.env.get("OPENAI_MODEL") ?? ""` **그대로** | 09-20 18:34·18:38 UTC `provider_http_404 / model_not_found` |
| openai-chat v2 | 그대로(코드 주석: "기본 모델명을 두지 않는다") | 미확인(이번 로그 창에 호출 없음) |

B 코드 주석에 근거가 있다: "2026-09-14 운영 장애로 확인된 오타(`gpt-40-mini`) … 서버에서 시크릿 값을 직접 편집할 수단이 없어 코드에서 방어한다."
즉 **Secret 값이 바뀌었다고 단정하지 않는다.** 같은 값을 B는 보정해서 쓰고 A는 그대로 써서 404가 나는 것이 가장 단순한 설명이다. Secret 값은 요구하지 않는다.

## 수정 (2 hunk · 다른 줄 무변경)

### hunk 1 — `OPENAI_URL` 상수 바로 아래에 추가

```ts
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
// 호출 주소는 환경변수로 바꿀 수 없다(비공식 게이트웨이 경유 금지).

// 모델 이름 해석 — get-step-question/ai.ts · echo-journey 와 동일한 규칙(B 와 통일).
// 값이 비어 있거나 2026-09-14 확인된 오타("gpt-40-mini")이면 기본 모델로 보정한다. 시크릿 값은 읽어도 로그에 남기지 않는다.
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
function resolveModel(raw: string | undefined): string {
  const m = (raw ?? "").trim();
  if (!m || m === "gpt-40-mini") return DEFAULT_OPENAI_MODEL;
  return m;
}
```

### hunk 2 — 요청 처리부(`Deno.serve` 안) 1줄 교체

```diff
-    const model = Deno.env.get("OPENAI_MODEL") ?? "";
+    const model = resolveModel(Deno.env.get("OPENAI_MODEL"));
```

`aiReady = !!apiKey && !!model` 은 그대로 둔다(키가 없으면 여전히 AI_NOT_CONFIGURED).

## 같은 모양의 코드 (함께 고칠 후보 · 이번 패치 범위 밖)

- `openai-chat` `index.ts:252` `const model = Deno.env.get("OPENAI_MODEL") ?? "";` — 사주·타로 무료 콘텐츠. 같은 1줄 교체 + 위 helper. 별도 배포 승인.

## 검증 계획

1. (배포 전) `deno check supabase/functions/doit-understanding/index.ts` — 형식 검사.
2. (배포 후, QA 계정 0423doit@gmail.com 만) QA 화면에서 `insight_generate` 1회 → `doit_request_events.response_payload->'trace'` 에 `provider_*` 없음 · `generated > 0` 확인. Claude 는 request_id 로 읽기 전용 대조.
3. 실패하면 그때 비로소 "Secret 값 확인"을 대표 콘솔 작업으로 올린다(값은 채팅에 쓰지 않는다).

## 승인 형식

- 필요 이유: A 실AI 후보 생성 성공 0/3 (실호출 기준), 원인 후보 1순위 = 모델 이름 미보정.
- 대상: Edge Function `doit-understanding` (v8 → v9). DB·RLS·Secret 변경 없음.
- 변경 내용: 위 2 hunk.
- 영향: A 엔진 AI 호출 전부. 다른 함수 무영향.
- 복구: v8 소스(ezbr `6081b474…`)로 재배포.
