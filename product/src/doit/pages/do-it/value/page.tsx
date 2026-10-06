import { useState } from 'react';
import MobileLayout from '@/doit/components/feature/MobileLayout';
import Card from '@/doit/components/base/Card';
import Button from '@/doit/components/base/Button';
import InsightCard from '@/doit/components/feature/InsightCard';
import { useUnderstanding, type EntryStatus, type Insight } from '@/doit/hooks/useUnderstanding';

export default function Value() {
  const { insights, addInsight, updateInsight } = useUnderstanding();

  const values = insights.filter((i) => i.category === 'value');

  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const setStatus = async (insight: Insight, status: EntryStatus, text?: string) => {
    setBusy(true);
    setSaveError(null);
    try {
      await updateInsight(
        insight.id,
        status === 'corrected' && text ? { status, text } : { status },
      );
    } catch (e) {
      setSaveError(
        e instanceof Error && e.message ? e.message : '저장에 실패했어요. 다시 시도해 주세요.',
      );
    } finally {
      setBusy(false);
    }
  };

  const addSelfValue = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setBusy(true);
    setSaveError(null);
    try {
      await addInsight({ category: 'value', text: trimmed });
      setInput('');
      setAdding(false);
    } catch (e) {
      setSaveError(
        e instanceof Error && e.message ? e.message : '저장에 실패했어요. 다시 시도해 주세요.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <MobileLayout title="가치 기준" back>
      <div className="animate-fade-up pt-4">
        <div className="mb-4">
          <h1 className="font-heading text-xl font-semibold text-foreground-950">
            나는 무엇을 중요하게 생각할까?
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground-500">
            내가 직접 설명한 기준을 가장 먼저 기억해요. AI가 제안한 가치는 확인 전까지 후보예요.
          </p>
        </div>

        {saveError && (
          <Card padding="md" className="mb-4 border-accent-300 bg-accent-100/60">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-200 text-accent-800">
                <i className="ri-error-warning-line text-sm" />
              </span>
              <p className="text-sm leading-relaxed text-foreground-800">{saveError}</p>
            </div>
          </Card>
        )}

        {/* 직접 입력 */}
        {adding ? (
          <Card padding="md" className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-foreground-800">
              내가 중요하게 생각하는 기준
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
              rows={3}
              autoFocus
              placeholder="예를 들어, 어떤 선택에서 나에게 가장 중요한 것이 무엇인지 적어보세요."
              className="w-full resize-none rounded-xl border border-background-300 bg-background-50 px-3 py-2 text-sm leading-relaxed text-foreground-900 outline-none transition-colors focus:border-primary-400"
            />
            <p className="mb-3 mt-1 text-right text-[11px] text-foreground-400">{input.length}/500</p>
            <div className="flex gap-2">
              <Button full size="sm" disabled={!input.trim() || busy} onClick={addSelfValue}>
                추가하기
              </Button>
              <Button full size="sm" variant="ghost" onClick={() => setAdding(false)}>
                취소
              </Button>
            </div>
          </Card>
        ) : (
          <Button full variant="secondary" className="mb-4" onClick={() => setAdding(true)}>
            <i className="ri-add-line text-base" />
            내 가치 기준 직접 입력
          </Button>
        )}

        {/* 목록 */}
        {values.length === 0 ? (
          <Card padding="lg" className="text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-background-200 text-foreground-400">
              <i className="ri-focus-3-line text-xl" />
            </span>
            <p className="text-sm text-foreground-500">아직 확인한 가치 기준이 없어요.</p>
            <p className="mt-1 text-xs leading-relaxed text-foreground-400">
              AI 후보는 서버 연결 후 제공되고, 지금은 내 기준을 직접 입력할 수 있어요.
            </p>
          </Card>
        ) : (
          <>
            {values.map((v) => (
              <InsightCard
                key={v.id}
                insight={v}
                onConfirm={() => setStatus(v, 'confirmed')}
                onCorrect={(text) => setStatus(v, 'corrected', text)}
                onReject={() => setStatus(v, 'rejected')}
              />
            ))}
            <p className="text-center text-[11px] leading-relaxed text-foreground-400">
              거절한 가치는 반복 추천되지 않도록 선택 기억에 남겨둬요.
            </p>
          </>
        )}
      </div>
    </MobileLayout>
  );
}