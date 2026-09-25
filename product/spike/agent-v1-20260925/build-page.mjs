// 휴대폰 시험 페이지 만들기: agent.mjs·admin.mjs 를 글자 그대로 넣는다(export 낱말만 뺀다). 페이지와 OpenAI 재생이 같은 에이전트를 쓰는지 검사가 대조한다.
// 실행: node spike/agent-v1-20260925/build-page.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const inlineAgent = (src) => src.replace(/^export (async function|function|const) /gm, '$1 ');
export function buildPage() {
  const agent = inlineAgent(readFileSync(path.join(HERE, 'agent.mjs'), 'utf8'));
  const admin = inlineAgent(readFileSync(path.join(HERE, 'admin.mjs'), 'utf8'));
  const tpl = readFileSync(path.join(HERE, 'page.template.html'), 'utf8');
  if (!tpl.includes('/*__AGENT__*/') || !tpl.includes('/*__ADMIN__*/')) throw new Error('template marker missing');
  return tpl.replace('/*__AGENT__*/', () => agent).replace('/*__ADMIN__*/', () => admin);
}
if (import.meta.url === `file://${process.argv[1]}`) writeFileSync(path.join(HERE, 'page.html'), buildPage());
