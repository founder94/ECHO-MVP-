// Replay Corpus v0.1(대표 「IMPLEMENTATION ORDER」 §4) — 회사 실제 실패 기록(docs/failure-intelligence/data/*.json)을
// 결정적으로 읽고 정규화한 뒤, 최소 재생 사례 11개를 실제 기록에 묶어 이 층의 규칙으로 다시 돌린다.
// 파일을 직접 읽지 않는다(브라우저·서버 어디서나 같은 결과) — 호출하는 쪽이 JSON 을 넘긴다. 합성 이력을 만들지 않는다:
// 묶을 실제 기록이 없으면 그 사례는 corpusIds 가 비고 evidence 에 그 사실을 적는다.
import { compileFailure, normalizeDatasetRecord, normalizeFailure, type RawDatasetRecord, type RawFailureRecord } from './failureCompiler.ts';
import { compileHumanState, matchingSafeProjection, replayEvents } from './humanStateCompiler.ts';
import { effortEventsFromFailure, evaluateHumanEffort, ledgerEvents, qaProdMixEvents, type LedgerItem } from './humanEffortCost.ts';
import { createRegistry, promote } from './defenseRegistry.ts';
import type { FailureRecordNormalized, HumanStateEvent } from './types.ts';

export interface CorpusInput {
  failures: { failures: RawFailureRecord[] };
  dataset?: { records: RawDatasetRecord[] };
  failedSolutions?: { solutions: { id: string }[] };
  graph?: { edges: { from: string; rel: string; to: string }[] };
  actionLedger?: { items: LedgerItem[] };
}

export interface LoadedCorpus {
  records: FailureRecordNormalized[];
  rawById: ReadonlyMap<string, RawFailureRecord | RawDatasetRecord>;
  ledger: LedgerItem[];
  graphEdges: { from: string; rel: string; to: string }[];
  solutionIds: string[];
  duplicateIds: string[];
}

/** 결정적 적재: 원본 순서 보존 · 같은 id 는 먼저 나온 것만(중복 id 는 따로 알림). 입력은 바꾸지 않는다. */
export function loadFailureCorpus(input: CorpusInput): LoadedCorpus {
  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  const records: FailureRecordNormalized[] = [];
  const rawById = new Map<string, RawFailureRecord | RawDatasetRecord>();
  const take = (id: string, raw: RawFailureRecord | RawDatasetRecord, norm: () => FailureRecordNormalized) => {
    if (seen.has(id)) { duplicateIds.push(id); return; }
    seen.add(id); rawById.set(id, raw); records.push(norm());
  };
  for (const r of input.failures.failures) take(r.id, r, () => normalizeFailure(r));
  for (const r of input.dataset?.records ?? []) take(r.id, r, () => normalizeDatasetRecord(r));
  return {
    records,
    rawById,
    ledger: (input.actionLedger?.items ?? []).map((i) => ({ id: i.id, what: i.what, state: i.state })),
    graphEdges: (input.graph?.edges ?? []).map((e) => ({ from: e.from, rel: e.rel, to: e.to })),
    solutionIds: (input.failedSolutions?.solutions ?? []).map((s) => s.id),
    duplicateIds,
  };
}

export interface ReplayResult {
  id: string;
  title: string;
  corpusIds: string[];
  evidence: string;
  pass: boolean;
  detail: string;
}

const byType = (c: LoadedCorpus, rx: RegExp) => c.records.filter((r) => r.types.some((t) => rx.test(t))).map((r) => r.id);
const byText = (c: LoadedCorpus, rx: RegExp) => [...c.rawById.entries()]
  .filter(([, raw]) => rx.test(['user_text', 'situation', 'ai_behavior', 'title', 'raw_context'].map((k) => String((raw as unknown as Record<string, unknown>)[k] ?? '')).join(' ')))
  .map(([id]) => id);
const rec = (c: LoadedCorpus, id: string) => c.records.find((r) => r.id === id)!;

type Case = { id: string; title: string; link: (c: LoadedCorpus) => string[]; evidence?: string; run: (c: LoadedCorpus, ids: string[]) => { pass: boolean; detail: string } };

const USER = (text: string, slot?: string, meaning?: string): HumanStateEvent => ({ type: 'USER_MESSAGE', text, slot, meaning, proposedBy: 'USER' });
const MODEL = (text: string, slot: string, meaning: string): HumanStateEvent => ({ type: 'USER_MESSAGE', text, slot, meaning, proposedBy: 'MODEL' });

