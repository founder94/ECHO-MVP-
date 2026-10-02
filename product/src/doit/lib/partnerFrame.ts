import type { MatchPartner } from '@/doit/lib/connectApi';

// 한 문장: 상대가 직접 쓴 소개의 첫 문장(없으면 첫 질문에 직접 쓴 답). AI 가 만든 문장은 쓰지 않는다.
export function frameSentence(partner: Pick<MatchPartner, 'bio' | 'answer'>): string {
  const source = (partner.bio || partner.answer || '').replace(/\s+/g, ' ').trim();
  if (!source) return '';
  const first = source.match(/^.+?[.!?。]|^.+$/)?.[0] ?? source;
  return first.length > 60 ? `${first.slice(0, 58).trimEnd()}…` : first;
}
