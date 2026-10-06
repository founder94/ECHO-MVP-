import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '@/doit/components/feature/MobileLayout';
import Card from '@/doit/components/base/Card';
import Button from '@/doit/components/base/Button';
import { useUnderstanding } from '@/doit/hooks/useUnderstanding';
import { readStoryHandoff } from '@/lib/echo/storyHandoff';

// 감정 빠른 선택(3개). 정답 없음 — 지금 마음에 가까운 말을 고르는 시작점.
const EMOTIONS = [
  { id: 'calm', label: '편안해요', icon: 'ri-leaf-line' },
  { id: 'excited', label: '설레요', icon: 'ri-sun-line' },
  { id: 'heavy', label: '무거워요', icon: 'ri-cloud-line' },
];

export default function FirstRecord() {
  const navigate = useNavigate();
  const { draft, setDraft } = useUnderstanding();

  // ECHO + DO IT 모드에서 ECHO 결과를 "참고 정보"로만 가져온다(확정 사실 아님).
  const handoff = readStoryHandoff();

  const [text, setText] = useState<string>(() => draft?.text ?? handoff?.mindText ?? '');
  const [emotion, setEmotion] = useState<string>(() => draft?.emotion ?? '');

  const trimmed = text.trim();
  const canSubmit = trimmed.length > 0;

  const toggleEmotion = (id: string) => {
    setEmotion((prev) => (prev === id ? '' : id));
  };

  const submit = () => {
    if (!canSubmit) return;
    setDraft({ text: trimmed, emotion });
    // 바로 저장하지 않고 화면 2(확인·수정)로 이동한다.
    navigate('/doit/review');
  };

  return (
    <MobileLayout showHeader={false}>
      <div className="animate-fade-up flex min-h-[calc(100dvh-2rem)] flex-col pt-4">
        {/* 상단 뒤로가기 */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-foreground-700 transition-colors hover:bg-background-200"
            aria-label="뒤로"
          >
            <i className="ri-arrow-left-line text-xl" />
          </button>
        </div>

        {/* 문구 */}
        <div className="mb-6 text-center">
          <h1 className="font-heading text-2xl font-semibold text-foreground-950">
            오늘의 나를 기록해볼까요?
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-foreground-500">
            정답은 없어요. 지금 떠오르는 마음부터 편하게 남겨보세요.
          </p>
        </div>

        {/* 감정 빠른 선택 */}
        <div className="mb-4 flex gap-2">
          {EMOTIONS.map((e) => {
            const active = emotion === e.id;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => toggleEmotion(e.id)}
                aria-pressed={active}
                className={`flex flex-1 flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 transition-colors ${
                  active
                    ? 'border-primary-400 bg-primary-50 text-primary-800'
                    : 'border-background-200 bg-background-50 text-foreground-600 hover:bg-background-100'
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${
                    active ? 'bg-primary-100 text-primary-700' : 'bg-background-100 text-foreground-500'
                  }`}
                >
                  <i className={`${e.icon} text-lg`} />
                </span>
                <span className="whitespace-nowrap text-xs font-medium">{e.label}</span>
              </button>
            );
          })}
        </div>

        {/* 자유 입력 */}
        <Card padding="md" className="mb-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            rows={6}
            placeholder="지금 떠오르는 감정이나 생각을 편하게 적어보세요."
            className="w-full resize-none rounded-xl border border-background-300 bg-background-50 px-3 py-2.5 text-sm leading-relaxed text-foreground-900 outline-none transition-colors focus:border-primary-400"
          />
          <p className="mt-1.5 text-right text-[11px] text-foreground-400">
            {text.length}/500
          </p>
        </Card>

        {/* 첫 기록 만들기 */}
        <Button full size="lg" disabled={!canSubmit} onClick={submit}>
          첫 기록 만들기
        </Button>

        <p className="mt-3 text-center text-[11px] leading-relaxed text-foreground-400">
          작성한 내용은 바로 저장되지 않고, 다음 화면에서 직접 확인한 뒤 기록돼요.
        </p>
      </div>
    </MobileLayout>
  );
}