export const REPLAY_CASES: readonly Case[] = [
  {
    id: 'RC-01', title: '같은 뜻 질문 반복', link: (c) => byType(c, /질문의도 반복|반복설명 강요/),
    run: (c, ids) => {
      const compiled = ids.map((id) => compileFailure(rec(c, id)));
      const engines = new Set(compiled.map((x) => x.linkedEngine));
      const effort = evaluateHumanEffort(ids.flatMap((id) => effortEventsFromFailure(rec(c, id))));
      const pass = ids.length > 0 && engines.size === 1 && engines.has('Context Memory') && effort.events.every((e) => e.type === 'repeated_explanation') && effort.events.length === ids.length;
      return { pass, detail: `엔진 ${[...engines].join(',')} · 수고 사건 ${effort.events.length}/${ids.length} · 점수 ${effort.rawScore}(${effort.band})` };
    },
  },
  {
    id: 'RC-02', title: '사용자 정정 무시', link: (c) => byType(c, /정정무시|정정 누락/),
    run: (c, ids) => {
      const events = [USER('연락은 매일 하는 게 좋아요', 'contact_style', '매일 연락'), { type: 'CORRECT', text: '아니 매일은 부담스럽고 주말에 한두 번이요', targetId: 'F1', meaning: '주말에 한두 번 연락' } as HumanStateEvent];
      const r = replayEvents(events);
      const proj = r.matchingSafe.map((m) => m.meaning);
      const engine = new Set(ids.map((id) => compileFailure(rec(c, id)).linkedEngine));
      const pass = ids.length > 0 && proj.length === 1 && proj[0] === '주말에 한두 번 연락' && engine.has('Correction Engine');
      return { pass, detail: `매칭 투영 ${JSON.stringify(proj)} · 엔진 ${[...engine].join(',')}` };
    },
  },
  {
    id: 'RC-03', title: '거절한 뜻 재등장', link: (c) => byType(c, /거절 의미 재등장/),
    run: (c, ids) => {
      const events = [MODEL('주말엔 조용히 쉬어요', 'energy', '내향적인 사람'), { type: 'REJECT', text: '아니 그런 뜻 아니야', targetId: 'F1' } as HumanStateEvent, MODEL('혼자 있는 시간이 좋아요', 'energy', '내향적인 사람')];
      const r = replayEvents(events);
      const blocked = r.transitions.some((t) => t.kind === 'BLOCKED_REJECTED_MEANING');
      const pass = ids.length > 0 && blocked && r.matchingSafe.length === 0 && r.state.statements.length === 3;
      return { pass, detail: `재등장 차단 ${blocked} · 매칭 투영 ${r.matchingSafe.length} · 원문 ${r.state.statements.length}/3` };
    },
  },
  {
    id: 'RC-04', title: '확인 안 된 해석을 사실처럼 말함', link: (c) => byType(c, /미확정 사실화/),
    run: (c, ids) => {
      const a = replayEvents([MODEL('사람 많은 곳은 피곤해요', 'energy', '사람 많은 곳을 피함')]);
      const b = compileHumanState(a.state, { type: 'CONFIRM', text: '맞아요', targetId: 'F1' });
      const pass = ids.length > 0 && a.matchingSafe.length === 0 && a.state.facts[0].status === 'AI_INFERRED' && b.matchingSafe.length === 1 && b.matchingSafe[0].status === 'USER_CONFIRMED';
      return { pass, detail: `확인 전 투영 ${a.matchingSafe.length} · 확인 후 ${b.matchingSafe.length}(${b.matchingSafe[0]?.status ?? '-'})` };
    },
  },
  {
    id: 'RC-05', title: '끝난 행동을 다시 요구', link: (c) => byType(c, /완료 행동 재요구/),
    run: (c, ids) => {
      const done = c.ledger.find((i) => i.state === 'COMPLETED');
      const ev = done ? ledgerEvents(c.ledger, [{ id: done.id, how: 'request' }]) : [];
      const engines = new Set(ids.map((id) => compileFailure(rec(c, id)).linkedEngine));
      const pass = ids.length > 0 && !!done && ev.length === 1 && ev[0].type === 'completed_action_re_requested' && engines.has('Action Router / Action Ledger');
      return { pass, detail: `장부 ${done?.id ?? '없음'}(COMPLETED) 재요구 → ${ev.map((e) => e.type).join(',') || '사건 없음'} · 엔진 ${[...engines].join(',')}` };
    },
  },
  {
    id: 'RC-06', title: '막힌 길을 다시 안내', link: (c) => byType(c, /막힌 경로 반복 안내/),
    run: (c, ids) => {
      const blocked = c.ledger.find((i) => i.state === 'BLOCKED');
      const ev = blocked ? ledgerEvents(c.ledger, [{ id: blocked.id, how: 'suggest_same_path' }]) : [];
      const pass = ids.length > 0 && !!blocked && ev.length === 1 && ev[0].type === 'blocked_path_repeated';
      return { pass, detail: `장부 ${blocked?.id ?? '없음'}(BLOCKED) 같은 길 안내 → ${ev.map((e) => e.type).join(',') || '사건 없음'}` };
    },
  },
  {
    id: 'RC-07', title: '운영 산출물에 QA 주소·ref', link: (c) => byType(c, /QA.*(운영|PROD)|(운영|PROD).*QA|혼입/),
    evidence: '실패 기록(JSON)에는 이 사건 기록 없음 — 코드 근거: product/qa/brand-origin-guard.test.mjs · commit acac0c5(2026-09-28 운영 do-it.company 가 QA 빌드를 내보낸 실측)',
    run: () => {
      const markers = ['mutniujeiyujhkobadkd', 'thriving-melba-b1449a.netlify.app'];
      const bad = qaProdMixEvents('prod/app/index.js', 'const url = "https://mutniujeiyujhkobadkd.supabase.co"', markers);
      const good = qaProdMixEvents('prod/app/index.js', 'const url = "https://zyyhhxyupizcqhxqnxuu.supabase.co"', markers);
      const pass = bad.length === 1 && bad[0].type === 'qa_prod_mix' && good.length === 0;
      return { pass, detail: `QA 표식 있는 산출물 → ${bad.length}건 · 운영 표식만 → ${good.length}건` };
    },
  },
  {
    id: 'RC-08', title: '가짜 AI 통과인데 실제 AI 실패', link: (c) => byType(c, /Mock PASS \/ 실AI FAIL/),
    run: (c, ids) => {
      let reg = createRegistry(ids.map((id) => compileFailure(rec(c, id)).defenseCandidate));
      const id = reg.entries[0]?.id ?? '';
      reg = promote(reg, id, 'MOCK_VERIFIED', { mockPass: true, counterTestFailsWhenDisabled: true });
      reg = promote(reg, id, 'REAL_AI_VERIFIED', { realAiPass: false, realAiRunRef: 'real run' });
      const level = reg.entries.find((e) => e.id === id)?.defense_level;
      const pass = ids.length > 0 && level === 'MOCK_VERIFIED' && reg.history.at(-1)?.accepted === false;
      return { pass, detail: `${id}: 가짜 AI 통과 뒤 실제 AI 실패 → 수준 ${level}(실제 AI 검증으로 오르지 않음)` };
    },
  },
  {
    id: 'RC-09', title: '「잘 모르겠어/딱히 생각 안 나」는 확정 사실이 아님', link: (c) => byText(c, /모르겠|딱히/),
    run: (_c, ids) => {
      const r = replayEvents([USER('잘 모르겠어', 'hobby', '모름'), MODEL('딱히 생각 안 나', 'hobby', '취미 없음'), USER('딱히 생각 안 나요', 'values', '없음')]);
      const pass = ids.length > 0 && r.state.facts.length === 0 && r.matchingSafe.length === 0 && r.state.statements.every((s) => s.uncertain) && r.state.statements.length === 3;
      return { pass, detail: `사실 ${r.state.facts.length} · 매칭 투영 ${r.matchingSafe.length} · 원문 보존 ${r.state.statements.length}/3` };
    },
  },
  {
    id: 'RC-10', title: '정정 A→B: A 는 SUPERSEDED, B 가 지금 값', link: (c) => byType(c, /정정무시|정정 누락/),
    run: (_c, ids) => {
      const r = replayEvents([USER('서울 살아요', 'region', '서울'), { type: 'CORRECT', text: '아 지금은 부산이에요', slot: 'region', meaning: '부산' }]);
      const a = r.state.facts.find((f) => f.meaning === '서울');
      const b = r.state.facts.find((f) => f.meaning === '부산');
      const pass = ids.length > 0 && a?.status === 'SUPERSEDED' && a.supersededBy === b?.id && b?.status === 'USER_CORRECTED' && b.lineage.includes(a.id) && r.matchingSafe.map((m) => m.meaning).join() === '부산';
      return { pass, detail: `A=${a?.status} → ${a?.supersededBy} · B=${b?.status} lineage=${JSON.stringify(b?.lineage)}` };
    },
  },
  {
    id: 'RC-11', title: '거절해도 원문은 남고 매칭·프로필에는 안 쓰임', link: (c) => byType(c, /거절 의미 재등장/),
    run: (_c, ids) => {
      const r = replayEvents([USER('운동을 좋아해요', 'hobby', '운동 좋아함'), { type: 'REJECT', text: '그건 아니에요', targetId: 'F1' }]);
      const kept = r.state.statements[0].text === '운동을 좋아해요';
      const pass = ids.length > 0 && kept && r.state.facts[0].status === 'REJECTED' && matchingSafeProjection(r.state).length === 0 && r.rejections.length === 1;
      return { pass, detail: `원문 보존 ${kept} · 상태 ${r.state.facts[0].status} · 매칭 투영 ${r.matchingSafe.length}` };
    },
  },
];

export function runReplay(corpus: LoadedCorpus): ReplayResult[] {
  return REPLAY_CASES.map((k) => {
    const corpusIds = k.link(corpus);
    const { pass, detail } = k.run(corpus, corpusIds);
    const evidence = k.evidence ?? (corpusIds.length ? `실제 실패 기록 ${corpusIds.join(', ')}` : '묶을 실제 실패 기록 없음');
    // RC-07 처럼 코드 근거로 대신하는 사례를 뺀 모든 사례는 실제 기록에 묶여야 통과(합성 이력 금지).
    return { id: k.id, title: k.title, corpusIds, evidence, pass: pass && (corpusIds.length > 0 || !!k.evidence), detail };
  });
}
