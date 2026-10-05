import DoItSymbol from '@/components/DoItSymbol';
import '@/doit/components/feature/core-conversation.css';

interface Props { onNext: () => void }

// 이용 안내 화면이다. 법률 동의나 본인 인증이 저장됐다고 표시하지 않는다.
export function SignupConsent({ onNext }: Props) {
  return <section className="echo-dialogue echo-dialogue--pastel">
    <DoItSymbol decorative />
    <p className="echo-eyebrow">처음 오셨나요</p>
    {/* 2026-10-05 대표 「사람냄새나게」 · 디자인 기준 §6 ② 문구. 이 화면은 안내만 한다 — 동의·인증을 저장하지 않는다(아래 작은 글). */}
    <h1>반가워요.<br />ECHO를 시작해 볼까요?</h1>
    <p className="echo-lead">로그인해 두면 내 이야기와 사진이 계정에 남아요. 다음에 와도 처음부터 쓰지 않아도 돼요.</p>
    <div className="echo-original"><p className="echo-eyebrow">지금 이용할 수 있는 범위</p><p>원하는 관계를 고르고, 다섯 가지 질문에 답하고, 사진과 소개를 준비해요. 전화 인증까지 마치면 연결을 받을 수 있어요.</p></div>
    <p className="echo-fine">계속하려면 약관을 확인해 주세요. 동의는 다음 화면(가입·로그인)에서 받아요. 이 화면에서 누른 것은 동의나 본인 인증으로 저장되지 않아요.</p>
    <button className="echo-primary" onClick={onNext}>시작하기</button>
  </section>;
}
