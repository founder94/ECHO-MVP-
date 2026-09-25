import { useCallback, useRef, useState } from 'react';

export type WeatherIconKey =
  | 'clear'
  | 'partlyCloudy'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'shower'
  | 'snow'
  | 'thunder'
  | 'wind'
  | 'unsure';

export type WeatherFailReason =
  | 'insecure'
  | 'unsupported'
  | 'denied'
  | 'timeout'
  | 'unavailable'
  | 'server';

export type WeatherStatus = 'idle' | 'loading' | 'ready' | 'failed';

export interface TimePeriodSlot {
  label: string;
  iconKey: WeatherIconKey;
  condition: string;
  temperature: number | null;
  precipitationProbability: number | null;
}

export interface CurrentWeather {
  label: string;
  iconKey: WeatherIconKey;
  temperature: number | null;
  high: number | null;
  low: number | null;
  apparentTemperature: number | null;
  precipitationProbability: number | null;
  humidity: number | null;
  windSpeed: number | null;
  location: string;
  periods: TimePeriodSlot[];
}

const WEATHER_TIMEOUT_MS = 10_000;
const GEO_TIMEOUT_MS = 4_000;

// 2026-09-17 실기기 결함 #1: 화면이 `{label}예요.` 로 문장을 만들어 "대체로 맑음예요." 가 나왔다.
// 라벨(명사)과 문장(서술)은 쓰임이 다르므로 아이콘 키마다 자연스러운 서술형을 따로 둔다.
export const WEATHER_SENTENCE: Record<WeatherIconKey, string> = {
  clear: '맑아요',
  partlyCloudy: '대체로 맑아요',
  cloudy: '흐려요',
  fog: '안개가 꼈어요',
  drizzle: '부슬비가 내려요',
  rain: '비가 와요',
  shower: '소나기가 내려요',
  snow: '눈이 와요',
  thunder: '천둥이 쳐요',
  wind: '바람이 불어요',
  unsure: '잘 모르겠어요',
};

/** "오늘 밖은 ___" 뒤에 그대로 붙일 수 있는 서술형 문장을 돌려준다. */
export function weatherSentence(iconKey: WeatherIconKey | null | undefined): string {
  if (!iconKey) return WEATHER_SENTENCE.unsure;
  return WEATHER_SENTENCE[iconKey] ?? WEATHER_SENTENCE.unsure;
}

function mapWeatherCode(code: number): { label: string; iconKey: WeatherIconKey } {
  if (code === 0) return { label: '맑음', iconKey: 'clear' };
  if (code === 1 || code === 2) return { label: '대체로 맑음', iconKey: 'partlyCloudy' };
  if (code === 3) return { label: '흐림', iconKey: 'cloudy' };
  if (code === 45 || code === 48) return { label: '안개', iconKey: 'fog' };
  if (code === 51 || code === 53 || code === 55) return { label: '부슬비', iconKey: 'drizzle' };
  if (code === 61 || code === 63 || code === 65 || code === 66 || code === 67) return { label: '비', iconKey: 'rain' };
  if (code === 80 || code === 81 || code === 82) return { label: '소나기', iconKey: 'shower' };
  if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) return { label: '눈', iconKey: 'snow' };
  if (code === 95 || code === 96 || code === 99) return { label: '천둥', iconKey: 'thunder' };
  return { label: '확인할 수 없어요', iconKey: 'unsure' };
}

// 오늘 하루 시간대: 오전 09시, 낮 13시, 저녁 18시, 밤 22시와 가장 가까운 오늘 데이터를 찾는다.
const PERIODS: { label: string; hour: number }[] = [
  { label: '오전', hour: 9 },
  { label: '낮', hour: 13 },
  { label: '저녁', hour: 18 },
  { label: '밤', hour: 22 },
];

