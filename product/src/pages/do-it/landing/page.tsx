import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import LandingSection from '@/pages/do-it/landing/components/LandingSection';
import OriginalMusicCard from '@/pages/do-it/hero/components/OriginalMusicCard';
import DoItBrandHero from '@/components/DoItBrandHero';
import useEditorialMotion from './components/useEditorialMotion';
import { IS_APP_SITE, IS_BRAND_SITE, appUrl } from '@/lib/siteRole';
import { BrandAbout, BrandDifference, BrandGreeting, BrandJustTry, BrandMobileStart, BrandTrust, DESKTOP_QUERY, MOBILE_START_LABEL } from '@/pages/do-it/landing/components/BrandSections';

const matches = (query: string) => {
  try { return typeof window.matchMedia === 'function' && window.matchMedia(query).matches; } catch { return false; }
};
const isDesktop = () => matches(DESKTOP_QUERY);
const prefersReducedMotion = () => matches('(prefers-reduced-motion: reduce)');

// 이야기 사진(2026-09-23 대표가 보낸 파란 우주인 사진으로 교체 · 대표 승인 "넣어서 30차 만들어").
// 바깥 서버(static.readdy.ai)가 느리거나 막혀도 사진이 나오도록 사이트 안(public/brand/stories)에 둔다.
// 2026-09-23 추가 사진 4장(대표 "이 사진들을 다 넣고"): 04·06·07·08 은 원래 장면에 더 가까운 새 사진으로 바꿨다.
// 06 은 원래 01 과 같은 사막 걷기 장면이었는데, 그 장면의 파란 판이 따로 와서 06 에 넣었다(01 은 30차 그대로).
const STORY_IMAGES = {
  story_01: '/brand/stories/story-01.webp',
  story_02: '/brand/stories/story-02.webp',
  story_03: '/brand/stories/story-03.webp',
  story_04: '/brand/stories/story-04.webp',
  story_05: '/brand/stories/story-05.webp',
  story_06: '/brand/stories/story-06.webp',
  story_07: '/brand/stories/story-07.webp',
  story_08: '/brand/stories/story-08.webp',
  story_09: '/brand/stories/story-09.webp',
} as const;

