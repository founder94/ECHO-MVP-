import type { WeatherIconKey } from '@/hooks/useCurrentWeather';

// ECHO(B구조) 홈 섹션용 뒷배경. 여정 배경과 같은 초록·노랑·청록 톤으로 통일한다(파랑·보라 제거).
interface Palette {
  // 바탕 그라디언트 (어두운 쪽)
  baseGradient: string;
  // 색 원들
  blobs: { color: string; size: string; top?: string; left?: string; right?: string; bottom?: string; delay: string; duration: string }[];
}

const palettes: Partial<Record<WeatherIconKey, Palette>> = {
  // 맑음 — 밝고 따뜻한 초록 + 노랑
  clear: {
    baseGradient: 'linear-gradient(160deg, #0b3a2f 0%, #2f6b33 40%, #7c6f1d 74%, #0a2c25 100%)',
    blobs: [
      { color: 'rgba(120, 235, 185, 0.55)', size: '26rem', top: '-12%', left: '-10%', delay: '0s', duration: '26s' },
      { color: 'rgba(255, 222, 120, 0.5)', size: '22rem', top: '8%', right: '-8%', delay: '6s', duration: '30s' },
      { color: 'rgba(205, 235, 110, 0.46)', size: '24rem', bottom: '-8%', left: '18%', delay: '11s', duration: '28s' },
      { color: 'rgba(150, 240, 200, 0.4)', size: '20rem', top: '55%', right: '12%', delay: '4s', duration: '24s' },
    ],
  },
  // 구름 조금 — 부드러운 초록 + 옅은 노랑
  partlyCloudy: {
    baseGradient: 'linear-gradient(160deg, #10352c 0%, #2c5a37 42%, #5c5524 100%)',
    blobs: [
      { color: 'rgba(140, 225, 190, 0.5)', size: '24rem', top: '-10%', right: '-8%', delay: '0s', duration: '28s' },
      { color: 'rgba(205, 220, 140, 0.44)', size: '26rem', bottom: '-10%', left: '-6%', delay: '7s', duration: '30s' },
      { color: 'rgba(248, 222, 130, 0.42)', size: '20rem', top: '45%', left: '15%', delay: '12s', duration: '26s' },
    ],
  },
  // 흐림 — 차분한 청록·올리브
  cloudy: {
    baseGradient: 'linear-gradient(160deg, #122b27 0%, #263c2c 45%, #131f1b 100%)',
    blobs: [
      { color: 'rgba(150, 205, 175, 0.46)', size: '26rem', top: '-12%', left: '-8%', delay: '0s', duration: '30s' },
      { color: 'rgba(195, 205, 150, 0.42)', size: '24rem', bottom: '-8%', right: '-6%', delay: '8s', duration: '27s' },
      { color: 'rgba(120, 195, 155, 0.42)', size: '22rem', top: '35%', right: '14%', delay: '3s', duration: '24s' },
    ],
  },
  // 안개 — 흐린 연녹·미색
  fog: {
    baseGradient: 'linear-gradient(160deg, #1f2b25 0%, #2f3b31 45%, #171e1a 100%)',
    blobs: [
      { color: 'rgba(208, 222, 200, 0.42)', size: '26rem', top: '-10%', left: '-8%', delay: '0s', duration: '28s' },
      { color: 'rgba(180, 205, 180, 0.44)', size: '24rem', bottom: '-8%', right: '-6%', delay: '6s', duration: '30s' },
      { color: 'rgba(212, 216, 190, 0.4)', size: '22rem', top: '50%', left: '12%', delay: '11s', duration: '26s' },
    ],
  },
  // 이슬비 — 짙은 청록녹 + 연두
  drizzle: {
    baseGradient: 'linear-gradient(160deg, #12302b 0%, #27452d 45%, #101f1a 100%)',
    blobs: [
      { color: 'rgba(110, 220, 175, 0.5)', size: '24rem', top: '-10%', right: '-8%', delay: '0s', duration: '28s' },
      { color: 'rgba(180, 220, 120, 0.46)', size: '26rem', bottom: '-8%', left: '-6%', delay: '7s', duration: '30s' },
    ],
  },
  // 비 — 깊은 청록녹 + 노랑 포인트
  rain: {
    baseGradient: 'linear-gradient(160deg, #0e2a26 0%, #1f3d2b 45%, #0a1a16 100%)',
    blobs: [
      { color: 'rgba(90, 210, 170, 0.5)', size: '26rem', top: '-12%', left: '-8%', delay: '0s', duration: '30s' },
      { color: 'rgba(170, 210, 110, 0.44)', size: '24rem', bottom: '-8%', right: '-6%', delay: '8s', duration: '27s' },
      { color: 'rgba(70, 190, 150, 0.44)', size: '22rem', top: '40%', right: '12%', delay: '3s', duration: '25s' },
    ],
  },
  // 소나기 — 더 짙은 청록녹 + 노랑 포인트
  shower: {
    baseGradient: 'linear-gradient(160deg, #0c2622 0%, #1d3823 45%, #081410 100%)',
    blobs: [
      { color: 'rgba(80, 215, 175, 0.52)', size: '26rem', top: '-10%', right: '-8%', delay: '0s', duration: '28s' },
      { color: 'rgba(185, 215, 100, 0.46)', size: '24rem', bottom: '-8%', left: '-6%', delay: '7s', duration: '30s' },
    ],
  },
  // 눈 — 옅은 연녹·미색
  snow: {
    baseGradient: 'linear-gradient(160deg, #1a2f29 0%, #31462f 45%, #16211b 100%)',
    blobs: [
      { color: 'rgba(210, 240, 225, 0.54)', size: '26rem', top: '-12%', left: '-8%', delay: '0s', duration: '28s' },
      { color: 'rgba(242, 240, 200, 0.46)', size: '24rem', bottom: '-8%', right: '-6%', delay: '7s', duration: '30s' },
      { color: 'rgba(190, 232, 200, 0.44)', size: '22rem', top: '42%', right: '12%', delay: '11s', duration: '26s' },
    ],
  },
  // 천둥 — 어두운 올리브녹 + 노랑 섬광
  thunder: {
    baseGradient: 'linear-gradient(160deg, #1c2a12 0%, #2d3b18 45%, #101608 100%)',
    blobs: [
      { color: 'rgba(170, 210, 90, 0.5)', size: '26rem', top: '-12%', left: '-8%', delay: '0s', duration: '29s' },
      { color: 'rgba(205, 205, 130, 0.44)', size: '24rem', bottom: '-8%', right: '-6%', delay: '7s', duration: '27s' },
      { color: 'rgba(120, 195, 130, 0.46)', size: '22rem', top: '45%', left: '14%', delay: '12s', duration: '25s' },
    ],
  },
};

