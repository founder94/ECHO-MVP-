# doit-understanding v9b — 후보 수 제한(`limit`) 별도 수정안 (적용 전 · 모델 보정 v9 와 독립)

작성 2026-09-21 · 대상: 운영 `doit-understanding` v8 (ezbr `6081b474…`). 모델 보정(v9)과 **분리된** 수정안이다. 둘을 같이 적용하면 v9c, 하나만 적용해도 된다.

## 원칙

- 화면에서 숨기지 않는다. **서버가 생성 → 검사 → 자른 뒤 → 저장·반환·캐시**를 같은 목록으로 한다.
- 근거 있는 후보가 0개면 0개(구제 질문)다. 숫자를 채우려고 후보를 만들지 않는다.
- `limit` 을 보내지 않는 기존 호출자(QA 화면, 7화면 흐름)는 v8 과 동일하게 동작한다(기본값 = 제한 없음).
- `limit` 은 payload hash 에 포함되므로 다른 limit = 다른 요청이다(멱등 충돌 없음).

## 수정 (2 hunk)

### hunk 1 — `LIMITS` 에 상한 추가

```ts
const LIMITS = {
  …(기존 그대로)…
  CANDIDATES_PER_CATEGORY: 3,
  // 요청이 limit 을 주면 생존 후보를 이 개수 이하로 자른다. 주지 않으면 자르지 않는다(v8 동작).
  CANDIDATES_RETURN_MAX: 3,
  …
} as const;
```

### hunk 2 — `insight_generate` 처리부: 생존 후보를 자른 뒤 저장한다

```diff
     if (action === "insight_generate") {
       const recordId = typeof body.recordId === "string" ? body.recordId : "";
       if (!recordId || !requestId) return fail(CODES.BAD_REQUEST, "요청 식별값이 없어요.", 400, origin);
+      // 후보 수 제한: 1..CANDIDATES_RETURN_MAX 정수만 인정. 없거나 범위 밖이면 제한 없음(v8 과 동일).
+      const limitRaw = body.limit;
+      const limit = Number.isInteger(limitRaw) && (limitRaw as number) >= 1 && (limitRaw as number) <= LIMITS.CANDIDATES_RETURN_MAX
+        ? (limitRaw as number) : null;
 …
       try {
         gen = await generateInsights({ apiKey, model, recordText, rejected, confirmed, budget, purpose: claim.context.purpose });
+        if (gen && limit !== null && gen.candidates.length > limit) {
+          // 검사를 통과한 순서대로 앞에서 자른다. 잘린 수는 trace 에 남긴다(진단용, 원문 없음).
+          gen.trace.dropped_by_limit = gen.candidates.length - limit;
+          gen.candidates = gen.candidates.slice(0, limit);
+        }
       } catch (e) {
```

`GenTrace` 에 `dropped_by_limit?: number` 필드를 추가한다(선택 필드, 기존 로그 형식 호환).
`doit_finish_insight_generate` 는 잘린 `p_candidates` 를 저장하고 그 응답을 `response_payload` 에 캐시하므로, **저장 = 반환 = 캐시**가 같은 목록이다. DB 함수 변경 없음.

## 화면 쪽(별도 클라이언트 diff · `optional-candidate-limit/`)

- 첫 이야기: `limit: 1` — 후보 1개를 우선 제시.
- 두 번째 이야기: `limit: 3`.
- 서버가 `limit` 을 모르는 v8 이면 필드가 무시되어 v8 동작(최대 9개)이 된다. 화면은 어느 쪽이든 동작한다.

## 비용

프롬프트는 바꾸지 않으므로 생성·근거 판정·거절 판정의 AI 호출 수는 v8 과 같다(최대 1+1+1 per attempt). 제한은 **사용자 조작 수**만 줄인다. 호출 수까지 줄이려면 프롬프트의 "카테고리당 최대 3개"를 낮추는 별도 결정이 필요하다(품질 영향 → 실AI 비교 후 결정).

## 검증

- 모의: `limit:1` 요청에 서버가 2개 이상 만들어도 1개만 저장·반환, 재요청(같은 requestId)도 1개, `dropped_by_limit` 기록.
- 실AI(배포 후, QA 계정만): 같은 기록에 `limit` 없이 1회, `limit:1` 로 1회 → 저장 행 수 비교.

## 승인 형식

필요 이유: 후보 최대 9개 → 확인 조작 과다(§조작 수 실측). / 대상: Edge v8 → v9b. / 변경: 2 hunk + 선택 필드 1개. / 영향: `limit` 을 보내는 호출만. / 복구: v8 재배포.
