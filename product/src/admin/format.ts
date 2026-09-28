// ADMIN WEB 표시 형식(한국 시각 · 목적 이름).
const KST = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
export function when(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : KST.format(d);
}

export const GOAL_KO: Record<string, string> = { friend: '친구', romantic: '연애', colleague: '함께 일할 사람', hobby: '취미', conversation: '대화', open: '정하지 않음' };
export const goalKo = (g: string | null | undefined) => (g ? GOAL_KO[g] ?? g : '—');
