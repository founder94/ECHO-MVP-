import AnimatedSection from '@/components/AnimatedSection';
import clearIcon from './weather-icons/weather-clear.svg';
import cloudyIcon from './weather-icons/weather-cloudy.svg';
import drizzleIcon from './weather-icons/weather-drizzle.svg';

const jukeboxEntries = [
  { id: 1, song: 'SONG 01', weather: '부슬비', weatherIcon: drizzleIcon, date: '8월 8일' },
  { id: 2, song: 'SONG 02', weather: '구름', weatherIcon: cloudyIcon, date: '8월 5일' },
  { id: 3, song: 'SONG 03', weather: '맑음', weatherIcon: clearIcon, date: '7월 30일' },
];

export default function JukeboxSection() {
  return (
    <section id="jukebox" className="relative w-full py-14 md:py-20">
      <div className="max-w-lg mx-auto px-6">
        <AnimatedSection direction="up" distance={30}>
          <h2 className="text-xl md:text-2xl font-bold text-white leading-snug mb-3 text-center">
            나의 주크박스
          </h2>
        </AnimatedSection>

        <AnimatedSection direction="up" distance={30} delay={100}>
          <p className="text-sm text-white/75 font-medium leading-relaxed text-center mb-2">
            그날의 노래를 들으면,<br />그날의 내가 다시 보여요.
          </p>
        </AnimatedSection>

        <AnimatedSection direction="up" distance={30} delay={150}>
          <p className="text-xs text-white/60 font-medium leading-relaxed text-center mb-10">
            내가 어떤 마음날씨였을 때<br />
            무슨 이야기를 했고<br />
            어떤 노래를 골랐는지<br />
            다시 꺼내볼 수 있어요.
          </p>
        </AnimatedSection>

        <AnimatedSection direction="up" distance={20} delay={250}>
          {/* Month header */}
          <p className="text-sm text-white/50 tracking-wider mb-4">8월</p>

          <div className="space-y-2">
            {jukeboxEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04] transition-all duration-300 cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <i className="ri-music-line text-sm text-white/60" />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="text-sm text-white/85 font-medium truncate">{entry.song}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                      <img src={entry.weatherIcon} alt={entry.weather} className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] text-white/55">{entry.weather}였던 날</span>
                  </div>
                </div>
                <span className="text-[10px] text-white/50 flex-shrink-0">{entry.date}</span>
              </button>
            ))}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}