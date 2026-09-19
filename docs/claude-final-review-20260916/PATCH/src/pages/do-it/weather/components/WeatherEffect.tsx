import type { WeatherIconKey } from '@/pages/do-it/weather/hooks/useWeather';

interface WeatherEffectProps {
  iconKey: WeatherIconKey | null;
}

const RAIN_DROPS = Array.from({ length: 28 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${(i * 0.31) % 2.4}s`,
  duration: `${1.1 + ((i * 0.13) % 0.9)}s`,
  height: `${18 + ((i * 7) % 26)}px`,
}));

const SNOW_FLAKES = Array.from({ length: 22 }, (_, i) => ({
  left: `${(i * 47) % 100}%`,
  delay: `${(i * 0.6) % 5}s`,
  duration: `${4 + ((i * 0.5) % 4)}s`,
}));

const CLOUDS = Array.from({ length: 5 }, (_, i) => ({
  top: `${6 + i * 19}%`,
  delay: `${(i * 1.8) % 6}s`,
  duration: `${16 + ((i * 4) % 10)}s`,
  width: `${220 + ((i * 41) % 180)}px`,
  height: `${70 + ((i * 17) % 60)}px`,
}));

const FOG_LAYERS = Array.from({ length: 3 }, (_, i) => ({
  top: `${52 + i * 16}%`,
  delay: `${(i * 2.3) % 6}s`,
  duration: `${22 + ((i * 5) % 9)}s`,
}));

export default function WeatherEffect({ iconKey }: WeatherEffectProps) {
  if (!iconKey) return null;

  const isRain = iconKey === 'rain' || iconKey === 'drizzle' || iconKey === 'shower';
  const isSnow = iconKey === 'snow';
  const isThunder = iconKey === 'thunder';
  const isCloudy = iconKey === 'cloudy' || iconKey === 'partlyCloudy';
  const isFog = iconKey === 'fog';

  if (isRain) {
    return (
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {RAIN_DROPS.map((drop, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-rain-fall"
            style={{
              left: drop.left,
              top: '-10%',
              width: '1.5px',
              height: drop.height,
              background: 'linear-gradient(to bottom, rgba(180,200,255,0.0), rgba(180,200,255,0.55))',
              animationDelay: drop.delay,
              animationDuration: drop.duration,
            }}
          />
        ))}
      </div>
    );
  }

  if (isSnow) {
    return (
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {SNOW_FLAKES.map((flake, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-snow-fall"
            style={{
              left: flake.left,
              top: '-5%',
              width: '4px',
              height: '4px',
              background: 'rgba(226, 240, 255, 0.75)',
              animationDelay: flake.delay,
              animationDuration: flake.duration,
            }}
          />
        ))}
      </div>
    );
  }

  if (isThunder) {
    return (
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 animate-thunder-flash" />
      </div>
    );
  }

  if (isCloudy) {
    return (
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {CLOUDS.map((cloud, i) => (
          <div
            key={i}
            className="absolute animate-cloud-drift"
            style={{
              top: cloud.top,
              left: 0,
              width: cloud.width,
              height: cloud.height,
              // 2026-09-16 모바일 GPU 대응: 타원 그라디언트가 이미 투명으로 사라지므로 filter: blur 를 제거한다(Android 사각 잘림·iOS 부하 방지).
              background:
                'radial-gradient(ellipse at center, rgba(210,224,244,0.6) 0%, rgba(210,224,244,0) 70%)',
              animationDelay: cloud.delay,
              animationDuration: cloud.duration,
            }}
          />
        ))}
      </div>
    );
  }

  if (isFog) {
    return (
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {FOG_LAYERS.map((fog, i) => (
          <div
            key={i}
            className="absolute animate-fog-drift"
            style={{
              top: fog.top,
              left: 0,
              width: '100%',
              height: '160px',
              // 2026-09-16 모바일 GPU 대응: filter: blur(28px) 대신 위·아래를 마스크로 투명하게 만들어 같은 안개 띠를 낸다.
              background:
                'linear-gradient(to right, transparent, rgba(214,222,232,0.30), rgba(214,222,232,0.30), transparent)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 35%, black 65%, transparent)',
              maskImage: 'linear-gradient(to bottom, transparent, black 35%, black 65%, transparent)',
              animationDelay: fog.delay,
              animationDuration: fog.duration,
            }}
          />
        ))}
      </div>
    );
  }

  return null;
}