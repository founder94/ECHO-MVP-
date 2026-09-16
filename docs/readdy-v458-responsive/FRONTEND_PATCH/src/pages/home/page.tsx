import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import WeatherMeaningSection from './components/WeatherMeaningSection';
import StorySection from './components/StorySection';
import DialogueSection from './components/DialogueSection';
import CorrectionSection from './components/CorrectionSection';
import DiscoverySection from './components/DiscoverySection';
import MusicMoodSection from './components/MusicMoodSection';
import SongCandidatesSection from './components/SongCandidatesSection';
import TodayRecordSection from './components/TodayRecordSection';
import JukeboxSection from './components/JukeboxSection';
import RecentMeSection from './components/RecentMeSection';
import IdentitySection from './components/IdentitySection';
import FounderMessageSection from './components/FounderMessageSection';
import Footer from './components/Footer';
import PastelBlobs from './components/PastelBlobs';
import FloatingEffects from './components/FloatingEffects';
import SectionDivider from './components/SectionDivider';
import ScrollProgress from '@/components/ScrollProgress';
import ScrollToTop from '@/components/ScrollToTop';
import NoiseOverlay from './components/NoiseOverlay';
import { ParallaxProvider } from '@/context/ParallaxContext';
import ParallaxSection from '@/components/ParallaxSection';
import MusicPlayer from '@/components/MusicPlayer';

export default function Home() {
  return (
    <ParallaxProvider intensity={1}>
      {/* 2026-09-16 반응형 수정: min-h-screen(100vh) → 100dvh + 100vh 폴백(.echo-min-h-viewport), 가로 폭 100% 고정 */}
      <div className="echo-home echo-min-h-viewport relative w-full max-w-full">
        {/* Full page background image with float effect */}
        <div className="fixed inset-0 z-0 animate-float-bg">
          <img
            src="https://storage.helloreaddy.io/project_files/3af9018b-0984-400b-9a04-099fb48dbecd/c125683b-65fb-46b7-abb4-538de3a9e593_compressed__3.webp"
            alt=""
            className="w-full h-full object-cover"
            aria-hidden="true"
          />
        </div>

        {/* Floating pastel blobs overlay */}
        <PastelBlobs />

        {/* NEW: Floating effects — 별똥별, 구름, 무지개, 반짝이는 별 */}
        <FloatingEffects />

        {/* Subtle noise texture overlay */}
        <NoiseOverlay />

        <div className="relative z-10">
          <ScrollProgress />
          <Navbar />
          <main>
            {/* SECTION 1: Hero - brand + weather selector */}
            <HeroSection />

            <SectionDivider index={1} />

            {/* SECTION 2: 같은 날씨라도 의미는 다르다 */}
            <ParallaxSection intensity={0.3}>
              <WeatherMeaningSection />
            </ParallaxSection>

            <SectionDivider index={2} />

            {/* SECTION 3: 오늘의 사연 */}
            <ParallaxSection intensity={0.3}>
              <StorySection />
            </ParallaxSection>

            <SectionDivider index={3} />

            {/* SECTION 4: ECHO 핵심 차이 + 4 correction buttons */}
            <ParallaxSection intensity={0.35}>
              <DialogueSection />
            </ParallaxSection>

            <SectionDivider index={4} />

            {/* SECTION 5: 그게 아니에요 → real different question */}
            <ParallaxSection intensity={0.3}>
              <CorrectionSection />
            </ParallaxSection>

            <SectionDivider index={5} />

            {/* SECTION 6: 오늘의 발견 */}
            <ParallaxSection intensity={0.3}>
              <DiscoverySection />
            </ParallaxSection>

            <SectionDivider index={6} />

            {/* SECTION 7: 오늘의 음악 (mood selection) */}
            <ParallaxSection intensity={0.35}>
              <MusicMoodSection />
            </ParallaxSection>

            <SectionDivider index={7} />

            {/* SECTION 8: 오늘 같이 들을 노래 (5 candidates) */}
            <ParallaxSection intensity={0.3}>
              <SongCandidatesSection />
            </ParallaxSection>

            <SectionDivider index={8} />

            {/* SECTION 9: 오늘의 기록 */}
            <ParallaxSection intensity={0.35}>
              <TodayRecordSection />
            </ParallaxSection>

            <SectionDivider index={9} />

            {/* SECTION 10: 나의 주크박스 */}
            <ParallaxSection intensity={0.3}>
              <JukeboxSection />
            </ParallaxSection>

            <SectionDivider index={10} />

            {/* SECTION 11: 최근 나 */}
            <ParallaxSection intensity={0.3}>
              <RecentMeSection />
            </ParallaxSection>

            <SectionDivider index={11} />

            {/* SECTION 12: 제품 정체성 + CTA */}
            <ParallaxSection intensity={0.35}>
              <IdentitySection />
            </ParallaxSection>

            <SectionDivider index={12} />

            {/* SECTION 13: 대표 인사말 */}
            <ParallaxSection intensity={0.3}>
              <FounderMessageSection />
            </ParallaxSection>

            <SectionDivider index={13} />
          </main>

          <ParallaxSection intensity={0.25}>
            <Footer />
          </ParallaxSection>

          <ScrollToTop />
          <MusicPlayer />
        </div>
      </div>
    </ParallaxProvider>
  );
}