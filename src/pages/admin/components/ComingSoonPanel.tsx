const C = {
  gold: '#F5D4A1',
  pink: '#D4A0B8',
  silver: '#A0A0B0',
  graphite: '#2A2A2A',
  blackCard: '#0F0F0F',
  amber: '#FBBF24',
};

interface ComingSoonPanelProps {
  title: string;
  icon: string;
  description: string;
  items: { label: string; icon: string }[];
  accentColor?: string;
  actionLabel?: string;
}

export default function ComingSoonPanel({ title, icon, description, items, accentColor = C.amber, actionLabel = '연결 대기' }: ComingSoonPanelProps) {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
      <div className="flex items-center gap-2 px-4 md:px-6 py-3.5 md:py-4 border-b" style={{ borderColor: C.graphite }}>
        <i className={`${icon} text-sm`} style={{ color: accentColor, opacity: 0.5 }} />
        <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">{title}</span>
        <span className="inline-flex items-center gap-1 ml-auto px-2 py-0.5 rounded-full text-[8px] font-mono tracking-wider" style={{ background: `${accentColor}15`, color: accentColor }}>
          <i className="ri-time-line text-[8px]" />
          {actionLabel}
        </span>
      </div>

      <div className="p-6 md:p-8">
        <div className="flex flex-col items-center text-center max-w-lg mx-auto">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center mb-5" style={{ background: `${accentColor}08`, border: `1px solid ${accentColor}12` }}>
            <i className={`${icon} text-2xl md:text-3xl`} style={{ color: accentColor, opacity: 0.3 }} />
          </div>
          <h3 className="font-display font-bold text-lg md:text-xl text-white/30 mb-2" style={{ fontFamily: 'var(--font-heading, sans-serif)' }}>
            {title}
          </h3>
          <p className="text-[11px] md:text-xs font-mono text-white/12 leading-relaxed mb-6 tracking-wider">
            {description}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full max-w-md">
            {items.map((item) => (
              <div key={item.label} className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ borderColor: `${C.graphite}40`, background: `${C.blackCard}60` }}>
                <i className={`${item.icon} text-[11px]`} style={{ color: accentColor, opacity: 0.35 }} />
                <span className="text-[10px] font-mono text-white/15 whitespace-nowrap">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-5 border-t w-full" style={{ borderColor: C.graphite }}>
            <p className="text-[9px] font-mono text-white/06 tracking-wider">
              Stripe &middot; OpenAI 연결 후 자동 활성화
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}