// 실제 AI run 결과를 저장소에 영구 보존한다(2026-09-26). 제품 코드가 아니다(배포 경로 밖) · AI 호출 0.
// 왜: GitHub Actions 첨부물은 7일 뒤 지워진다(.github/workflows/echo-*.yml retention-days: 7). 실행별 핵심 지표를 저장소에 남겨 장기 비교한다.
// 무엇을 남기나: 실행 번호·종류·Actions 번호·커밋·사전 등록 일치 여부·모델·지표(stats). 대화 원문·턴별 출력은 남기지 않는다.
//   지표 값에 한글이 들어 있으면(사용자 말일 수 있음) 버리고 stats_dropped 에 칸 이름만 적는다.
// 실행:
//   node product/spike/failure-intelligence/record-run.mjs --run 31 --result prod-agent-result.json [--job job.json] [--replace]
//     --result : run-prod-agent.mjs --json 결과(첨부물 prod-agent-result.json) 또는 {"result": …} 로 감싼 파일
//     --job    : {job_id, job_conclusion, head_sha, workflow_name, completed_at, exit_code} (선택)
//   node product/spike/failure-intelligence/record-run.mjs --run 12        (결과 없이 이력만 기록)
// 이미 있는 run 파일은 덮어쓰지 않는다(원본 증거 보존). 정정은 --replace 와 함께 이유를 커밋에 남긴다.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { ROOT, RUNS } from './fi-lib.mjs';

const AB = path.join(ROOT, 'product/spike/ab-20260925');
const HANGUL = /[ㄱ-ㆎ가-힣]/;

// 대표용 이력 글에서 판정만 뽑는다. 글 자체는 복사하지 않고 위치(verdict_ref)만 남긴다.
export function verdictOf(text) {
  const t = String(text ?? '');
  if (!t) return 'UNKNOWN';
  if (/무효/.test(t)) return 'INVALID';
  if (/\bFAIL\b|미달|미충족/.test(t)) return 'FAIL';
  if (/PARTIAL/.test(t)) return 'PARTIAL';
  if (/\bPASS\b/.test(t)) return 'PASS';
  if (/충족/.test(t)) return 'AUTO_GATE_MET';
  return 'SEE_REF';
}

// 지표만 남긴다: 숫자·참거짓·한글 없는 문자열. 그 밖은 칸 이름만 기록.
export function sanitizeStats(stats) {
  if (!stats || typeof stats !== 'object') return { stats: null, dropped: [] };
  const out = {};
  const dropped = [];
  for (const [model, metrics] of Object.entries(stats)) {
    out[model] = {};
    for (const [k, v] of Object.entries(metrics ?? {})) {
      const ok = typeof v === 'number' || typeof v === 'boolean' || v === null || (typeof v === 'string' && !HANGUL.test(v) && v.length <= 400);
      if (ok && !HANGUL.test(k)) out[model][k] = v;
      else dropped.push(`${model}.${k}`);
    }
  }
  return { stats: out, dropped };
}

export function history() {
  const req = JSON.parse(readFileSync(path.join(AB, 'run-request.json'), 'utf8'));
  const gate = JSON.parse(readFileSync(path.join(AB, 'FROZEN_INPUTS.json'), 'utf8')).prod_agent_gate ?? { history: [] };
  const runs = [...req.history];
  if (!runs.some((h) => h.run === req.run)) runs.push({ run: req.run, mode: req.mode, actions_run: null, commit: null, current_request: true });
  return { runs, gate: gate.history ?? [] };
}

export function buildRecord(n, { result = null, job = null } = {}) {
  const { runs, gate } = history();
  const h = runs.find((x) => x.run === n);
  if (!h) throw new Error(`run ${n} 이 run-request.json 이력에 없다`);
  const actions = h.actions_run ?? null;
  // 운영판 에이전트 사전 등록 이력: Actions 번호로 짝짓고, 없으면 커밋으로.
  let gi = gate.findIndex((g) => (actions && g.actions_run === actions) || (!actions && h.commit && g.commit === h.commit) || (h.current_request && job?.actions_run && g.actions_run === job.actions_run));
  if (gi < 0 && !actions) gi = gate.findIndex((g) => !g.actions_run && new RegExp(`\\brun ${n}\\b`).test(String(g.version ?? '')));
  const g = gi >= 0 ? gate[gi] : null;
  const actionsRun = actions ?? job?.actions_run ?? g?.actions_run ?? null;
  const r = result?.result !== undefined ? result.result : result;
  const { stats, dropped } = sanitizeStats(r?.stats);
  const realAi = !r ? 'UNKNOWN' : /실제 OpenAI/.test(String(r.mode ?? '')) ? 'REAL' : /MOCK/.test(String(r.mode ?? '')) ? 'MOCK' : 'UNKNOWN';
  return {
    schema: 'echo-real-ai-run-v1',
    run: n,
    mode: h.mode,
    actions_run: actionsRun,
    commit: h.commit ?? g?.commit ?? null,
    workflow_name: job?.workflow_name ?? null,
    job_id: job?.job_id ?? null,
    job_conclusion: job?.job_conclusion ?? null,
    head_sha: job?.head_sha ?? null,
    completed_at: job?.completed_at ?? null,
    exit_code: job?.exit_code ?? null,
    real_ai: actionsRun ? realAi : 'NO_ACTIONS_RUN_RECORDED',
    frozen_ok: typeof r?.frozen_ok === 'boolean' ? r.frozen_ok : null,
    agent_ts_sha256: r?.agent_ts_sha ?? g?.agent_ts_sha256 ?? null,
    flows_sha256: g?.flows_sha256 ?? null,
    models: r?.models ?? g?.models ?? null,
    verdict: verdictOf(g?.version ?? h.note),
    verdict_ref: g ? `product/spike/ab-20260925/FROZEN_INPUTS.json#prod_agent_gate.history[${gi}]` : h.note ? `product/spike/ab-20260925/run-request.json#history(run ${n}).note` : null,
    stats,
    stats_source: stats ? (job?.stats_source ?? 'result_json') : null,
    stats_dropped: dropped,
    stats_missing_reason: stats ? null : (job?.stats_missing_reason ?? (actionsRun ? 'NOT_COLLECTED' : 'NO_ACTIONS_RUN_RECORDED')),
    user_fact: false,
  };
}

export function writeRecord(rec, { replace = false } = {}) {
  mkdirSync(RUNS, { recursive: true });
  const file = path.join(RUNS, `run-${String(rec.run).padStart(2, '0')}.json`);
  const text = JSON.stringify(rec, null, 1) + '\n';
  if (existsSync(file) && readFileSync(file, 'utf8') !== text && !replace) throw new Error(`${path.relative(ROOT, file)} 가 이미 있다 — 원본 증거는 덮어쓰지 않는다(정정이면 --replace)`);
  writeFileSync(file, text);
  return file;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  const n = Number(arg('--run'));
  if (!Number.isInteger(n) || n < 1) { console.error('--run <번호> 가 필요하다'); process.exit(1); }
  const read = (p) => (p ? JSON.parse(readFileSync(p, 'utf8')) : null);
  const file = writeRecord(buildRecord(n, { result: read(arg('--result')), job: read(arg('--job')) }), { replace: process.argv.includes('--replace') });
  console.log(`기록: ${path.relative(ROOT, file)}`);
}
