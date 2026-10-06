import AnimatedSection from '@/components/AnimatedSection';
import drizzleIcon from './weather-icons/weather-drizzle.svg';
import cloudyIcon from './weather-icons/weather-cloudy.svg';
import windIcon from './weather-icons/weather-wind.svg';
import clearIcon from './weather-icons/weather-clear.svg';

const recentEntries = [
  { date: '8월 8일', weather: '부슬비', icon: drizzleIcon },
  { date: '8월 6일', weather: '구름', icon: cloudyIcon },
  { date: '8월 3일', weather: '바람', icon: windIcon },
  { date: '7월 30일', weather: '맑음', icon: clearIcon },
];

export default function RecentMeSection() {
  return (
    <section id="recent-me" className="relative w-full py-14 md:py-20">
      <div className="max-w-lg mx-auto px-6">
        <AnimatedSection direction="up" distance={30}>
          <h2 className="text-xl md:text-2xl font-bold text-white leading-snug mb-5 text-center">
            최근 나
          </h2>
        </AnimatedSection>

        <AnimatedSection direction="up" distance={30} delay={150}>
          <p className="text-sm text-white/75 font-medium leading-relaxed text-center mb-10">
            오늘부터 쌓인 마음날씨를<br />날짜별로 다시 볼 수 있어요.
          </p>
        </AnimatedSection>

        <AnimatedSection direction="up" distance={20} delay={300}>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
            <div className="space-y-1">
              {recentEntries.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-3 py-3 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer"
                >
                  <span className="text-sm text-white/60 w-16 flex-shrink-0">{entry.date}</span>
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    <img src={entry.icon} alt={entry.weather} className="w-5 h-5" />
                  </div>
                  <span className="text-sm text-white/85 font-medium">{entry.weather}</span>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}