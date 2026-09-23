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
  | 'denied'
  | 'timeout'
  | 'unavailable'
  | 'server';

export type WeatherStatus = 'idle' | 'loading' | 'ready' | 'failed';

export interface HourlySlot {
  label: string;
  iconKey: WeatherIconKey;
  temperature: number | null;
}

export interface CurrentWeather {
  label: string;
  iconKey: WeatherIconKey;
  temperature: number | null;
  high: number | null;
  low: number | null;
  location: string;
  hourly: HourlySlot[];
}

const WEATHER_TIMEOUT_MS = 10_000;
const GEO_TIMEOUT_MS = 4_000;

function mapWeatherCode(code: number): { label: string; iconKey: WeatherIconKey } {
  if (code === 0) return { label: '맑음', iconKey: 'clear' };
  if (code === 1 || code === 2) return { label: '대체로 맑음', iconKey: 'partlyCloudy' };
  if (code === 3) return { label: '흐림', iconKey: 'cloudy' };
  if (code === 45 || code === 48) return { label: '안개', iconKey: 'fog' };
  if (code === 51 || code === 53 || code === 55) return { label: '부슬비', iconKey: 'drizzle' };
  if (code === 61 || code === 63 || code === 65 || code === 66 || code === 67) return { label: '비', iconKey: 'rain' };
  if (code === 80 || code === 81 || code === 82) return { label: '소나기', iconKey: 'shower' };
  if (code === 95 || code === 96 || code === 99) return { label: '천둥', iconKey: 'thunder' };
  if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) return { label: '눈', iconKey: 'snow' };
  return { label: '날씨를 알 수 없어요', iconKey: 'unsure' };
}

function buildHourlySlots(times: string[], temps: number[], codes: number[]): HourlySlot[] {
  const now = Date.now();
  const slots: HourlySlot[] = [];
  for (let i = 0; i < times.length; i++) {
    const timeMs = new Date(times[i]).getTime();
    if (timeMs <= now) continue;
    const hour = new Date(times[i]).getHours();
    const mapped = mapWeatherCode(codes[i] ?? -1);
    slots.push({
      label: `${hour}시`,
      iconKey: mapped.iconKey,
      temperature: temps[i] ?? null,
    });
    if (slots.length >= 5) break;
  }
  return slots;
}

export function useCurrentWeather() {
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

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setStatus('failed');
      setFailReason('unavailable');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        let weatherTimer: number | undefined;
        let geoTimer: number | undefined;

        try {
          // 날씨 요청: 10초 제한. 시간 초과 시 'timeout'으로 구분해 재시도 버튼을 노출한다.
          const weatherController = new AbortController();
          weatherTimer = window.setTimeout(() => weatherController.abort(), WEATHER_TIMEOUT_MS);

          const weatherPromise = fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&hourly=temperature_2m,weather_code&timezone=auto&forecast_days=1`,
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
          const code: number = data?.current?.weather_code;
          const temperature: number | null = data?.current?.temperature_2m ?? null;
          const high: number | null = data?.daily?.temperature_2m_max?.[0] ?? null;
          const low: number | null = data?.daily?.temperature_2m_min?.[0] ?? null;
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

          const hourly = buildHourlySlots(
            data?.hourly?.time ?? [],
            data?.hourly?.temperature_2m ?? [],
            data?.hourly?.weather_code ?? []
          );

          setWeather({ label: mapped.label, iconKey: mapped.iconKey, temperature, high, low, location, hourly });
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