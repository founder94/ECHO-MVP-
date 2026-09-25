import PastelBlobs from '@/pages/home/components/PastelBlobs';
import type { WeatherIconKey } from '@/pages/do-it/weather/hooks/useWeather';

interface WeatherBackdropProps {
  // 기존 B 화면의 호출 계약만 유지한다. 브랜드 배경은 날씨에 따라 바꾸지 않는다.
  iconKey: WeatherIconKey | null;
}

// project-13870088의 홈 히어로(src/pages/home/page.tsx)가 실제 사용하는 배경 자산.
// 비슷한 새 팔레트를 만들지 않고, 같은 이미지와 기존 PastelBlobs를 그대로 쓴다.
// 홈/A/전역 테마 원본은 수정하지 않는다. 날씨 표현은 기존 WeatherEffect가 담당한다.
const HERO_BACKGROUND_SRC =
  'https://storage.helloreaddy.io/project_files/3af9018b-0984-400b-9a04-099fb48dbecd/c125683b-65fb-46b7-abb4-538de3a9e593_compressed__3.webp';

export default function WeatherBackdrop({ iconKey }: WeatherBackdropProps) {
  void iconKey;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
    >
      <div className="absolute inset-0 animate-float-bg">
        <img
          src={HERO_BACKGROUND_SRC}
          alt=""
          className="w-full h-full object-cover"
        />
      </div>
      <PastelBlobs />
    </div>
  );
}