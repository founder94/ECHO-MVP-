// 사주·타로 결과 → ECHO 대화로 넘기는 「이야기 거리」(2026-09-26 대표 「FINAL IMPLEMENTATION MASTER」 §13~§17).
// - 넘기는 것: 결과 종류 하나뿐(사주 = 정해진 세 갈래 중 하나 · 타로 = 카드 이름). 생년월일·시간·성별·명식·해설 글은 넘기지 않는다.
// - 이 값은 사용자 사실이 아니다. 서버는 이것으로 「결과에서는 … 나왔어요. 실제로는 어때요?」 한 문장만 만들고, 사용자가 직접 한 말만 저장한다.
// - 이 탭(sessionStorage)에만 잠깐 두고 대화를 시작할 때 한 번 읽고 지운다.
export type SajuSeedKey = 'peer_many' | 'peer_none' | 'peer_some';
export type ContentSeed = { source: 'SAJU'; key: SajuSeedKey } | { source: 'TAROT'; card: string };

const KEY = 'echo-content-seed';
const SAJU_KEYS: readonly string[] = ['peer_many', 'peer_none', 'peer_some'];
const CARD = /^[가-힣A-Za-z0-9 ·()]{1,20}$/;

function valid(v: unknown): ContentSeed | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (o.source === 'SAJU' && typeof o.key === 'string' && SAJU_KEYS.includes(o.key)) return { source: 'SAJU', key: o.key as SajuSeedKey };
  if (o.source === 'TAROT' && typeof o.card === 'string' && CARD.test(o.card.trim())) return { source: 'TAROT', card: o.card.trim() };
  return null;
}

export function setContentSeed(seed: ContentSeed): void {
  const v = valid(seed);
  try { if (v) sessionStorage.setItem(KEY, JSON.stringify(v)); } catch { /* 저장이 막힌 기기: 이야기 거리 없이 보통 대화로 시작 */ }
}

/** 한 번 읽고 지운다. 없거나 틀리면 null(보통 대화로 시작). */
export function takeContentSeed(): ContentSeed | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return raw ? valid(JSON.parse(raw)) : null;
  } catch { return null; }
}
