import { useEffect, useRef, useState } from 'react';
import {
  useOpenAIConversation,
  type Reaction,
} from '@/doit/hooks/useOpenAIConversation';
import { SERIF, SPACE_BG } from '../cardArt';

interface Props {
  onComplete: () => void;
  onBack: () => void;
}

const REACTIONS: { key: Reaction; label: string }[] = [
  { key: 'agree', label: '맞아요' },
  { key: 'little', label: '조금 달라요' },
  { key: 'no', label: '그게 아니에요' },
  { key: 'explain', label: '직접 설명할게요' },
  { key: 'unsure', label: '모르겠어요' },
];

export default function ConversationFlow({ onComplete, onBack }: Props) {
  const {
    perspectives,
    answers,
    loading,
    error,
    maxSteps,
    start,
    generateNext,
    setAnswer,
  } = useOpenAIConversation();

  const [index, setIndex] = useState(0);
  const [showExplain, setShowExplain] = useState(false);
  const [draft, setDraft] = useState('');
  const [advancing, setAdvancing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void start();
  }, [start]);

  const perspective = perspectives[index];
  const currentAnswer = answers[index];
  const isLast = index === maxSteps - 1;
  const answered = currentAnswer?.reaction != null;
  const done = answers.slice(0, maxSteps).every((a) => a.reaction != null);

  useEffect(() => {
    setShowExplain(
      answers[index]?.reaction === 'explain' || answers[index]?.reaction === 'no',
    );
    setDraft(answers[index]?.note ?? '');
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [index, answers]);

  function setAnswerAt(patch: Partial<{ reaction: Reaction; note: string; retracted: boolean }>) {
    setAnswer(index, patch);
  }

  function handleReaction(reaction: Reaction) {
    if (reaction === 'explain') {
      setAnswerAt({ reaction: 'explain', retracted: false });
      setShowExplain(true);
      return;
    }
    if (reaction === 'no') {
      setAnswerAt({ reaction: 'no', retracted: true });
      setShowExplain(true);
      return;
    }
    setAnswerAt({ reaction, retracted: false });
    setShowExplain(false);
  }

  async function goNext() {
    if (!isLast) {
      if (perspectives.length <= index + 1) {
        setAdvancing(true);
        let generated = false;
        try {
          generated = await generateNext();
        } finally {
          setAdvancing(false);
        }
        // 2026-09-16: 다음 질문 생성에 실패하면 현재 칸에 머문다(질문 없는 칸으로 이동 금지). 오류 문구는 훅의 error 로 표시된다.
        if (!generated) return;
      }
      setIndex((i) => i + 1);
    }
  }

  const nextDisabled = !answered || advancing || loading;

  return (
    <div className="min-h-screen overflow-x-hidden" style={SPACE_BG}>
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        {/* 헤더 */}
        <div className="flex items-start gap-3 border-b border-white/10 px-5 pb-4 pt-6">
          <button
            type="button"
            onClick={() => (index > 0 ? setIndex(index - 1) : onBack())}
            aria-label="이전으로"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-[#F5F3EF] transition-colors hover:bg-white/10"
          >
            <i className="ri-arrow-left-line text-lg" />
          </button>
          <div className="flex-1">
            <p className="text-[11px] tracking-[.18em] text-[#6B7280]">AI 대화</p>
            <h2 className="text-[20px] text-[#F5F3EF]" style={{ fontFamily: SERIF }}>
              어떤 사람과 어떤 관계를 원하세요?
            </h2>
            <p className="mt-1.5 text-[11px] text-[#6B7280]">정해진 답은 없어요. 편한 말로 이야기해 주세요.</p>
          </div>
        </div>

        {/* 본문 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6">
          {error && !perspective && (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <p className="text-center text-sm leading-6 text-[#9CA3AF]">{error}</p>
              <button
                type="button"
                onClick={() => void start()}
                className="flex h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-sm text-[#F5F3EF] transition-colors hover:bg-white/5"
              >
                <i className="ri-refresh-line" />
                다시 시도
              </button>
            </div>
          )}

          {!perspective && !error && (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <i className="ri-loader-4-line animate-spin text-2xl text-[#C9A24B]" />
              <p className="text-[13px] text-[#9CA3AF]">AI가 질문을 준비하고 있어요</p>
            </div>
          )}

          {perspective && (
            <>
              {/* 진행 표시 */}
              <div className="mb-6 flex items-center gap-2">
                {Array.from({ length: maxSteps }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-full"
                    style={{
                      width: i === index ? 22 : 7,
                      height: 7,
                      backgroundColor:
                        answers[i]?.reaction != null
                          ? '#C9A24B'
                          : i === index
                            ? '#6B7280'
                            : 'rgba(255,255,255,0.15)',
                      transition: 'width .25s ease, background-color .25s ease',
                    }}
                  />
                ))}
                <span className="ml-auto text-[11px] text-[#6B7280]">
                  {index + 1} / {maxSteps}
                </span>
              </div>

              {error && (
                <div className="mb-4 rounded-xl border border-white/10 bg-[#14161D] p-4">
                  <p className="text-sm leading-6 text-[#9CA3AF]">{error}</p>
                </div>
              )}

              {/* AI 짐작 */}
              <div
                className="mb-4 rounded-2xl border p-5 transition-opacity"
                style={{
                  backgroundColor: '#14161D',
                  borderColor: currentAnswer?.retracted ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.18)',
                  opacity: currentAnswer?.retracted ? 0.55 : 1,
                }}
              >
                <p className="mb-2 text-[11px] tracking-[.1em] text-[#6B7280]">
                  {currentAnswer?.retracted ? '이건 제가 잘못 짐각했어요' : '이렇게 느껴졌어요 (확정 아니에요)'}
                </p>
                <p
                  className="text-[16px] leading-6 text-[#F5F3EF]"
                  style={{ textDecoration: currentAnswer?.retracted ? 'line-through' : 'none' }}
                >
                  {perspective.reading}
                </p>
              </div>

              <p className="mb-4 text-[14.5px] leading-6 text-[#9CA3AF]">{perspective.question}</p>

              {/* 반응 버튼 */}
              <div className="flex flex-wrap gap-2">
                {REACTIONS.map((r) => {
                  const active = currentAnswer?.reaction === r.key;
                  return (
                    <button
                      type="button"
                      key={r.key}
                      onClick={() => handleReaction(r.key)}
                      className={`flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors ${
                        active
                          ? 'border-[#C9A24B] bg-[#C9A24B] text-[#0A0B0F]'
                          : 'border-white/15 bg-[#14161D] text-[#F5F3EF] hover:bg-white/5'
                      }`}
                    >
                      {active && <i className="ri-check-line" />}
                      {r.label}
                    </button>
                  );
                })}
              </div>

              {/* 직접 설명 입력 */}
              {showExplain && (
                <div className="mt-4">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="내 생각을 편하게 적어주세요"
                    rows={3}
                    maxLength={500}
                    className="w-full resize-none rounded-xl border border-white/10 bg-[#14161D] px-4 py-3 text-sm leading-6 text-[#F5F3EF] outline-none"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setAnswerAt({ note: draft.trim() });
                        setShowExplain(false);
                      }}
                      className="flex h-10 items-center gap-1.5 rounded-full border border-white/15 px-4 text-[13px] text-[#F5F3EF] transition-colors hover:bg-white/5"
                    >
                      <i className="ri-pencil-line" />
                      이 설명으로 반영
                    </button>
                  </div>
                </div>
              )}

              {currentAnswer?.note && !showExplain && (
                <div className="mt-4 rounded-xl border border-white/15 bg-[#C9A24B]/10 p-4">
                  <p className="text-[11px] text-[#6B7280]">내가 설명한 것</p>
                  <p className="mt-1 text-[13.5px] leading-6 text-[#F5F3EF]">{currentAnswer.note}</p>
                  <button
                    type="button"
                    onClick={() => setShowExplain(true)}
                    className="mt-2 text-xs text-[#9CA3AF]"
                  >
                    수정
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* 하단 액션 */}
        <div className="flex flex-col gap-2 border-t border-white/10 px-5 pb-6 pt-4">
          {!isLast ? (
            <button
              type="button"
              onClick={goNext}
              disabled={nextDisabled}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#C9A24B] text-[15px] font-medium text-[#0A0B0F] transition-opacity disabled:opacity-40"
            >
              {advancing || loading ? 'AI가 준비 중이에요' : '다음 이야기로'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onComplete}
              disabled={!done}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#C9A24B] text-[15px] font-medium text-[#0A0B0F] transition-opacity disabled:opacity-40"
            >
              탐색 마무리하기
            </button>
          )}
          <p className="text-center text-[11.5px] leading-5 text-[#6B7280]">
            오늘 밤은 여기까지 해도 괜찮아요. 결정은 내가 합니다.
          </p>
        </div>
      </div>
    </div>
  );
}