import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TarotFlow from './components/TarotFlow';
import ConversationFlow from './components/ConversationFlow';
import { SERIF, SPACE_BG } from './cardArt';

type Step = 'entry' | 'saju' | 'taro' | 'conversation' | 'complete';

export default function FortunePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialMode = params.get('mode');
  const [step, setStep] = useState<Step>(
    initialMode === 'saju' ? 'saju' : initialMode === 'taro' ? 'taro' : 'entry',
  );

  const exit = () => navigate('/do-it/landing');

  if (step === 'taro') {
    return (
      <TarotFlow onComplete={() => setStep('conversation')} onExit={exit} onBack={() => setStep('entry')} />
    );
  }
  if (step === 'conversation') {
    return <ConversationFlow onComplete={() => setStep('complete')} onBack={() => setStep('taro')} />;
  }
  if (step === 'complete') {
    return <CompleteGate onExit={exit} />;
  }
  if (step === 'saju') {
    return <SajuPrepare onBack={() => setStep('entry')} onTaro={() => setStep('taro')} onExit={exit} />;
  }
  return <Entry onSaju={() => setStep('saju')} onTaro={() => setStep('taro')} onExit={exit} />;
}

function Entry({
  onSaju,
  onTaro,
  onExit,
}: {
  onSaju: () => void;
  onTaro: () => void;
  onExit: () => void;
}) {
  return (
    <div className="min-h-screen overflow-x-hidden" style={SPACE_BG}>
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-6">
        <p className="pt-8 text-[11px] tracking-[.22em] text-[#6B7280]">DO IT · 무료 콘텐츠</p>
        <h1 className="mt-4 text-[30px] leading-[1.22] text-[#F5F3EF]" style={{ fontFamily: SERIF }}>
          오늘의 나를
          <br />
          먼저 만나볼까요?
        </h1>
        <p className="mt-3 text-[14.5px] leading-7 text-[#9CA3AF]">
          부담 없이 사주 또는 타로를 골라보세요. 기본 결과는 무료이며, 사람 연결은 나중에 직접
          선택할 수 있어요.
        </p>

        <div className="mt-7 flex flex-1 flex-col gap-4">
          <button
            type="button"
            onClick={onSaju}
            className="w-full rounded-2xl border border-white/10 bg-[#14161D] p-6 text-left transition-colors hover:bg-white/5"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#C9A24B]/15 text-[#C9A24B]">
              <i className="ri-sun-line text-2xl" />
            </span>
            <p className="mt-4 text-[11px] tracking-[.18em] text-[#6B7280]">FREE · 사주</p>
            <p className="mt-1.5 text-[22px] text-[#F5F3EF]" style={{ fontFamily: SERIF }}>
              무료 사주
            </p>
            <p className="mt-2 text-[13.5px] leading-6 text-[#9CA3AF]">
              태어난 시간을 바탕으로 지금의 흐름을 살펴봐요.
            </p>
          </button>

          <button
            type="button"
            onClick={onTaro}
            className="w-full rounded-2xl border border-white/10 bg-[#14161D] p-6 text-left transition-colors hover:bg-white/5"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#C9A24B]/15 text-[#C9A24B]">
              <i className="ri-sparkling-2-line text-2xl" />
            </span>
            <p className="mt-4 text-[11px] tracking-[.18em] text-[#6B7280]">FREE · 타로</p>
            <p className="mt-1.5 text-[22px] text-[#F5F3EF]" style={{ fontFamily: SERIF }}>
              무료 타로
            </p>
            <p className="mt-2 text-[13.5px] leading-6 text-[#9CA3AF]">
              지금 마음에 가장 가까운 카드를 골라봐요.
            </p>
          </button>
        </div>

        <button
          type="button"
          onClick={onExit}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/15 text-sm text-[#9CA3AF] transition-colors hover:bg-white/5"
        >
          뒤로가기
        </button>
        <p className="py-4 text-center text-xs leading-6 text-[#6B7280]">
          사주·타로만 보고 종료해도 괜찮아요.
        </p>
      </div>
    </div>
  );
}

function SajuPrepare({
  onBack,
  onTaro,
  onExit,
}: {
  onBack: () => void;
  onTaro: () => void;
  onExit: () => void;
}) {
  return (
    <div className="min-h-screen overflow-x-hidden" style={SPACE_BG}>
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-6">
        <button
          type="button"
          onClick={onBack}
          aria-label="뒤로"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-[#F5F3EF] transition-colors hover:bg-white/10"
        >
          <i className="ri-arrow-left-line text-lg" />
        </button>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#C9A24B]/15 text-[#C9A24B]">
            <i className="ri-sun-line text-3xl" />
          </span>
          <h1 className="mt-6 text-[26px] leading-[1.3] text-[#F5F3EF]" style={{ fontFamily: SERIF }}>
            사주는 준비 중이에요
          </h1>
          <p className="mt-3 max-w-xs text-sm leading-6 text-[#9CA3AF]">
            정확한 명식(천간·지지·오행) 계산은 실제 사주 엔진이 서버에 연결된 뒤 제공돼요. 가짜
            결과로 채우지 않습니다.
          </p>
          <div className="mt-6 w-full rounded-2xl border border-white/10 bg-[#14161D] p-4 text-left text-[13px] leading-6 text-[#9CA3AF]">
            <p className="font-medium text-[#F5F3EF]">준비되면 제공될 내용</p>
            <ul className="mt-2 space-y-1.5">
              <li className="flex items-start gap-2">
                <i className="ri-check-line mt-1 text-[#C9A24B]" /> 시주·일주·월주·년주 명식
              </li>
              <li className="flex items-start gap-2">
                <i className="ri-check-line mt-1 text-[#C9A24B]" /> 오행의 흐름(점수가 아닌 흐름)
              </li>
              <li className="flex items-start gap-2">
                <i className="ri-check-line mt-1 text-[#C9A24B]" /> 미래·건강·법률을 단정하지 않는 참고 해석
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onTaro}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#C9A24B] text-[15px] font-medium text-[#0A0B0F] transition-opacity hover:opacity-90"
          >
            타로로 시작할래요
          </button>
          <button
            type="button"
            onClick={onExit}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/15 text-sm text-[#9CA3AF] transition-colors hover:bg-white/5"
          >
            오늘은 여기까지만 볼게요
          </button>
        </div>
      </div>
    </div>
  );
}

function CompleteGate({ onExit }: { onExit: () => void }) {
  return (
    <div className="min-h-screen overflow-x-hidden" style={SPACE_BG}>
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#C9A24B]/15 text-[#C9A24B]">
          <i className="ri-moon-clear-line text-3xl" />
        </span>
        <h1 className="mt-6 text-[26px] leading-[1.3] text-[#F5F3EF]" style={{ fontFamily: SERIF }}>
          오늘의 탐색을 마쳤어요
        </h1>
        <p className="mt-3 max-w-xs text-sm leading-6 text-[#9CA3AF]">
          지금까지의 대화는 오늘의 탐색 맥락으로만 쓰였어요. 실제 사람 연결·프로필·목적 매칭은
          서버·정책 연결이 완료된 뒤에 열립니다.
        </p>
        <div className="mt-6 w-full rounded-2xl border border-white/10 bg-[#14161D] p-4 text-left text-[13px] leading-6 text-[#9CA3AF]">
          <p className="font-medium text-[#F5F3EF]">다음 단계는 서버 준비 중</p>
          <p className="mt-2">
            연결 목적 선택, 프로필 등록, 자동 탐색, 아침 결과는 서버가 연결된 뒤 제공돼요. 지금은
            가짜 결과를 보여주지 않습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="mt-8 flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#C9A24B] text-[15px] font-medium text-[#0A0B0F] transition-opacity hover:opacity-90"
        >
          DO IT 홈으로
        </button>
      </div>
    </div>
  );
}