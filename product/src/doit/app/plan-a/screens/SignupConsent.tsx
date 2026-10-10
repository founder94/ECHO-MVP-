import DoItSymbol from '@/components/DoItSymbol';
import '@/doit/components/feature/core-conversation.css';

interface Props { onNext: () => void }

// 이용 안내 화면이다. 법률 동의나 본인 인증이 저장됐다고 표시하지 않는다.
export function SignupConsent({ onNext }: Props) {
  return <section className="echo-dialogue echo-dialogue--pastel">
    <DoItSymbol decorative />
    <p className="echo-eyebrow">처음 오셨나요</p>
    {/* 2026-10-05 대표 「사람냄새나게」 · 디자인 기준 §6 ② 문구. 이 화면은 안내만 한다 — 동의·인증을 저장하지 않는다(아래 작은 글). */}
    {/* 2026-10-10 대표 「모바일웹 전부 최종 후킹」: 첫 화면 제목 = 확정 후킹(2026-10-09 ECHO 모바일 · 2026-10-10 MVP 「첫 화면 핵심 문구 유지」).
        자동 연결로 읽히지 않게 「서로 선택했을 때」를 바로 붙인다(2026-10-10 MVP §3). 예전 인사 문장은 안내 첫 줄로 남긴다(사람 냄새). */}
    <h1>당신이 잠든 사이<br />AI가 먼저 만나봅니다</h1>
    <p className="echo-lead">당신의 이야기를 바탕으로 ECHO Agent가 만남의 가능성을 먼저 살펴봐요. 연결은 두 사람이 서로 선택했을 때 시작돼요.</p>
    <p className="echo-lead">반가워요. 로그인해 두면 내 이야기와 사진이 계정에 남아요. 다음에 와도 처음부터 쓰지 않아도 돼요.</p>
    {/* 2026-10-05 PM 보강(Codex echo-spec 20261005-plan-a-pm-retention P2): 전화 인증은 연결 자격이 아니다(doit-connect loadMembers missing = 목적·답·사진·소개 · 2026-09-27 P0-1) → 「전화 인증까지 마치면」 삭제 · 후보 보장 말 0.
        Codex PR #131 4183640424 · 대표 「글은 완성」: 첫 문장은 QA 그대로 · 사실과 다른 두 번째 문장만 바로잡음 */}
    <div className="echo-original"><p className="echo-eyebrow">지금 이용할 수 있는 범위</p><p>원하는 관계를 고르고, 다섯 가지 질문에 답하고, 사진과 소개를 준비해요. 준비를 마치면 지금 보여 드릴 사람이 있는지 확인할 수 있어요.</p></div>
    <p className="echo-fine">계속하려면 약관을 확인해 주세요. 동의는 다음 화면(가입·로그인)에서 받아요. 이 화면에서 누른 것은 동의나 본인 인증으로 저장되지 않아요.</p>
    <button className="echo-primary" onClick={onNext}>내 이야기 시작하기 <span aria-hidden="true" className="echo-flora-arrow">↗</span></button>
  </section>;
}
