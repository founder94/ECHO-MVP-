import AnimatedSection from '@/components/AnimatedSection';

export default function FounderMessageSection() {
  return (
    <section id="founder-message" className="relative w-full py-16 md:py-28">
      <div className="max-w-lg mx-auto px-6 md:px-8 text-center">
        {/* Title */}
        <AnimatedSection direction="up" distance={24}>
          <h2 className="text-base md:text-lg font-bold text-white mb-10 md:mb-14 tracking-wide">
            대표 인사말
          </h2>
        </AnimatedSection>

        {/* Message body */}
        <AnimatedSection direction="up" distance={30} delay={100}>
          <div className="text-sm md:text-[15px] text-white/80 font-medium leading-loose space-y-6 mb-14">
            <p>
              ECHO는 제가 직접 겪은 경험에서 시작됐습니다.
            </p>

            <p>
              생각은 많은데 정작 제 마음이 왜 이런지 설명하기 어려웠고,
              AI를 오랫동안 사용하면서도 같은 이야기를 다시 설명하거나,
              제가 &ldquo;그게 아니에요&rdquo;라고 정정한 내용이 제대로 반영되지 않는 경험을 반복했습니다.
            </p>

            <p className="text-white/90 font-semibold">
              그때 생각했습니다.
              <br />
              AI가 나를 대신 판단하는 게 아니라, 내가 나를 이해할 수 있게 도와주면 어떨까.
            </p>

            <p>
              그래서 ECHO는 &ldquo;오늘 내 마음의 날씨는 어때?&rdquo;라는 가벼운 질문에서 시작합니다.
              마음은 설명하기 어려워도, 날씨 하나는 고를 수 있으니까요.
            </p>

            <p>
              그날의 마음날씨에서 이야기를 시작하고, ECHO가 잘못 이해하면 내가 직접 고칩니다.
              그렇게 대화를 이어가며 오늘의 나를 조금씩 알아가고,
              그날의 이야기와 노래 한 곡을 함께 기록합니다.
            </p>

            <p className="text-white/85">
              시간이 지나 그 기록을 다시 열었을 때
              <br />
              &ldquo;그때 나는 이런 마음이었구나.&rdquo;
              <br />
              하고 과거의 나까지 돌아볼 수 있었으면 합니다.
            </p>

            <p>
              ECHO가 사람을 정의하거나 정답을 내려주는 AI가 되기를 원하지 않습니다.
            </p>

            <p className="text-white/90 font-semibold leading-snug">
              나를 판단하는 AI가 아니라,
              <br />
              내가 나를 알아가게 하는 AI.
            </p>

            <p className="text-white/80">
              그리고 언젠가 ECHO를 사용한 사람이 스스로
              <br />
              &ldquo;아, 내가 이래서 그랬구나.&rdquo;
              <br />
              라고 느낄 수 있기를 바랍니다.
            </p>
          </div>
        </AnimatedSection>

        {/* Closing phrase */}
        <AnimatedSection direction="up" distance={24} delay={200}>
          <p className="text-base md:text-lg font-bold text-white mb-8">
            내 마음을 알면, 내가 보인다.
          </p>

          {/* Signature */}
          <div className="pt-6 border-t border-white/20">
            <p className="text-sm text-white/70 font-medium">
              박진욱
            </p>
            <p className="text-xs text-white/50 mt-1">
              DO IT COMPANY / ECHO
            </p>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}