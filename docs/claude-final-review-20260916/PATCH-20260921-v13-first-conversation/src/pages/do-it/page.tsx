import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import LandingSection from '@/pages/do-it/landing/components/LandingSection';
import OriginalMusicCard from '@/pages/do-it/hero/components/OriginalMusicCard';
import DoItBrandHero from '@/components/DoItBrandHero';
import useEditorialMotion from './components/useEditorialMotion';
import { IS_BRAND_SITE, appUrl } from '@/lib/siteRole';

// 원본 사진 9장과 순서를 보존한다. 사진만 겹쳐 이어지고 텍스트는 독립적으로 읽힌다.
export default function DoItLandingPage() {
  const navigate = useNavigate();
  const navLock = useRef(false);
  const { rootRef, motionPaused, setMotionPaused } = useEditorialMotion();

  // 빠른 연속 클릭으로 두 번 이동하지 않게 잠금 처리.
  // 2026-09-20 대표 확정: 랜딩에서 "시작하기"를 누르면
  // 바로 목적 선택(/doit/start-journey)으로 간다. 우주인 4장 소개(/do-it/1~4)는
  // 랜딩과 같은 문장을 다시 보여줘서 흐름을 끊었다. 화면은 지우지 않고 링크만 뗀다.
  const handleStart = () => {
    if (navLock.current) return;
    navLock.current = true;
    // 브랜드 사이트(do-it.company)에서는 제품(app.do-it.company)으로 넘어간다(대표 확정 2026-09-21).
    if (IS_BRAND_SITE) { window.location.assign(appUrl('/doit/start-journey')); return; }
    navigate('/doit/start-journey');
  };

  return (
    <main ref={rootRef} className="doit-editorial bg-black">
      <DoItBrandHero onStart={handleStart} motionPaused={motionPaused} onToggleMotion={() => setMotionPaused((paused) => !paused)} />
      <div id="doit-stories">
      {/* 1구간 — 당신의 하루 */}
      <LandingSection
        imageUrl="https://static.readdy.ai/image/e224f7e72060e6f454dd03772ed2f9f9/9f9467758f384952b2b7be95c66346bb.png"
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
        imageUrl="https://static.readdy.ai/image/e224f7e72060e6f454dd03772ed2f9f9/fa4d2c87287d86610de3616874542765.png"
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
        imageUrl="https://static.readdy.ai/image/e224f7e72060e6f454dd03772ed2f9f9/9eacf987b509a7f1e82d97b336aad767.png"
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
        imageUrl="https://static.readdy.ai/image/e224f7e72060e6f454dd03772ed2f9f9/00e22a08c8c91bffb4d4897c1dd0f382.png"
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
        imageUrl="https://static.readdy.ai/image/e224f7e72060e6f454dd03772ed2f9f9/698ef6ca1ef9cb8b612105afcf45e0c4.png"
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
        imageUrl="https://static.readdy.ai/image/e224f7e72060e6f454dd03772ed2f9f9/037abbccdd29e65701c7e52e41c7649b.png"
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
        imageUrl="https://static.readdy.ai/image/e224f7e72060e6f454dd03772ed2f9f9/d34dcd844cc13206ef636387c0d2c60c.png"
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
        imageUrl="https://static.readdy.ai/image/e224f7e72060e6f454dd03772ed2f9f9/380788c2eefdeec83ae8e7348973e76f.png"
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
        imageUrl="https://static.readdy.ai/image/e224f7e72060e6f454dd03772ed2f9f9/92fd366464141c8ebb1faf9c6bc2d87b.png"
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
        actionLabel="시작하기"
        onAction={handleStart}
      >
        <p>지금은 목적 선택과 프로필 준비까지.<br />사람 연결은 준비 중입니다.</p>
        <OriginalMusicCard />
      </LandingSection>
      </div>
      <footer className="doit-brand-legal">
        <details><summary>DO IT COMPANY · 사업자 정보</summary><p>두잇(DO IT) · 대표 박진욱</p><p>사업자등록번호 121-46-51503 · 통신판매업 신고 제 2026-다산-0583호</p><p>경기도 남양주시 강변북로632번길 41-7, 102동 101호(수석동)</p></details>
        <a href="mailto:0423doit@gmail.com">문의 · 0423doit@gmail.com</a>
      </footer>
    </main>
  );
}
