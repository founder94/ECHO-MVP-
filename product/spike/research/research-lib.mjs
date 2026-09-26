// ECHO 대표 제품 리서치(FOUNDER_PRODUCT_RESEARCH) — 읽기·검증(2026-09-26). 제품 코드가 아니다(배포 경로 밖) · AI 호출 0.
// 정본 = docs/research/data/observations.json. 운영 DB 에 넣지 않는다.
// 원칙: 다른 서비스를 써 보며 본 것은 "패턴"만 남긴다. 그 서비스 사용자의 이름·닉네임·연락처·사진·대화 원문·캡처는 넣지 않는다.
//   관찰은 제품 가설일 뿐이다. 실제 ECHO 사용자 데이터로 검증되기 전에는 제품 정책 후보가 아니고, 어떤 경우에도 사용자 사실이 아니다.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, refExists } from '../failure-intelligence/fi-lib.mjs';

export const FILE = path.join(ROOT, 'docs/research/data/observations.json');
export const ENUM = {
  // 처음은 언제나 UNVALIDATED_HYPOTHESIS. ECHO 사용자 데이터로 검증하는 중이면 IN_VALIDATION, 끝나면 VALIDATED/REFUTED.
  status: ['UNVALIDATED_HYPOTHESIS', 'IN_VALIDATION', 'VALIDATED_BY_ECHO_USERS', 'REFUTED_BY_ECHO_USERS'],
  service_category: ['dating', 'matching', 'friendship', 'community', 'other'],
  area: ['signup', 'photo', 'profile', 'matching', 'messaging', 'payment', 'retention', 'safety', 'other'],
};
const DONE = new Set(['VALIDATED_BY_ECHO_USERS', 'REFUTED_BY_ECHO_USERS']);
export const USER_STATE_FLAGS = ['user_fact', 'usable_for_profile', 'usable_for_matching'];
// 개인정보가 들어갈 만한 칸 이름 — 어느 깊이에 있어도 금지.
export const FORBIDDEN_KEYS = ['name', 'real_name', 'nickname', 'handle', 'email', 'phone', 'contact', 'photo', 'photo_url', 'image', 'image_url', 'screenshot', 'capture', 'raw_chat', 'chat_log', 'transcript', 'message_text', 'address', 'location', 'coordinates', 'profile_url', 'user_id', 'birth', 'age_exact'];
// 글자 속 개인정보 흔적
export const PII_PATTERNS = [
  ['이메일', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/],
  ['전화번호', /(?:\+?82[-\s]?)?0?1[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/],
  ['주민번호', /\d{6}[-\s]?[1-4]\d{6}/],
  ['주소(URL)', /https?:\/\/|www\./i],
  ['이미지 파일', /\.(?:png|jpe?g|gif|webp|heic)\b/i],
  ['계정 아이디(@)', /(?:^|\s)@[A-Za-z0-9_.]{2,}/],
];
export const TEXT_MAX = 300; // 대화 원문을 통째로 옮기지 못하게

export function load() {
  return JSON.parse(readFileSync(FILE, 'utf8'));
}

function walk(value, visit, at = '') {
  if (Array.isArray(value)) value.forEach((v, i) => walk(v, visit, `${at}[${i}]`));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) { visit(k, v, `${at}.${k}`); walk(v, visit, `${at}.${k}`); }
}

export function validate(doc) {
  const errs = [];
  if (doc.schema !== 'echo-research-v1') errs.push(`schema ${doc.schema}`);
  if (!Array.isArray(doc.observations)) return [...errs, 'observations 배열 없음'];
  const ids = new Set();
  for (const o of doc.observations) {
    const at = (m) => errs.push(`${o.id ?? '?'}: ${m}`);
    if (!/^RS-\d{2,}$/.test(o.id ?? '')) at('ID 형식(RS-01)');
    if (ids.has(o.id)) at('ID 중복'); ids.add(o.id);
    if (o.dataset !== 'FOUNDER_PRODUCT_RESEARCH') at(`dataset ${o.dataset}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date ?? '')) at('date 형식(YYYY-MM-DD)');
    if (!ENUM.service_category.includes(o.service_category)) at(`service_category ${o.service_category}`);
    if (!ENUM.area.includes(o.area)) at(`area ${o.area}`);
    for (const k of ['observation', 'founder_experience', 'hypothesis']) if (typeof o[k] !== 'string' || !o[k].trim()) at(`${k} 비어 있음(모르면 UNKNOWN)`);
    if (!ENUM.status.includes(o.status)) at(`status ${o.status}`);
    // 사용자 사실로 가는 길 차단
    for (const k of USER_STATE_FLAGS) if (o[k] !== false) at(`${k} 는 false 여야 한다(리서치는 사용자 사실이 아니다)`);
    if (o.pii_check !== 'PATTERN_ONLY') at('pii_check = PATTERN_ONLY (패턴만 남겼는지 확인한 표시)');
    // 검증 상태
    const v = o.validation ?? {};
    if (typeof v.echo_user_data !== 'boolean') at('validation.echo_user_data 는 true/false');
    if (!v.echo_user_data && !['UNVALIDATED_HYPOTHESIS', 'IN_VALIDATION'].includes(o.status)) at('ECHO 사용자 데이터 검증 없이 검증 완료 상태 불가');
    if (o.status === 'IN_VALIDATION' && !v.method) at('IN_VALIDATION 인데 검증 방법(validation.method) 없음');
    if (DONE.has(o.status) && !(v.echo_user_data && v.ref && refExists(v.ref) && v.result)) at(`${o.status} 인데 ECHO 사용자 데이터 근거(ref·result) 없음`);
    // 정책 후보 · 대표 승인
    if (typeof o.policy_candidate !== 'boolean') at('policy_candidate 는 true/false');
    if (o.policy_candidate && o.status !== 'VALIDATED_BY_ECHO_USERS') at('ECHO 사용자로 검증된 가설만 제품 정책 후보');
    const a = o.founder_approval ?? {};
    if (typeof a.approved !== 'boolean') at('founder_approval.approved 는 true/false');
    if (a.approved && !o.policy_candidate) at('정책 후보가 아닌데 대표 승인 표시');
    if (a.approved && !/^\d{4}-\d{2}-\d{2}$/.test(a.date ?? '')) at('대표 승인 날짜 없음');
    for (const r of o.refs ?? []) if (!refExists(r)) at(`근거 파일 없음 ${r}`);
    // 개인정보
    walk(o, (k, val, where) => {
      if (FORBIDDEN_KEYS.includes(k)) at(`개인정보 칸 금지 ${where}`);
      if (typeof val === 'string') {
        if (val.length > TEXT_MAX) at(`${where} ${TEXT_MAX}자 초과 — 원문 말고 패턴만`);
        for (const [label, re] of PII_PATTERNS) if (re.test(val)) at(`${where} 에 ${label} 흔적`);
      }
    });
  }
  return errs;
}
