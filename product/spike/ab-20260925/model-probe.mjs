// MODEL GATE 1단계(2026-09-25): 이 OpenAI 계정에서 실제로 쓸 수 있는 모델을 확인한다. 비교 실험이 아니다.
// - GET /v1/models(비용 0) → 실제 목록(이름만). 모델 이름을 지어내지 않는다: 아래 후보 규칙에 맞는 이름 중 목록에 실제로 있는 것만 시험한다.
// - 후보마다 B-1.0 과 같은 파라미터(temperature 0.2 · top_p 0.9 · max_tokens · json_object)로 아주 짧은 요청 1번:
//   같은 파라미터를 받는지(= 「MODEL 만 변경」 조건이 성립하는지) · 응답이 알려 주는 실제 세부판 이름 · usage · 지연.
// - 키는 환경 변수 OPENAI_API_KEY 로만 받는다(출력·저장 안 함). 사용자 원문·Golden 입력을 보내지 않는다(고정 문장만).
// 실행: node spike/ab-20260925/model-probe.mjs --out 결과.md --json 결과.json
import { writeFileSync } from 'node:fs';

const KEY = process.env.OPENAI_API_KEY ?? '';
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
// 후보 규칙 = 채팅 모델 계열의 기본 별칭(날짜 붙은 세부판 제외). 목록에 없으면 시험하지 않는다.
export const CANDIDATE_RULE = /^(gpt-4o-mini|gpt-4o|gpt-4\.1|gpt-4\.1-mini|gpt-4\.1-nano|gpt-5|gpt-5-mini|gpt-5-nano|gpt-5\.\d+|gpt-5\.\d+-mini|o3|o3-mini|o4-mini)$/;
export const MAX_PROBES = 10;
const PARAMS = { temperature: 0.2, top_p: 0.9, max_tokens: 32 };

if (!KEY) { const m = { MODELS: 'BLOCKED_BY_ENVIRONMENT', reason: 'OPENAI_API_KEY 없음' }; if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify(m)); console.log(JSON.stringify(m)); process.exit(2); }
const H = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const list = await fetch('https://api.openai.com/v1/models', { headers: H });
if (!list.ok) { console.log(JSON.stringify({ MODELS: `http_${list.status}` })); process.exit(4); }
const ids = ((await list.json()).data ?? []).map((m) => m.id).sort();
const candidates = ids.filter((id) => CANDIDATE_RULE.test(id)).slice(0, MAX_PROBES);
const probes = [];
for (const model of candidates) {
  const t0 = Date.now();
  const res = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: H, body: JSON.stringify({ model, ...PARAMS, response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: 'JSON으로만 답하라: {"ok":true}' }, { role: 'user', content: '{}' }] }) });
  const body = await res.json().catch(() => ({}));
  probes.push({ model, ok: res.ok, status: res.status, ms: Date.now() - t0, served_model: body.model ?? null,
    error_code: body.error?.code ?? null, error_param: body.error?.param ?? null, prompt_tokens: body.usage?.prompt_tokens ?? null, completion_tokens: body.usage?.completion_tokens ?? null });
}
const L = ['# MODEL GATE 1단계 — 계정 모델 확인', '', `- 조회 시각(UTC): ${new Date().toISOString()}`, `- 계정에서 보이는 모델 ${ids.length}개 · 후보 규칙에 맞아 시험한 모델 ${candidates.length}개`,
  `- 시험 조건 = B-1.0 과 같은 파라미터(temperature ${PARAMS.temperature} · top_p ${PARAMS.top_p} · max_tokens · json_object), max_tokens 만 ${PARAMS.max_tokens} 로 줄임(짧은 확인용)`, '',
  '| 요청 모델 | 같은 파라미터로 됨 | HTTP | 응답의 실제 세부판 | 오류 코드 | 문제 파라미터 | 입력 토큰 | 출력 토큰 | 지연 ms |', '|---|---|---|---|---|---|---|---|---|',
  ...probes.map((p) => `| ${p.model} | ${p.ok ? '예' : '아니오'} | ${p.status} | ${p.served_model ?? '-'} | ${p.error_code ?? '-'} | ${p.error_param ?? '-'} | ${p.prompt_tokens ?? '-'} | ${p.completion_tokens ?? '-'} | ${p.ms} |`),
  '', '## 계정에서 보이는 모델 전체(이름만)', '', ids.join(' · ')];
if (arg('--out')) writeFileSync(arg('--out'), L.join('\n'));
if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify({ at: new Date().toISOString(), count: ids.length, ids, probes }, null, 1));
console.log(L.join('\n'));
