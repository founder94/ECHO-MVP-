// ECHO Failure Intelligence — 데이터 읽기·검증·문서 생성(2026-09-25). 제품 코드가 아니다(배포 경로 밖).
// 정본 = docs/failure-intelligence/data/*.json. 사람이 읽는 .md 는 여기서 생성한다(손으로 고치면 --check 가 잡는다).
// 원칙: 증거 수준을 칸마다 표시한다. 실제 AI·실사용자 검증 없이 REAL_AI_VERIFIED·USER_VERIFIED·VERIFIED 로 올리지 못하게 막는다.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const DATA = path.join(ROOT, 'docs/failure-intelligence/data');
export const DOCS = path.join(ROOT, 'docs/failure-intelligence');
const GOLDEN = path.join(ROOT, 'product/spike/ab-20260925/golden-failures.json');

export const ENUM = {
  origin: ['ACTUAL', 'ACTUAL_RECONSTRUCTED', 'REAL_AI_SCRIPTED', 'FOUNDER_STATEMENT', 'CODE', 'SYNTHETIC', 'CODE+SYNTHETIC'],
  cause: ['CONFIRMED', 'MIXED', 'HYPOTHESIS'],
  defense: ['NONE', 'CANDIDATE', 'MOCK_VERIFIED', 'REAL_AI_VERIFIED', 'USER_VERIFIED'],
  status: ['UNRESOLVED', 'MITIGATED', 'RESOLVED', 'VERIFIED'],
  layer: ['Context', 'Orchestration', 'Product Contract', 'Model', 'Infrastructure', 'Evaluation'],
  relation: ['CAUSES', 'CONTRIBUTES_TO', 'TRIGGERS', 'MASKS', 'REGRESSION_OF', 'FIXED_BY', 'BROKEN_BY'],
  edgeEvidence: ['ACTUAL', 'CODE', 'HYPOTHESIS'],
  harm: ['emotional', 'mental', 'time', 'material'],
  evidence: ['ACTUAL', 'CANDIDATE', 'HYPOTHESIS'],
  action: ['COMPLETED', 'DECIDED', 'BLOCKED', 'PENDING'],
};
const REAL_LEVELS = new Set(['REAL_AI_VERIFIED', 'USER_VERIFIED']);
// 근거: 저장소 안 파일 경로, 또는 'git:<커밋>'(저장소 기록에 있는 커밋만).
export function refExists(ref) {
  if (ref.startsWith('git:')) { try { execFileSync('git', ['-C', ROOT, 'cat-file', '-e', `${ref.slice(4)}^{commit}`], { stdio: 'ignore' }); return true; } catch { return false; } }
  return existsSync(path.join(ROOT, ref));
}

export function load() {
  const read = (f) => JSON.parse(readFileSync(path.join(DATA, f), 'utf8'));
  return { failures: read('failures.json').failures, solutions: read('failed-solutions.json').solutions, graph: read('failure-graph.json'), families: read('families.json').families, types: read('types.json').types, ledger: read('action-ledger.json').items, golden: JSON.parse(readFileSync(GOLDEN, 'utf8')) };
}

