// ECHO 무인 업무 순회(echo-auto-loop.yml) — 다음 행동을 고르는 순수 함수. GitHub 에서 읽은 사실만 입력으로 받는다.
// 상태 저장소 = GitHub 자체(라벨 · 표시 댓글) → 실행기 사이에 따로 저장할 파일이 없다.
//   작업 = 라벨 echo-ready 이슈(저장소 OWNER/MEMBER 가 만든 것만) → echo-running → echo-done | echo-blocked
//   작업 PR = 브랜치 echo/task-<이슈 번호> · 라벨 echo-auto(라벨은 쓰기 권한자만 붙일 수 있음)
// Codex 결과 판정(설치된 Codex 앱이 실제로 남기는 신호만):
//   FAIL = 현재 head SHA 에 대한 Codex 리뷰 + P0~P2 배지 지적 → 수정은 claude.yml 이 맡음(여기서는 대기)
//   PASS = 현재 실행기에는 지원되는 typed trusted verdict 경로가 없어 자동 PASS 0.
//          지적 없음 본문·짧거나 긴 SHA·👍 반응·리뷰 없음은 PASS 근거가 아니다.
//   리뷰 없음 ≠ PASS. 오래 조용하면 그 SHA 에 한 번만 다시 검수를 요청한다.
'use strict';

const CODEX = 'chatgpt-codex-connector[bot]';
const TRUSTED = ['OWNER', 'MEMBER', 'COLLABORATOR'];
const LIMITS = Object.freeze({ maxRounds: 5, pokeAfterMin: 25, startTimeoutMin: 90, maxPokesPerSha: 1 });
const FINDING = /!\[P[012] Badge\]|\[P[012]\]/;

const minutes = (a, b) => (Date.parse(a) - Date.parse(b)) / 60000;

/** 다음에 시작할 작업: 믿을 수 있는 사람이 만든 echo-ready 이슈 중 가장 오래된 것(PR 제외). */
function pickNextTask(issues) {
  return issues
    .filter((i) => !i.pull_request && i.state === 'open'
      && i.labels.some((l) => l.name === 'echo-ready')
      && !i.labels.some((l) => ['echo-running', 'echo-done', 'echo-blocked'].includes(l.name))
      && TRUSTED.includes(i.author_association))
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))[0] ?? null;
}

/**
 * 진행 중 작업 하나의 다음 행동.
 * @returns {{action:'wait'|'pass'|'poke'|'block', reason:string, sha?:string}}
 */
function judgeRunning({ now, issue, pr, headCommittedAt, reviews, reviewComments, issueComments }) {
  if (!pr) {
    return minutes(now, issue.runningSince ?? issue.updated_at) > LIMITS.startTimeoutMin
      ? { action: 'block', reason: 'no_pr_after_start' } : { action: 'wait', reason: 'implementing' };
  }
  if (pr.state !== 'open') return { action: 'block', reason: 'pr_not_open' };
  const sha = pr.head.sha;
  const rounds = issueComments.filter((c) => /^<!-- echo-handoff to=codex sha=[a-f0-9]{40} round=\d+ -->/.test(c.body || '')).length;
  if (rounds > LIMITS.maxRounds) return { action: 'block', reason: 'round_limit', sha };
  const codexReviews = reviews.filter((r) => r.user?.login === CODEX && r.commit_id === sha);
  const findings = reviewComments.filter((c) => c.user?.login === CODEX && c.commit_id === sha && FINDING.test(c.body || ''));
  if (codexReviews.length && findings.length) return { action: 'wait', reason: 'fail_fix_by_claude_yml', sha };
  // Standard review prose and short/full SHA text are not a typed, completed trusted verdict.
  // No supported verdict resolver is connected here. Keep the task blocked rather than declaring PASS.
  const reviewedSha = (c) => ((c.body || '').match(/Reviewed commit:\*{0,2}\s*`([0-9a-f]{7,40})`/) || [])[1];
  const noFindingsForHead = issueComments.some((c) => c.user?.login === CODEX && /Didn.t find any major issues/.test(c.body || '')
    && Boolean(reviewedSha(c)) && sha.startsWith(reviewedSha(c)));
  if (noFindingsForHead && !findings.length) return { action: 'block', reason: 'trusted_verdict_unavailable', sha };
  const pokes = issueComments.filter((c) => (c.body || '').startsWith(`<!-- echo-poke sha=${sha} -->`)).length;
  if (pokes >= LIMITS.maxPokesPerSha) {
    return minutes(now, headCommittedAt) > LIMITS.pokeAfterMin * 4 ? { action: 'block', reason: 'no_codex_review', sha } : { action: 'wait', reason: 'poked_waiting', sha };
  }
  if (minutes(now, headCommittedAt) > LIMITS.pokeAfterMin) return { action: 'poke', reason: 'no_codex_signal', sha };
  return { action: 'wait', reason: 'waiting_codex', sha };
}

module.exports = { CODEX, LIMITS, pickNextTask, judgeRunning };