// 날씨 없이 진행하는 흐름(중립 팔레트) — 히어로(홈) 초록·노랑 톤
const defaultPalette: Palette = {
  baseGradient: 'linear-gradient(160deg, #0b3a2f 0%, #2f6b33 40%, #7c6f1d 74%, #0a2c25 100%)',
  blobs: [
    { color: 'rgba(120, 235, 185, 0.52)', size: '26rem', top: '-12%', left: '-8%', delay: '0s', duration: '28s' },
    { color: 'rgba(255, 224, 120, 0.44)', size: '24rem', bottom: '-8%', right: '-6%', delay: '7s', duration: '30s' },
    { color: 'rgba(160, 235, 150, 0.44)', size: '22rem', top: '40%', right: '14%', delay: '11s', duration: '26s' },
  ],
};

interface WeatherBackdropProps {
  iconKey: WeatherIconKey | null;
  // 날씨 없이 진행하는 흐름(마음 입력 등)에서 쓸 중립 팔레트
  neutral?: boolean;
}

export default function WeatherBackdrop({ iconKey, neutral = false }: WeatherBackdropProps) {
  const palette = !neutral && iconKey ? palettes[iconKey] ?? defaultPalette : defaultPalette;

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
      {/* 어두운 바탕 그라디언트 */}
      <div
        className="absolute inset-0"
        style={{ background: palette.baseGradient }}
      />

      {/* 색 원 — 진한 파스텔, 72px 흐림, 화면 가장자리에 배치 */}
      {palette.blobs.map((blob, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-blob-float"
          style={{
            backgroundColor: blob.color,
            width: blob.size,
            height: blob.size,
            top: blob.top,
            left: blob.left,
            right: blob.right,
            bottom: blob.bottom,
            filter: 'blur(72px)',
            animationDelay: blob.delay,
            animationDuration: blob.duration,
          }}
        />
      ))}
    </div>
  );
}