function findClosestIndex(times: string[], targetHour: number): number {
  let best = -1;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const d = new Date(times[i]);
    if (Number.isNaN(d.getTime())) continue;
    const diff = Math.abs(d.getHours() - targetHour);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

function buildPeriods(
  times: string[],
  temps: number[],
  probs: number[],
  codes: number[],
): TimePeriodSlot[] {
  return PERIODS.map((period) => {
    const idx = findClosestIndex(times, period.hour);
    if (idx < 0) {
      return {
        label: period.label,
        iconKey: 'unsure' as WeatherIconKey,
        condition: '확인할 수 없어요',
        temperature: null,
        precipitationProbability: null,
      };
    }
    const mapped = mapWeatherCode(codes[idx] ?? -1);
    return {
      label: period.label,
      iconKey: mapped.iconKey,
      condition: mapped.label,
      temperature: temps[idx] ?? null,
      precipitationProbability: probs[idx] ?? null,
    };
  });
}

export function useWeather() {
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [status, setStatus] = useState<WeatherStatus>('idle');
  const [failReason, setFailReason] = useState<WeatherFailReason | null>(null);
  const requestedRef = useRef(false);

  const requestWeather = useCallback(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    setStatus('loading');
    setFailReason(null);

    // 보안 연결이 아니면 위치를 쓸 수 없음
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setStatus('failed');
      setFailReason('insecure');
      return;
    }

    // 브라우저가 위치 기능을 지원하지 않음
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setStatus('failed');
      setFailReason('unsupported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        let weatherTimer: number | undefined;
        let geoTimer: number | undefined;

        try {
          // 날씨 요청: AbortController 로 10초 제한. 시간 초과 시 'timeout'으로 구분해 재시도 버튼을 노출한다.
          const weatherController = new AbortController();
          weatherTimer = window.setTimeout(() => weatherController.abort(), WEATHER_TIMEOUT_MS);

          const weatherPromise = fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code&timezone=auto&forecast_days=1`,
            { signal: weatherController.signal },
          );

          // 지역명 요청: 4초 제한. 느리거나 실패해도 날씨 표시를 막지 않도록 별도로 분리한다.
          const geoPromise = new Promise<Response | null>((resolve) => {
            const controller = new AbortController();
            geoTimer = window.setTimeout(() => controller.abort(), GEO_TIMEOUT_MS);
            fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=ko`,
              { signal: controller.signal },
            )
              .then((res) => resolve(res))
              .catch(() => resolve(null));
          });

          const [weatherResult, geoResult] = await Promise.allSettled([weatherPromise, geoPromise]);

          // 날씨 요청 자체가 실패(타임아웃·네트워크)하면 정직하게 실패로 표시한다.
          if (weatherResult.status === 'rejected') {
            const reason = weatherResult.reason as { name?: string } | undefined;
            setStatus('failed');
            setFailReason(reason?.name === 'AbortError' ? 'timeout' : 'server');
            return;
          }

          const weatherRes = weatherResult.value;
          if (!weatherRes.ok) {
            setStatus('failed');
            setFailReason('server');
            return;
          }

          const data = await weatherRes.json();
          const code: number | undefined = data?.current?.weather_code;
          const temperature: number | null = data?.current?.temperature_2m ?? null;
          const apparentTemperature: number | null = data?.current?.apparent_temperature ?? null;
          const humidity: number | null = data?.current?.relative_humidity_2m ?? null;
          const windSpeed: number | null = data?.current?.wind_speed_10m ?? null;
          const high: number | null = data?.daily?.temperature_2m_max?.[0] ?? null;
          const low: number | null = data?.daily?.temperature_2m_min?.[0] ?? null;
          const precipitationProbability: number | null =
            data?.daily?.precipitation_probability_max?.[0] ?? null;
          const mapped = mapWeatherCode(code ?? -1);

          let location = '현재 위치';
          if (geoResult.status === 'fulfilled' && geoResult.value && geoResult.value.ok) {
            try {
              const geo = await geoResult.value.json();
              location = geo.city || geo.locality || geo.principalSubdivision || '현재 위치';
            } catch {
              location = '현재 위치';
            }
          }

          const periods = buildPeriods(
            data?.hourly?.time ?? [],
            data?.hourly?.temperature_2m ?? [],
            data?.hourly?.precipitation_probability ?? [],
            data?.hourly?.weather_code ?? []
          );

          setWeather({
            label: mapped.label,
            iconKey: mapped.iconKey,
            temperature,
            high,
            low,
            apparentTemperature,
            precipitationProbability,
            humidity,
            windSpeed,
            location,
            periods,
          });
          setStatus('ready');
        } catch {
          setStatus('failed');
          setFailReason('server');
        } finally {
          if (weatherTimer !== undefined) window.clearTimeout(weatherTimer);
          if (geoTimer !== undefined) window.clearTimeout(geoTimer);
        }
      },
      (err) => {
        if (err.code === 1) {
          setStatus('failed');
          setFailReason('denied');
        } else if (err.code === 3) {
          setStatus('failed');
          setFailReason('timeout');
        } else {
          setStatus('failed');
          setFailReason('unavailable');
        }
      },
      { timeout: 10000, maximumAge: 600000 }
    );
  }, []);

  const resetWeather = useCallback(() => {
    requestedRef.current = false;
    setWeather(null);
    setStatus('idle');
    setFailReason(null);
  }, []);

  return { weather, status, failReason, requestWeather, resetWeather };
}