// 검증 — 문제 목록을 돌려준다(빈 배열 = 통과).
export function validate(d) {
  const errs = [];
  const ids = new Set();
  const fsIds = new Set(d.solutions.map((s) => s.id));
  const flowIds = new Set(d.golden.flows.map((f) => f.id));
  const famIds = new Set(d.families.map((f) => f.id));
  for (const f of d.failures) {
    const at = (m) => errs.push(`${f.id}: ${m}`);
    if (!/^GF-\d{2,}$/.test(f.id)) at('ID 형식');
    if (ids.has(f.id)) at('ID 중복'); ids.add(f.id);
    if (!ENUM.origin.includes(f.origin)) at(`origin ${f.origin}`);
    if (!ENUM.cause.includes(f.cause_confidence)) at(`cause ${f.cause_confidence}`);
    if (!ENUM.defense.includes(f.defense_level)) at(`defense ${f.defense_level}`);
    if (!ENUM.status.includes(f.status)) at(`status ${f.status}`);
    if (!famIds.has(f.family)) at(`family ${f.family}`);
    for (const l of f.layers) if (!ENUM.layer.includes(l)) at(`layer ${l}`);
    if (!f.layers.length || !f.types.length) at('layer·type 비어 있음');
    for (const k of ENUM.harm) if (typeof f.user_harm?.[k] !== 'string' || !f.user_harm[k]) at(`사용자 피해 ${k} 비어 있음(모르면 UNKNOWN)`);
    for (const s of f.solution_attempts) if (!fsIds.has(s)) at(`해결 시도 ${s} 없음`);
    for (const g of f.golden_flows) if (!flowIds.has(g)) at(`Golden ${g} 없음`);
    for (const r of f.refs) if (!refExists(r)) at(`근거 파일 없음 ${r}`);
    for (const t of f.types) if (!d.types.includes(t)) at(`Type ${t} 가 types.json 에 없음`);
    if (!f.refs.length) at('근거 파일 0개');
    if (!ENUM.evidence.includes(f.evidence_level)) at(`evidence_level ${f.evidence_level}`);
    if (f.origin === 'FOUNDER_STATEMENT' && f.evidence_level === 'ACTUAL') at('대표 진술만으로는 ACTUAL 이 아니다(근거 확인 뒤 승격)');
    for (const k of ['mock_result', 'user_result']) if (typeof f[k] !== 'string' || !f[k]) at(`${k} 비어 있음(모르면 UNKNOWN)`);
    if (f.user_result !== 'UNKNOWN' && /PASS|VERIFIED/.test(f.user_result) && f.defense_level !== 'USER_VERIFIED') at('실사용 근거 없이 사용자 결과 PASS');
    if (f.origin.startsWith('ACTUAL') && !(f.date && f.ai_behavior)) at('ACTUAL 인데 날짜·AI 행동 없음');
    // 증거 없는 승격 금지
    if (REAL_LEVELS.has(f.defense_level) && !(f.verification?.real_ai_ref && refExists(f.verification.real_ai_ref))) at(`${f.defense_level} 인데 실제 검증 근거 파일 없음`);
    if (f.defense_level === 'USER_VERIFIED' && !f.verification?.user_ref) at('USER_VERIFIED 인데 실사용자 근거 없음');
    if (f.status === 'VERIFIED' && !REAL_LEVELS.has(f.defense_level)) at('VERIFIED 는 실제 AI 검증 뒤에만');
    if (/BLOCKED/.test(f.real_ai) && REAL_LEVELS.has(f.defense_level)) at('실AI 가 막혔는데 실AI 검증 표시');
  }
  for (const s of d.solutions) for (const r of s.related) if (!ids.has(r)) errs.push(`${s.id}: 관련 실패 ${r} 없음`);
  for (const e of d.graph.edges) {
    const ok = (n) => ids.has(n) || fsIds.has(n);
    if (!ok(e.from) || !ok(e.to)) errs.push(`graph ${e.from}→${e.to}: 없는 노드`);
    if (!ENUM.relation.includes(e.rel)) errs.push(`graph ${e.from}→${e.to}: 관계 ${e.rel}`);
    if (!ENUM.edgeEvidence.includes(e.evidence)) errs.push(`graph ${e.from}→${e.to}: 증거 ${e.evidence}`);
    if (!refExists(e.ref)) errs.push(`graph ${e.from}→${e.to}: 근거 파일 없음`);
  }
  for (const fl of d.golden.flows) for (const g of fl.failures) if (!ids.has(g)) errs.push(`golden ${fl.id}: 실패 ${g} 없음`);
  const lids = new Set();
  for (const a of d.ledger) {
    if (lids.has(a.id)) errs.push(`ledger ${a.id}: 중복`); lids.add(a.id);
    if (!ENUM.action.includes(a.state)) errs.push(`ledger ${a.id}: 상태 ${a.state}`);
    if (!a.what || !a.evidence) errs.push(`ledger ${a.id}: 내용·근거 없음`);
  }
  for (const s of d.solutions) for (const k of ['why_chosen', 'implementation', 'improved', 'broke_normal', 'reuse_condition']) if (!s[k]) errs.push(`${s.id}: ${k} 비어 있음(모르면 UNKNOWN)`);
  return errs;
}

