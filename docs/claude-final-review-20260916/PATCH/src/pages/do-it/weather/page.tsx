import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWeather, type WeatherIconKey, type WeatherFailReason } from './hooks/useWeather';
import WeatherBackdrop from './components/WeatherBackdrop';
import WeatherEffect from './components/WeatherEffect';
import clearIcon from '@/pages/home/components/weather-icons/weather-clear.svg';
import partlyCloudyIcon from '@/pages/home/components/weather-icons/weather-partly-cloudy.svg';
import cloudyIcon from '@/pages/home/components/weather-icons/weather-cloudy.svg';
import fogIcon from '@/pages/home/components/weather-icons/weather-fog.svg';
import drizzleIcon from '@/pages/home/components/weather-icons/weather-drizzle.svg';
import rainIcon from '@/pages/home/components/weather-icons/weather-rain.svg';
import showerIcon from '@/pages/home/components/weather-icons/weather-shower.svg';
import snowIcon from '@/pages/home/components/weather-icons/weather-snow.svg';
import thunderIcon from '@/pages/home/components/weather-icons/weather-thunder.svg';
import windIcon from '@/pages/home/components/weather-icons/weather-wind.svg';
import unsureIcon from '@/pages/home/components/weather-icons/weather-unsure.svg';

const weatherIconMap: Record<WeatherIconKey, string> = {
  clear: clearIcon,
  partlyCloudy: partlyCloudyIcon,
  cloudy: cloudyIcon,
  fog: fogIcon,
  drizzle: drizzleIcon,
  rain: rainIcon,
  shower: showerIcon,
  snow: snowIcon,
  thunder: thunderIcon,
  wind: windIcon,
  unsure: unsureIcon,
};

const failMessages: Record<WeatherFailReason, string> = {
  insecure: '보안 연결이 아니라서 위치를 사용할 수 없어요.',
  unsupported: '이 브라우저는 위치 기능을 지원하지 않아요.',
  denied: '위치 권한이 꺼져 있어요. 허용하면 지금 날씨를 보여드릴게요.',
  timeout: '위치를 확인하는 데 시간이 오래 걸렸어요. 잠시 후 다시 시도해 주세요.',
  unavailable: '현재 위치를 찾지 못했어요. 네트워크 상태를 확인해 주세요.',
  server: '날씨 서버가 잠시 응답하지 않아요. 잠시 후 다시 시도해 주세요.',
};

// 값이 없으면 0으로 바꾸지 않고 "확인할 수 없어요"를 표시한다(undefined·null·NaN 노출 방지).
function formatTemp(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '확인할 수 없어요';
  return `${Math.round(value)}°`;
}

function formatPercent(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '확인할 수 없어요';
  return `${Math.round(value)}%`;
}

function formatWind(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '확인할 수 없어요';
  return `${Math.round(value)} km/h`;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.07] border border-white/[0.11] backdrop-blur-[10px] px-3 py-3 text-center">
      <p className="text-[11px] text-white/55 mb-1">{label}</p>
      <p className="text-[15px] font-semibold text-white whitespace-nowrap">{value}</p>
    </div>
  );
}

