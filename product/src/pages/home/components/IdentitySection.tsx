import { Link } from 'react-router-dom';
import AnimatedSection from '@/components/AnimatedSection';

export default function IdentitySection() {
  return (
    <section id="identity" className="relative w-full py-16 md:py-24">
      <div className="max-w-lg mx-auto px-6 text-center">
        <AnimatedSection direction="up" distance={30}>
          <h2 className="text-lg md:text-xl font-bold text-white leading-snug mb-6">
            나를 판단하는 AI가 아니라,<br />내가 나를 알아가게 하는 AI.
          </h2>
        </AnimatedSection>

        <AnimatedSection direction="up" distance={30} delay={150}>
          <p className="text-sm text-white/75 font-medium leading-relaxed mb-12 max-w-xs mx-auto">
            ECHO는 답을 정하지 않아요.<br /><br />
            내가 말하고,<br />
            ECHO가 묻고,<br />
            내가 다시 고치면서<br /><br />
            조금씩 나를 알아가요.
          </p>
        </AnimatedSection>

        {/* Final CTA */}
        <AnimatedSection direction="up" distance={20} delay={300}>
          <p className="text-sm text-white/75 font-medium mb-2">
            내 마음을 알면, 내가 보인다.
          </p>

          <p className="text-base md:text-lg font-bold text-white mb-1">
            오늘 내 마음의 날씨는 어때?
          </p>

          <p className="text-sm text-white/65 font-medium mb-8">
            마음은 설명하기 어려워도,<br />날씨는 고를 수 있으니까.
          </p>

          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full border border-white/60 text-white text-sm font-semibold hover:bg-white/15 hover:border-white/80 transition-all duration-400 cursor-pointer whitespace-nowrap"
          >
            오늘의 마음날씨 시작하기
            <i className="ri-arrow-right-s-line" />
          </Link>
        </AnimatedSection>
      </div>
    </section>
  );
}