const cell = (v) => String(v ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
const related = (d, id) => d.graph.edges.filter((e) => e.from === id || e.to === id).map((e) => (e.from === id ? `${e.rel}→${e.to}` : `${e.from}→${e.rel}`) + `(${e.evidence})`).join(' · ');
const count = (xs, key) => xs.reduce((m, x) => ((m[x[key]] = (m[x[key]] ?? 0) + 1), m), {});

export function renderLibrary(d) {
  const F = d.failures;
  const by = (k) => Object.entries(count(F, k)).map(([a, n]) => `${a} ${n}`).join(' · ');
  const L = ['# ECHO Failure Library (v4 · 2026-09-25)', '',
    '> 이 파일은 `docs/failure-intelligence/data/failures.json` 에서 생성한다(`node product/spike/failure-intelligence/fi-build.mjs`). 손으로 고치지 않는다.', '',
    '- 실제 증거가 있는 실패만 ACTUAL 로 적는다. 추정은 HYPOTHESIS, 예문은 SYNTHETIC.',
    '- 이전 판(v1 9건 · v2 21건)은 지우지 않았다: `docs/claude-final-review-20260916/PATCH-20260925-ab-spike/GOLDEN_FAILURE_LIBRARY_v1_20260925.md`, git 기록.',
    '- 사용자 피해(감정·정신·시간·물질)는 근거가 있는 것만 적고, 없으면 UNKNOWN.',
    `- 합계 ${F.length}건 — 증거 수준: ${by('evidence_level')} · 출처: ${by('origin')}`, `- 상태: ${by('status')}`, `- 방어 수준: ${by('defense_level')}`,
    `- **REAL_AI_VERIFIED · USER_VERIFIED · VERIFIED = ${F.filter((f) => REAL_LEVELS.has(f.defense_level)).length}건.** 실제 AI 실행은 BLOCKED_BY_ENVIRONMENT.`, '',
    '## 한눈에', '', '| ID | 날짜 | 증거 | 출처 | Family | Type | 원인 Layer | 원인 확신 | 방어 수준 | 상태 |', '|---|---|---|---|---|---|---|---|---|---|',
    ...F.map((f) => `| ${f.id} | ${cell(f.date.split(',')[0].slice(0, 22))} | ${f.evidence_level} | ${f.origin} | ${f.family} | ${cell(f.types.join(' · '))} | ${cell(f.layers.join(' · '))} | ${f.cause_confidence} | ${f.defense_level} | ${f.status} |`), ''];
  for (const f of F) {
    const row = (k, v) => (v ? `| ${k} | ${cell(v)} |` : null);
    L.push(`## ${f.id} ${f.title}`, '', '| 칸 | 내용 |', '|---|---|', ...[
      row('Family', `${f.family} — ${d.families.find((x) => x.id === f.family).name}`), row('발생 날짜', f.date), row('증거 수준', f.evidence_level), row('출처', `${f.origin} — ${f.origin_note}`),
      row('사용자 상황', f.situation), row('사용자 원문', f.user_text), row('AI 행동', f.ai_behavior), row('기대 행동', f.expected),
      row('Failure Type', f.types.join(' · ')), row('원인 Layer', `${f.layers.join(' · ')} (원인 확신: ${f.cause_confidence}) — ${f.layer_note}`),
      row('사용자 피해 · 감정', f.user_harm.emotional), row('사용자 피해 · 정신', f.user_harm.mental), row('사용자 피해 · 시간', f.user_harm.time), row('사용자 피해 · 물질', f.user_harm.material),
      row('재현 여부', f.reproduction), row('해결 시도(실패한 해결책 포함)', f.solution_attempts.length ? f.solution_attempts.join(', ') + ' → FAILED_SOLUTIONS_ARCHIVE.md' : '없음'),
      row('해결 후보', f.solution_candidates), row('실험 결과', f.experiment), row('Mock 결과', f.mock_result), row('부작용', f.side_effects), row('역검사 결과', f.counter_test), row('실AI 결과', f.real_ai), row('사용자 결과', f.user_result),
      row('방어 수준', f.defense_level), row('현재 상태', f.status_note || f.status), row('Golden Test', f.golden_flows.length ? f.golden_flows.join(', ') : '아직 없음'),
      row('관련 실패(Graph)', related(d, f.id) || '없음'),
      row('근거', f.refs.map((r) => `\`${r}\``).join(' · ')),
    ].filter(Boolean), '');
  }
  return L.join('\n');
}

export function renderSolutions(d) {
  return ['# Failed Solutions Archive (v3 · 2026-09-25)', '',
    '> `docs/failure-intelligence/data/failed-solutions.json` 에서 생성. 실패한 해결책은 지우지 않는다. 같은 방법을 다시 쓰기 전에 여기부터 본다.', '',
    '공통 교훈: 실패 하나를 막으려고 문자열 규칙·글자 검사·기본값을 더하면, 반대 방향의 새 실패(정상 답·정상 질문을 죽이거나, 항의를 답으로 삼킴)가 생겼다.', '',
    '| ID | 해결책 | 막으려던 실패 | 왜 골랐나 | 어떻게 | 나아진 것 | 새로 깨진 것(결과·증거) | 망가뜨린 정상 사례 | 왜 실패했나 | 지금 | 다시 쓸 조건 | 관련 실패 |', '|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...d.solutions.map((s) => `| ${s.id} | ${cell(s.solution)} | ${cell(s.target)} | ${cell(s.why_chosen)} | ${cell(s.implementation)} | ${cell(s.improved)} | ${cell(s.result)} | ${cell(s.broke_normal)} | ${cell(s.why_failed)} | ${cell(s.now)} | ${cell(s.reuse_condition)} | ${s.related.join(', ')} |`), ''].join('\n');
}

export function renderGraph(d) {
  const style = { ACTUAL: '-->', CODE: '-->', HYPOTHESIS: '-.->' };
  const nodes = new Set(d.graph.edges.flatMap((e) => [e.from, e.to]));
  const label = (n) => { const f = d.failures.find((x) => x.id === n); const s = d.solutions.find((x) => x.id === n); return `${n}["${n} ${cell((f?.title ?? s?.solution ?? '').slice(0, 22)).replace(/"/g, "'")}"]`; };
  return ['# Failure Graph (v1 · 2026-09-25)', '',
    '> `docs/failure-intelligence/data/failure-graph.json` 에서 생성. 실선 = 근거 있음(ACTUAL·CODE), 점선 = HYPOTHESIS(인과 미확정).', '',
    '```mermaid', 'graph LR', ...[...nodes].map((n) => `  ${label(n)}`), ...d.graph.edges.map((e) => `  ${e.from} ${style[e.evidence]}|${e.rel}| ${e.to}`), '```', '',
    '| From | 관계 | To | 증거 | 설명 | 근거 |', '|---|---|---|---|---|---|',
    ...d.graph.edges.map((e) => `| ${e.from} | ${e.rel} | ${e.to} | ${e.evidence} | ${cell(e.note)} | \`${e.ref}\` |`), '',
    `- 관계 ${d.graph.edges.length}개 중 HYPOTHESIS ${d.graph.edges.filter((e) => e.evidence === 'HYPOTHESIS').length}개. HYPOTHESIS 는 원인 판정에 쓰지 않는다.`,
    '- 되풀이된 모양: 실패 → 대책(규칙·검사·기본값) → 반대 방향 실패(BROKEN_BY). GF-10→FS-08→GF-08, GF-18→FS-14→GF-11, GF-14→FS-03→GF-05(도입 시점 미확인).', ''].join('\n');
}

export function renderLedger(d) {
  const by = (st) => d.ledger.filter((a) => a.state === st);
  const table = (st) => ['| ID | 무엇 | 날짜 | 누가·무엇이 | 근거 | 메모 |', '|---|---|---|---|---|---|', ...by(st).map((a) => `| ${a.id} | ${cell(a.what)} | ${a.date} | ${cell(a.by)} | ${cell(a.evidence)} | ${cell(a.note)} |`)];
  return ['# 행동 상태 장부 — COMPLETED · DECIDED · BLOCKED · PENDING (2026-09-25)', '',
    '> `docs/failure-intelligence/data/action-ledger.json` 에서 생성. 다음 행동을 만들기 전에 반드시 대조한다(저장 MASTER 3·24항).', '',
    '- COMPLETED 를 대표에게 다시 요구하지 않는다. 다시 요구하면 새 실패(F-ADVISOR)로 기록한다.',
    '- DECIDED 를 다시 묻지 않는다.',
    '- BLOCKED 를 같은 방식으로 반복하지 않는다. 다른 합법적 경로를 찾되 보안 장치는 우회하지 않는다.',
    '- PENDING 중 가장 중요한 다음 행동 하나를 고른다.', '',
    `## COMPLETED (${by('COMPLETED').length})`, '', ...table('COMPLETED'), '',
    `## DECIDED (${by('DECIDED').length})`, '', ...table('DECIDED'), '',
    `## BLOCKED (${by('BLOCKED').length})`, '', ...table('BLOCKED'), '',
    `## PENDING (${by('PENDING').length})`, '', ...table('PENDING'), ''].join('\n');
}
