import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { entryPathForMode, getAppMode, setAppMode, type AppMode } from '@/lib/echo/appMode';

// DO IT 카드와 '둘 다' 카드의 우주 영역에 쓰는 /do-it/hero 실제 배경 이미지(신규 생성·업로드 없음)
const SPACE_BG =
  'https://static.readdy.ai/image/e224f7e72060e6f454dd03772ed2f9f9/13671aa19a69b4691aed85321f7a5dbc.png';

const DARK = '#0c1526';

function SelectedMark({ dark }: { dark?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
        dark ? 'bg-[#0c1526] text-white' : 'bg-white text-[#0c1526]'
      }`}
    >
      <i className="ri-check-line text-[12px]" />
      선택됨
    </span>
  );
}

export default function StartPage() {
  const navigate = useNavigate();
  const navLock = useRef(false);
  const [selected, setSelected] = useState<AppMode | null>(() => getAppMode());

  const choose = (mode: AppMode) => {
    if (navLock.current) return;
    navLock.current = true;
    setSelected(mode);
    setAppMode(mode);
    const path = entryPathForMode(mode);
    // echo·both 는 /weather 로, doit 는 /do-it/intro(1%→100% 온보딩) 로. echo·both 에만 위치 자동 확인 상태를 넘긴다.
    navigate(path, mode === 'doit' ? undefined : { state: { fromCta: true } });
  };

  return (
    <section className="relative w-full echo-min-h-viewport overflow-hidden">
      {/* 배경: B구조 파스텔 */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, #f2f7f1 0%, #fbf9f3 45%, #f3f2f7 100%)' }}
      />
      {/* 파스텔 블롭(장식) */}
      <div className="absolute -top-24 -left-20 w-72 h-72 rounded-full opacity-70 pointer-events-none" style={{ background: 'rgba(160,255,200,0.35)', filter: 'blur(90px)' }} />
      <div className="absolute top-1/3 -right-24 w-80 h-80 rounded-full opacity-70 pointer-events-none" style={{ background: 'rgba(185,240,205,0.4)', filter: 'blur(90px)' }} />
      <div className="absolute -bottom-24 left-1/4 w-72 h-72 rounded-full opacity-70 pointer-events-none" style={{ background: 'rgba(255,230,170,0.35)', filter: 'blur(90px)' }} />

      <div className="relative z-10 w-full max-w-md mx-auto px-4 pt-[calc(env(safe-area-inset-top)+40px)] pb-[calc(env(safe-area-inset-bottom)+40px)]">
        {/* 헤더 */}
        <div className="text-center mb-6">
          <h1 className="text-[24px] md:text-[28px] leading-snug font-bold" style={{ color: DARK }}>
            오늘, 나는 어디서 시작할까?
          </h1>
          <p className="mt-2 text-[14px]" style={{ color: 'rgba(12,21,38,0.6)' }}>
            지금 나에게 필요한 길을 골라주세요.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {/* ECHO 카드 — 파스텔 배경 + 짙은 글자 */}
          <button
            type="button"
            onClick={() => choose('echo')}
            aria-pressed={selected === 'echo'}
            className="relative w-full text-left rounded-[20px] p-[18px] min-h-[112px] cursor-pointer transition-all duration-200 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c1526]/40 focus-visible:ring-offset-2"
            style={{
              background: 'linear-gradient(135deg, #e6f5ec 0%, #f2faf4 55%, #edf6ef 100%)',
              border: selected === 'echo' ? '1.5px solid #0c1526' : '1px solid rgba(12,21,38,0.08)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10.5px] tracking-[0.3em] font-semibold" style={{ color: 'rgba(12,21,38,0.55)' }}>
                ECHO만
              </span>
              {selected === 'echo' && <SelectedMark dark />}
            </div>
            <h2 className="text-[17px] font-bold mb-1.5" style={{ color: DARK }}>
              나를 먼저 이해하기
            </h2>
            <p className="text-[13.5px] leading-relaxed mb-3" style={{ color: 'rgba(12,21,38,0.72)' }}>
              실제 날씨로 시작해 AI와 대화하며
              <br />
              내 감정과 생각을 차근차근 알아가요.
            </p>
            <span className="inline-flex items-center gap-1 text-[14px] font-semibold" style={{ color: DARK }}>
              ECHO 시작하기
              <i className="ri-arrow-right-line" />
            </span>
            <p
              className="mt-3 pt-3 border-t text-[11px] leading-relaxed"
              style={{ borderColor: 'rgba(12,21,38,0.1)', color: 'rgba(12,21,38,0.52)' }}
            >
              위치는 현재 날씨를 확인할 때만 사용하며 저장하지 않아요.
            </p>
          </button>

          {/* DO IT 카드 — 우주 배경 + 흰 글자 */}
          <button
            type="button"
            onClick={() => choose('doit')}
            aria-pressed={selected === 'doit'}
            className="relative w-full text-left rounded-[20px] p-[18px] min-h-[112px] overflow-hidden cursor-pointer transition-all duration-200 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c1526]"
            style={{ border: selected === 'doit' ? '1.5px solid #ffffff' : '1px solid rgba(255,255,255,0.15)' }}
          >
            <div
              className="absolute inset-0"
              style={{ backgroundImage: `url(${SPACE_BG})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(180deg, rgba(6,10,22,0.55) 0%, rgba(6,10,22,0.74) 100%)' }}
            />
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10.5px] tracking-[0.3em] font-semibold text-white/70">DO IT만</span>
                {selected === 'doit' && <SelectedMark />}
              </div>
              <h2 className="text-[17px] font-bold text-white mb-1.5">다음 행동과 연결 준비하기</h2>
              <p className="text-[13.5px] leading-relaxed text-white/80 mb-3">
                내가 원하는 방향을 정하고,
                <br />
                부담 없이 다음 행동과 연결을 준비해요.
              </p>
              <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-white">
                DO IT 시작하기
                <i className="ri-arrow-right-line" />
              </span>
            </div>
          </button>

          {/* 둘 다 카드 — 파스텔/우주 두 영역으로 명확히 구분 */}
          <button
            type="button"
            onClick={() => choose('both')}
            aria-pressed={selected === 'both'}
            className="relative w-full text-left rounded-[20px] overflow-hidden cursor-pointer transition-all duration-200 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c1526]/40 focus-visible:ring-offset-2"
            style={{ border: selected === 'both' ? '1.5px solid #0c1526' : '1px solid rgba(12,21,38,0.08)' }}
          >
            {/* 위: 파스텔 영역 */}
            <div className="p-[18px]" style={{ background: 'linear-gradient(135deg, #e9f5ee 0%, #f2f8ee 60%, #f6f4ec 100%)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10.5px] tracking-[0.3em] font-semibold" style={{ color: 'rgba(12,21,38,0.55)' }}>
                  ECHO + DO IT
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap"
                    style={{ background: 'rgba(12,21,38,0.08)', color: DARK }}
                  >
                    추천 여정
                  </span>
                  {selected === 'both' && <SelectedMark dark />}
                </span>
              </div>
              <h2 className="text-[17px] font-bold mb-1.5" style={{ color: DARK }}>
                나를 이해하고 다음으로 나아가기
              </h2>
              <p className="text-[13.5px] leading-relaxed mb-3" style={{ color: 'rgba(12,21,38,0.72)' }}>
                ECHO에서 나를 먼저 이해한 뒤,
                <br />
                DO IT에서 다음 행동과 연결을 준비해요.
              </p>
              <span className="inline-flex items-center gap-1 text-[14px] font-semibold" style={{ color: DARK }}>
                둘 다 시작하기
                <i className="ri-arrow-right-line" />
              </span>
            </div>
            {/* 아래: 우주 영역 */}
            <div
              className="relative h-16"
              style={{ backgroundImage: `url(${SPACE_BG})`, backgroundSize: 'cover', backgroundPosition: 'center 30%' }}
            >
              <div className="absolute inset-0" style={{ background: 'rgba(6,10,22,0.45)' }} />
              <div className="relative h-full flex items-center justify-center">
                <span className="text-[11px] tracking-[0.3em] text-white/85 font-semibold">DO IT</span>
              </div>
            </div>
          </button>
        </div>

        {/* 푸터 안내 */}
        <p className="mt-6 text-center text-[12.5px] leading-relaxed" style={{ color: 'rgba(12,21,38,0.55)' }}>
          어떤 길을 골라도 모든 단계는
          <br />
          내가 직접 확인하며 진행해요.
        </p>
      </div>
    </section>
  );
}