// 원본 사진 9장과 순서를 보존한다. 사진만 겹쳐 이어지고 텍스트는 독립적으로 읽힌다.
export default function DoItLandingPage() {
  const navigate = useNavigate();
  const navLock = useRef(false);
  const { rootRef, motionPaused, setMotionPaused } = useEditorialMotion();

  // 휴대폰에서 앱으로 넘어갔다가 「뒤로」로 돌아오면 브라우저가 이 화면을 그대로 되살린다(bfcache).
  // 그때 잠금이 켜진 채라 시작 버튼이 먹통이 됐다(2026-09-23 검수에서 발견). 화면이 다시 보일 때 잠금을 푼다.
  useEffect(() => {
    const unlock = () => { navLock.current = false; };
    window.addEventListener('pageshow', unlock);
    return () => window.removeEventListener('pageshow', unlock);
  }, []);

  // 빠른 연속 클릭으로 두 번 이동하지 않게 잠금 처리.
  // 2026-09-20 대표 확정: 랜딩에서 "시작하기"를 누르면
  // 바로 목적 선택(/doit/start-journey)으로 간다. 우주인 4장 소개(/do-it/1~4)는
  // 랜딩과 같은 문장을 다시 보여줘서 흐름을 끊었다. 화면은 지우지 않고 링크만 뗀다.
  const handleStart = () => {
    if (IS_BRAND_SITE && isDesktop()) {
      // 2026-09-23 대표 "모바일로 시작하기로": 컴퓨터에서는 앱으로 바로 넘기지 않고 QR 구간으로 내려간다.
      // 이동이 아니라 스크롤이라 잠그지 않는다(여러 번 눌러도 같은 자리). QR 옆 「이 컴퓨터에서 열기」가 빠져나갈 문.
      const target = document.getElementById('doit-start-qr');
      if (target) { target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' }); return; }
    }
    if (navLock.current) return;
    navLock.current = true;
    // 브랜드 사이트(do-it.company)에서는 제품(app.do-it.company)으로 넘어간다(대표 확정 2026-09-21).
    if (IS_BRAND_SITE) { window.location.assign(appUrl('/doit/start-journey')); return; }
    navigate('/doit/start-journey');
  };

  return (
    <main ref={rootRef} className="doit-editorial bg-black">
      <DoItBrandHero onStart={handleStart} motionPaused={motionPaused} onToggleMotion={() => setMotionPaused((paused) => !paused)} />
      {/* 2026-09-23: 회사 홈페이지에서만 — 무엇이 다른지(히어로 바로 아래). 앱에는 나오지 않는다. */}
      {!IS_APP_SITE && <BrandDifference />}
      <div id="doit-stories">
      {/* 1구간 — 당신의 하루 */}
      <LandingSection
        imageUrl={STORY_IMAGES.story_01}
        objectPosition="center bottom"
        eyebrow="01 — 당신의 하루"
        layout="feature"
        title={
          <>
            잘 쓴 소개보다,
            <br />
            함께한 시간이 궁금해서.
          </>
        }
        subtitle={
          <>
            어떤 사람인지 묻기 전에,
            <br />
            같이 무언가를 해보면 어떨까요.
          </>
        }
        eager
        headingAs="h2"
      />

      <div className="doit-story-pair">
      {/* 2구간 — AI의 이해 */}
      <LandingSection
        imageUrl={STORY_IMAGES.story_02}
        objectPosition="center center"
        eyebrow="02 — AI의 이해"
        title={
          <>
            내 이야기는,
            <br />
            내 말로.
          </>
        }
        subtitle={
          <>
            정해진 답에 나를 맞추지 않고,
            <br />
            내가 느낀 감정부터 이야기합니다.
          </>
        }
      />

      {/* 3구간 — 연결의 시작 */}
      <LandingSection
        imageUrl={STORY_IMAGES.story_03}
        objectPosition="center bottom"
        eyebrow="03 — 연결의 시작"
        title={
          <>
            나를 설명하는
            <br />
            마지막 말은, 나에게.
          </>
        }
        subtitle={
          <>
            AI의 해석이 나와 다르면 고칠 수 있어야 합니다.
            <br />
            우리가 지키려는 약속입니다.
          </>
        }
      />

      </div>

      {/* 4구간 — 메아리의 답 */}
      <LandingSection
        imageUrl={STORY_IMAGES.story_04}
        objectPosition="center center"
        eyebrow="04 — 메아리의 답"
        layout="side"
        title={
          <>
            대화가 끝나도,
            <br />
            나에 대한 이해는 남도록.
          </>
        }
        subtitle={
          <>
            흘려보냈던 말에서 내 기준을 발견하고,
            <br />
            다음 선택에 다시 꺼내볼 수 있도록.
          </>
        }
      />

      <div className="doit-story-pair doit-story-pair--reverse">
      {/* 5구간 — 마음의 날씨 */}
      <LandingSection
        imageUrl={STORY_IMAGES.story_05}
        objectPosition="center center"
        eyebrow="05 — 감정의 이유"
        title={
          <>
            오늘의 감정에도
            <br />
            이유가 있으니까.
          </>
        }
        subtitle={
          <>
            좋은 날만 이야기하지 않아도 괜찮습니다.
            <br />
            설명하기 어려운 마음도 나의 일부니까요.
          </>
        }
      />

      {/* 6구간 — 감정의 변화 */}
      <LandingSection
        imageUrl={STORY_IMAGES.story_06}
        objectPosition="center bottom"
        eyebrow="06 — 감정의 변화"
        title={
          <>
            어제와 다른 나여도,
            <br />
            괜찮습니다.
          </>
        }
        subtitle={
          <>
            늘 같은 답을 할 필요는 없습니다.
            <br />
            지금의 내 말을 먼저 듣는 것부터.
          </>
        }
      />

      </div>

      <div className="doit-story-pair doit-story-pair--even">
      {/* 7구간 — 새로운 시선 */}
      <LandingSection
        imageUrl={STORY_IMAGES.story_07}
        objectPosition="center center"
        eyebrow="07 — 새로운 시선"
        title={
          <>
            조금 다른 시선으로,
            <br />
            나를 다시 봅니다.
          </>
        }
        subtitle={
          <>
            내가 당연하게 여겼던 것들.
            <br />
            누군가와 함께하면 새롭게 보이기도 합니다.
          </>
        }
      />

      {/* 8구간 — 우주의 연결 */}
      <LandingSection
        imageUrl={STORY_IMAGES.story_08}
        objectPosition="center center"
        eyebrow="08 — 우주의 연결"
        title={
          <>
            연결의 속도는,
            <br />
            각자가 정합니다.
          </>
        }
        subtitle={
          <>
            서두르지 않고, 내가 원하는 관계부터.
            <br />
            서로의 선택을 존중하는 연결을 생각합니다.
          </>
        }
      />

      </div>

      {/* 9구간 — 시간의 기록 */}
      <LandingSection
        imageUrl={STORY_IMAGES.story_09}
        objectPosition="center bottom"
        eyebrow="09 — 이제, 당신의 이야기"
        layout="closing"
        title={
          <>
            어떤 사람을
            <br />
            만나고 싶으세요?
          </>
        }
        subtitle={
          <>
            친구가 필요한지, 새로운 관계를 원하는지.
            <br />
            지금의 내 마음에 맞는 목적부터 고르세요.
          </>
        }
        actionLabel={IS_BRAND_SITE ? MOBILE_START_LABEL : '시작하기'}
        onAction={handleStart}
      >
        {/* 대표 최종 승인 2026-09-24 §7: 옛 문장(「목적 선택과 프로필 준비까지 · 사람 연결은 준비 중」)은 대화가 열린 지금과 맞지 않았다.
            허락된 문장 「이야기가 쌓이면, 다음은 ECHO가 준비합니다」도 운영 실제(전화 인증 0명·연결 0건 — 문자 발송 업체 미연결)보다 앞서가므로
            더 보수적으로: 지금 되는 것(대화)과 아직인 것(다음 단계 준비)만 말한다. */}
        <p>지금은 당신의 이야기를 듣는 데서 시작합니다.<br />다음 단계는 ECHO가 준비하고 있습니다.</p>
        <OriginalMusicCard />
      </LandingSection>
      </div>
      {/* 대표 최종 승인 2026-09-24: 회사 홈페이지에서만 — 지키는 것(Trust) · 작은 시도(Just Try). 한 화면에 메시지 하나. */}
      {!IS_APP_SITE && <BrandTrust />}
      {!IS_APP_SITE && <BrandJustTry />}
      {/* 2026-09-23: 회사 홈페이지에서만 — 시작하는 법 + 휴대폰으로 넘어가기(휴대폰은 버튼, 컴퓨터는 QR). */}
      {!IS_APP_SITE && <BrandMobileStart />}
      {/* 2026-09-23: 회사 홈페이지에서만 — 회사 소개(바닥글 사업자 정보 바로 위). */}
      {!IS_APP_SITE && <BrandAbout />}
      {/* 2026-09-23: 회사 홈페이지에서만 — 대표 인사말(맨 마지막, 바닥글 바로 위). */}
      {!IS_APP_SITE && <BrandGreeting />}
      <footer className="doit-brand-legal">
        <details><summary>DO IT COMPANY · 사업자 정보</summary><p>두잇(DO IT) · 대표 박진욱</p><p>사업자등록번호 121-46-51503 · 통신판매업 신고 제 2026-다산-0583호</p><p>경기도 남양주시 강변북로632번길 41-7, 102동 101호(수석동)</p></details>
        <a href="mailto:0423doit@gmail.com">문의 · 0423doit@gmail.com</a>
      </footer>
    </main>
  );
}