export default function WeatherPage() {
  const [loaded, setLoaded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { weather, status, failReason, requestWeather, resetWeather } = useWeather();

  const location = useLocation();
  const navigate = useNavigate();
  const fromCta = (location.state as { fromCta?: boolean } | null)?.fromCta ?? false;

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

  // 랜딩 CTA로 들어오면 위치 확인을 자동 시작. 직접 주소를 친 경우에는 묻지 않음.
  useEffect(() => {
    if (fromCta) {
      requestWeather();
    }
  }, [fromCta, requestWeather]);

  // 부드러운 마우스 패럴랙스 — 콘텐츠가 아주 조금 따라 움직임
  useEffect(() => {
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (contentRef.current) {
          contentRef.current.style.transform = `translate3d(${nx * 8}px, ${ny * 8}px, 0)`;
        }
      });
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  const isFailed = status === 'failed';
  const isLoading = status === 'loading';

  const handleStartWeather = () => requestWeather();
  const handleRetry = () => {
    resetWeather();
    requestWeather();
  };
  const handleProceed = () => {
    navigate('/weather-check', { state: { hasWeather: false } });
  };
  const handleProceedWithWeather = () => {
    if (weather) {
      navigate('/weather-check', {
        state: { hasWeather: true, weatherLabel: weather.label, iconKey: weather.iconKey },
      });
    } else {
      navigate('/weather-check', { state: { hasWeather: false } });
    }
  };

  const reveal = (delay: number) => ({
    opacity: loaded ? 1 : 0,
    transform: loaded ? 'translateY(0)' : 'translateY(30px)',
    transition: `opacity 700ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms, transform 700ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`,
  });

  return (
    <section className="relative w-full echo-min-h-viewport flex items-center justify-center overflow-hidden">
      <WeatherBackdrop iconKey={weather?.iconKey ?? null} />
      <WeatherEffect iconKey={weather?.iconKey ?? null} />

      <div
        ref={contentRef}
        className="relative z-10 w-full max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+32px)] pb-[calc(env(safe-area-inset-bottom)+32px)]"
      >
        {/* 상태 1 + 2 — 시작 / 불러오는 중 */}
        {status !== 'ready' && !isFailed && (
          <div className="flex flex-col items-center text-center">
            <p
              style={reveal(0)}
              className="text-[11px] tracking-[0.5em] text-white/55 font-medium mb-7 uppercase"
            >
              ECHO
            </p>

            <h1
              style={reveal(120)}
              className="text-[26px] leading-snug font-bold text-white mb-3"
            >
              오늘 내 마음의<br />날씨는 어때?
            </h1>

            <p style={reveal(240)} className="text-[13.5px] text-white/60 mb-9">
              내 마음을 알면, 내가 보인다.
            </p>

            <div style={reveal(360)} className="mb-9">
              <img
                src={unsureIcon}
                alt="오늘 내 마음의 날씨"
                className="w-[150px] h-[150px] object-contain opacity-90"
              />
            </div>

            <button
              type="button"
              onClick={handleStartWeather}
              disabled={isLoading}
              style={reveal(480)}
              className="w-full max-w-xs h-14 rounded-2xl bg-white text-[#0c1526] text-[15px] font-semibold flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer hover:bg-white/90 active:scale-[0.99] transition-all duration-200 disabled:cursor-not-allowed disabled:hover:bg-white"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#0c1526]/25 border-t-[#0c1526] rounded-full animate-spin" />
                  날씨 확인 중...
                </>
              ) : (
                <>내 위치의 날씨로 시작하기</>
              )}
            </button>

            <p style={reveal(600)} className="text-[11.5px] text-white/40 mt-4">
              위치는 현재 날씨를 확인할 때만 쓰고 저장하지 않아요.
            </p>

            <button
              type="button"
              onClick={handleProceed}
              style={reveal(720)}
              className="mt-6 text-[13px] text-white/55 underline underline-offset-4 cursor-pointer hover:text-white/80 transition-colors duration-200 whitespace-nowrap"
            >
              날씨 없이 내 마음부터 말하기
            </button>
          </div>
        )}

        {/* 상태 3 — 날씨 확인됨 */}
        {status === 'ready' && weather && (
          <div className="flex flex-col items-center text-center">
            {/* 1. 현재 지역 */}
            <p style={reveal(0)} className="text-[13px] text-white/75 mb-3">
              {weather.location}
            </p>

            {/* 2. 현재 날씨 상태 */}
            <div style={reveal(60)} className="flex items-center gap-2 mb-2">
              <img
                src={weatherIconMap[weather.iconKey]}
                alt={weather.label}
                className="w-6 h-6 object-contain"
              />
              <span className="text-[16px] font-medium text-white">{weather.label}</span>
            </div>

            {/* 3. 현재 기온 (가장 크게) */}
            <div style={reveal(120)} className="flex items-start justify-center mb-2">
              {weather.temperature != null ? (
                <>
                  <span className="text-[74px] leading-none font-thin text-white tracking-tighter">
                    {Math.round(weather.temperature)}
                  </span>
                  <span className="text-[26px] font-thin text-white/70 mt-1">°</span>
                </>
              ) : (
                <span className="text-[20px] font-medium text-white/80">확인할 수 없어요</span>
              )}
            </div>

            {/* 4~5. 최고·최저 */}
            <p style={reveal(180)} className="text-[12.5px] text-white/60 mb-6">
              최고 {weather.high != null ? `${Math.round(weather.high)}°` : '확인할 수 없어요'} · 최저{' '}
              {weather.low != null ? `${Math.round(weather.low)}°` : '확인할 수 없어요'}
            </p>

            {/* 6~9. 상세 정보 */}
            <div style={reveal(260)} className="w-full grid grid-cols-2 gap-2 mb-6">
              <MetricCard label="체감 온도" value={formatTemp(weather.apparentTemperature)} />
              <MetricCard label="강수 가능성" value={formatPercent(weather.precipitationProbability)} />
              <MetricCard label="습도" value={formatPercent(weather.humidity)} />
              <MetricCard label="풍속" value={formatWind(weather.windSpeed)} />
            </div>

            {/* 10~13. 시간대별 날씨 (모바일 2열, 넓은 화면 4열) */}
            <div style={reveal(340)} className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8">
              {weather.periods.map((slot) => (
                <div
                  key={slot.label}
                  className="flex flex-col items-center gap-1 rounded-2xl bg-white/[0.07] border border-white/[0.11] backdrop-blur-[10px] px-2 py-3"
                >
                  <span className="text-[11px] text-white/60 whitespace-nowrap">{slot.label}</span>
                  <img src={weatherIconMap[slot.iconKey]} alt="" className="w-6 h-6 object-contain" />
                  <span className="text-[11px] text-white/80 whitespace-nowrap">{slot.condition}</span>
                  <span className="text-[14px] font-semibold text-white whitespace-nowrap">
                    {slot.temperature != null ? `${Math.round(slot.temperature)}°` : '확인할 수 없어요'}
                  </span>
                  <span className="text-[10.5px] text-white/55 leading-tight">
                    {slot.precipitationProbability != null
                      ? `강수 ${Math.round(slot.precipitationProbability)}%`
                      : '강수 확인 불가'}
                  </span>
                </div>
              ))}
            </div>

            {/* 14. 마음 날씨 입력으로 이동 */}
            <button
              type="button"
              onClick={handleProceedWithWeather}
              style={reveal(420)}
              className="w-full max-w-xs h-14 rounded-2xl bg-white text-[#0c1526] text-[15px] font-semibold flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer hover:bg-white/90 active:scale-[0.99] transition-all duration-200"
            >
              이 날씨 속의 내 마음 알아보기
            </button>
          </div>
        )}

        {/* 상태 4 — 날씨를 못 가져왔을 때 */}
        {isFailed && (
          <div className="flex flex-col items-center text-center">
            <div style={reveal(0)} className="mb-6 opacity-75">
              <img
                src={fogIcon}
                alt="날씨를 확인하지 못했어요"
                className="w-[100px] h-[100px] object-contain"
              />
            </div>

            <h2 style={reveal(120)} className="text-[22px] font-bold text-white mb-3">
              날씨를 확인하지 못했어요
            </h2>

            <p style={reveal(240)} className="text-[13.5px] text-white/70 mb-10 max-w-xs leading-relaxed">
              {failReason ? failMessages[failReason] : '잠시 후 다시 시도해 주세요.'}
            </p>

            <div style={reveal(360)} className="w-full max-w-xs flex flex-col gap-3">
              <button
                type="button"
                onClick={handleRetry}
                className="w-full h-14 rounded-2xl bg-white text-[#0c1526] text-[15px] font-semibold whitespace-nowrap cursor-pointer hover:bg-white/90 active:scale-[0.99] transition-all duration-200"
              >
                위치 권한 다시 확인하기
              </button>
              <button
                type="button"
                onClick={handleProceed}
                className="w-full h-14 rounded-2xl border border-white/25 text-white text-[15px] font-medium whitespace-nowrap cursor-pointer hover:bg-white/10 active:scale-[0.99] transition-all duration-200"
              >
                날씨 없이 내 마음 말하기
              </button>
            </div>
          </div>
        )}
      </div>

    </section>
  );
}