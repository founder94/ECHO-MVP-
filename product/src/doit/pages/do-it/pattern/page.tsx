import { useState } from 'react';
import MobileLayout from '@/doit/components/feature/MobileLayout';
import Card from '@/doit/components/base/Card';
import Button from '@/doit/components/base/Button';
import InsightCard from '@/doit/components/feature/InsightCard';
import { useUnderstanding, type EntryStatus, type Insight } from '@/doit/hooks/useUnderstanding';

export default function Pattern() {
  const { records, insights, addInsight, updateInsight } = useUnderstanding();

  const confirmedRecords = records.filter((r) => r.status !== 'rejected');
  const patterns = insights.filter((i) => i.category === 'pattern');

  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState('');
  const [sourceId, setSourceId] = useState<string>('');
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

  const addSelfPattern = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setBusy(true);
    setSaveError(null);
    try {
      await addInsight({
        category: 'pattern',
        text: trimmed,
        sourceRecordId: sourceId || undefined,
      });
      setInput('');
      setSourceId('');
      setAdding(false);
    } catch (e) {
      setSaveError(
        e instanceof Error && e.message ? e.message : '저장에 실패했어요. 다시 시도해 주세요.',
      );
    } finally {
      setBusy(false);
    }
  };

  // 근거 부족: 확정 기록이 하나도 없으면 AI가 판단할 근거 자체가 없다.
  const insufficient = confirmedRecords.length === 0;

  return (
    <MobileLayout title="패턴" back>
      <div className="animate-fade-up pt-4">
        <div className="mb-4">
          <h1 className="font-heading text-xl font-semibold text-foreground-950">
            반복해서 나타난 나의 선택
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground-500">
            여러 기록에서 반복되는 경향을 살펴봐요. 판단이나 진단이 아니라, 내가 확인한 경향만
            남겨요.
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

        {/* 근거 부족 안내 */}
        {insufficient && (
          <Card padding="md" className="mb-4 bg-background-100">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background-200 text-foreground-500">
                <i className="ri-hourglass-line text-lg" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground-900">
                  아직 판단할 기록이 충분하지 않아요
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-foreground-500">
                  확인한 기록이 쌓이면 반복되는 경향을 후보로 제안해 드려요. 몇 건부터 판단할지는
                  기준이 확정되기 전이라 임의로 정하지 않아요.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* 직접 입력 */}
        {adding ? (
          <Card padding="md" className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-foreground-800">
              내가 느낀 반복되는 경향
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
              rows={3}
              autoFocus
              placeholder="예를 들어, 비슷한 상황에서 반복해서 했던 선택이나 느낌을 적어보세요."
              className="w-full resize-none rounded-xl border border-background-300 bg-background-50 px-3 py-2 text-sm leading-relaxed text-foreground-900 outline-none transition-colors focus:border-primary-400"
            />
            <p className="mb-3 mt-1 text-right text-[11px] text-foreground-400">{input.length}/500</p>

            {confirmedRecords.length > 0 && (
              <div className="mb-3">
                <p className="mb-1.5 text-xs font-medium text-foreground-500">
                  근거가 되는 기록 선택(선택)
                </p>
                <div className="flex flex-col gap-1.5">
                  {confirmedRecords.slice(0, 3).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSourceId(sourceId === r.id ? '' : r.id)}
                      className={`rounded-xl border px-3 py-2 text-left text-xs leading-relaxed transition-colors ${
                        sourceId === r.id
                          ? 'border-primary-400 bg-primary-50 text-foreground-900'
                          : 'border-background-200 bg-background-50 text-foreground-600 hover:bg-background-100'
                      }`}
                    >
                      {r.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button full size="sm" disabled={!input.trim() || busy} onClick={addSelfPattern}>
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
            내가 느낀 경향 직접 입력
          </Button>
        )}

        {/* 목록 */}
        {patterns.length === 0 ? (
          <Card padding="lg" className="text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-background-200 text-foreground-400">
              <i className="ri-pulse-line text-xl" />
            </span>
            <p className="text-sm text-foreground-500">아직 확인한 패턴이 없어요.</p>
            <p className="mt-1 text-xs leading-relaxed text-foreground-400">
              확인 전에는 프로필이나 매칭 데이터로 쓰지 않아요.
            </p>
          </Card>
        ) : (
          <>
            {patterns.map((p) => (
              <InsightCard
                key={p.id}
                insight={p}
                onConfirm={() => setStatus(p, 'confirmed')}
                onCorrect={(text) => setStatus(p, 'corrected', text)}
                onReject={() => setStatus(p, 'rejected')}
              />
            ))}
            <p className="text-center text-[11px] leading-relaxed text-foreground-400">
              의료·심리 진단이 아니라, 내가 직접 확인한 경향만 남겨요.
            </p>
          </>
        )}
      </div>
    </MobileLayout>
  );
}