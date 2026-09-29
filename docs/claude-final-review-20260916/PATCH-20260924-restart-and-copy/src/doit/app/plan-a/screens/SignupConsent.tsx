import DoItSymbol from '@/components/DoItSymbol';
import '@/doit/components/feature/core-conversation.css';

interface Props { onNext: () => void }

// 이용 안내 화면이다. 법률 동의나 본인 인증이 저장됐다고 표시하지 않는다.
export function SignupConsent({ onNext }: Props) {
  return <section className="echo-dialogue">
    <DoItSymbol decorative />
    <p className="echo-eyebrow">내 계정으로 이어가기</p>
    <h1>다음에 와도,<br />처음부터 쓰지 않도록.</h1>
    <p className="echo-lead">내 소개와 사진을 계정에 보관하고, 지금의 나에 맞게 다시 고칠 수 있어요.</p>
    <div className="echo-original"><p className="echo-eyebrow">지금 이용할 수 있는 범위</p><p>원하는 관계를 고르고, 다섯 가지 질문에 답하고, 사진과 소개를 준비해요. 전화 인증까지 마치면 연결을 받을 수 있어요.</p></div>
    <p className="echo-fine">이용약관과 개인정보 처리방침 동의는 가입·로그인 때 따로 받아요. 이 화면의 확인을 법률 동의나 본인 인증 완료로 처리하지 않아요.</p>
    <button className="echo-primary" onClick={onNext}>내 계정으로 계속하기</button>
  </section>;
}
