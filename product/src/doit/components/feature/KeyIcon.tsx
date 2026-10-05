// KEY 열쇠 아이콘(2026-10-04 대표 「KEY는 실제 사용하는 열쇠」): 둥근 고리 · 줄기 · 끝의 톱니가 있는 물리적인 열쇠.
// 키보드 버튼·일반 자물쇠·번개로 대체하지 않는다. 은색 유리 + 작은 따뜻한 반사광. 장식이면 decorative(화면 읽기 0), 동작 요소 안이면 label 을 함께 쓴다.
// 잔액·차감은 이 아이콘이 다루지 않는다 — KEY 서버 정책이 없어(2026-10-04 확인: key_balance·key_spend 미구현) 쓰는 기능은 모두 잠겨 있다.
// tone='gold' = 2026-10-05 승인 시안(「모바일 최종 디자인 기준」)의 윗줄 KEY 알약 속 금빛 열쇠. 모양은 같고 색만 다르다.
export default function KeyIcon({ size = 28, decorative = true, className = '', tone = 'silver' }: { size?: number; decorative?: boolean; className?: string; tone?: 'silver' | 'gold' }) {
  const id = tone === 'gold' ? 'echo-key-gold' : 'echo-key-silver';
  const stops = tone === 'gold' ? ['#fff4c9', '#f2c45a', '#ffe9a8', '#c8902c'] : ['#ffffff', '#c9d2dc', '#f3f6f9', '#9aa6b3'];
  return <svg className={`echo-key-icon ${className}`} width={size} height={size} viewBox="0 0 64 64" fill="none" role={decorative ? undefined : 'img'} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : 'KEY'}>
    <defs>
      <linearGradient id={id} x1="6" y1="10" x2="58" y2="54" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor={stops[0]} /><stop offset=".45" stopColor={stops[1]} /><stop offset=".7" stopColor={stops[2]} /><stop offset="1" stopColor={stops[3]} />
      </linearGradient>
    </defs>
    {/* 고리 */}
    <circle cx="18" cy="22" r="11" stroke={`url(#${id})`} strokeWidth="5" />
    <circle cx="14.5" cy="18.5" r="2.2" fill="#ffe6b8" opacity=".85" />
    {/* 줄기 */}
    <path d="M26.5 29.5 52 55" stroke={`url(#${id})`} strokeWidth="5.5" strokeLinecap="round" />
    {/* 톱니 */}
    <path d="M43 46l5-5M47.5 50.5l4-4M38.5 41.5l3.5-3.5" stroke={`url(#${id})`} strokeWidth="5" strokeLinecap="round" />
  </svg>;
}
