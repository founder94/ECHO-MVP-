import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '@/doit/components/feature/MobileLayout';
import Card from '@/doit/components/base/Card';
import Button from '@/doit/components/base/Button';
import { useUnderstanding, type RecordDecision } from '@/doit/hooks/useUnderstanding';

// 확인·수정 화면. 사용자가 첫 기록을 직접 맞음/수정/거절/직접 설명으로 결정한다.
// 서버 연결 후에는 실제 저장되고, 실패하면 입력을 유지한 채 한국어 오류와 재시도를 제공한다.
type Stage = 'idle' | 'correct' | 'describe';

const DECISION_META: { key: RecordDecision; label: string; icon: string; hint: string }[] = [
  { key: 'confirmed', label: '맞아요', icon: 'ri-check-line', hint: '이 기록이 지금의 나와 맞아요.' },
  { key: 'corrected', label: '조금 달라요', icon: 'ri-pencil-line', hint: '일부 표현을 다듬고 싶어요.' },
  { key: 'rejected', label: '그게 아니에요', icon: 'ri-close-line', hint: '이 기록은 나와 맞지 않아요.' },
];

export default function Review() {
  const navigate = useNavigate();
  const { draft, submitRecord } = useUnderstanding();

  const [stage, setStage] = useState<Stage>('idle');
  const [editText, setEditText] = useState<string>(() => draft?.text ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasDraft = !!draft && draft.text.trim().length > 0;

  if (!hasDraft) {
    return (
      <MobileLayout title="확인·수정" back>
        <div className="animate-fade-up pt-8">
          <Card padding="lg" className="text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-background-200 text-foreground-400">
              <i className="ri-file-list-3-line text-xl" />
            </span>
            <p className="text-sm text-foreground-500">확인할 기록이 없어요.</p>
            <Button full className="mt-4" onClick={() => navigate('/doit/first-record')}>
              첫 기록 만들기
            </Button>
          </Card>
        </div>
      </MobileLayout>
    );
  }

  const original = draft!.text;

  const doSubmit = async (decision: RecordDecision, correctedText?: string) => {
    setSaving(true);
    setSaveError(null);
    try {
      await submitRecord(decision, correctedText);
      navigate('/doit/home');
    } catch (e) {
      // 실패해도 입력을 유지하고, 오류를 보여주며 재시도할 수 있게 한다.
      setSaveError(
        e instanceof Error && e.message ? e.message : '저장에 실패했어요. 다시 시도해 주세요.',
      );
    } finally {
      setSaving(false);
    }
  };

  const decide = async (decision: RecordDecision) => {
    if (decision === 'confirmed' || decision === 'rejected') {
      await doSubmit(decision);
      return;
    }
    setEditText(original);
    setStage('correct');
  };

  const startDescribe = () => {
    setEditText('');
    setStage('describe');
  };

  const commitCorrected = async () => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    await doSubmit('corrected', trimmed);
  };

  return (
    <MobileLayout title="확인·수정" back>
      <div className="animate-fade-up pt-4">
        {/* 문구 */}
        <div className="mb-4 text-center">
          <h1 className="font-heading text-xl font-semibold text-foreground-950">
            이 기록이 지금의 나와 맞나요?
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-foreground-500">
            내가 직접 맞는지 정해요. 확인한 내용만 내 기록으로 남아요.
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

        {stage === 'idle' && (
          <>
            {/* 기록 원문(후보) */}
            <Card padding="md" className="mb-4 bg-primary-50 border-primary-200">
              <div className="mb-2 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-primary-100 px-2.5 py-1 text-xs font-medium text-primary-800">
                  <i className="ri-sparkling-2-line text-sm" />
                  기록 후보
                </span>
                {draft!.emotion && (
                  <span className="text-xs text-foreground-500">{draft!.emotion} 감정</span>
                )}
              </div>
              <p className="text-sm font-medium leading-relaxed text-foreground-900">
                {original}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-foreground-500">
                내가 확인한 내용만 기록으로 남고, 그 뒤 후보를 제안해 드려요.
              </p>
            </Card>

            {/* 4가지 선택 */}
            <div className="mb-4 flex flex-col gap-2">
              {DECISION_META.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => void decide(d.key)}
                  disabled={saving}
                  className="flex items-center gap-3 rounded-2xl border border-background-200 bg-background-50 px-4 py-3.5 text-left transition-colors hover:bg-background-100 disabled:opacity-50"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      d.key === 'rejected'
                        ? 'bg-background-200 text-foreground-500'
                        : 'bg-primary-100 text-primary-700'
                    }`}
                  >
                    <i className={`${d.icon} text-lg`} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground-900">{d.label}</p>
                    <p className="text-xs text-foreground-500">{d.hint}</p>
                  </div>
                </button>
              ))}

              <button
                type="button"
                onClick={startDescribe}
                disabled={saving}
                className="flex items-center gap-3 rounded-2xl border border-background-200 bg-background-50 px-4 py-3.5 text-left transition-colors hover:bg-background-100 disabled:opacity-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                  <i className="ri-quill-pen-line text-lg" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground-900">직접 설명할게요</p>
                  <p className="text-xs text-foreground-500">
                    내 말로 다시 설명할게요. 내 설명을 최우선으로 기억해요.
                  </p>
                </div>
              </button>
            </div>
          </>
        )}

        {(stage === 'correct' || stage === 'describe') && (
          <>
            <Card padding="md" className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-foreground-800">
                {stage === 'correct' ? '어떻게 바꿔서 기록할까요?' : '내 말로 직접 설명해 주세요'}
              </label>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                maxLength={500}
                rows={5}
                autoFocus
                className="w-full resize-none rounded-xl border border-background-300 bg-background-50 px-3 py-2.5 text-sm leading-relaxed text-foreground-900 outline-none transition-colors focus:border-primary-400"
              />
              <p className="mt-1.5 text-right text-[11px] text-foreground-400">
                {editText.length}/500
              </p>
            </Card>
            <div className="flex gap-2">
              <Button
                full
                size="lg"
                disabled={!editText.trim() || saving}
                loading={saving}
                onClick={() => void commitCorrected()}
              >
                내 기록으로 남기기
              </Button>
              <Button full size="lg" variant="ghost" onClick={() => setStage('idle')}>
                취소
              </Button>
            </div>
          </>
        )}

        {stage === 'idle' && (
          <p className="text-center text-[11px] leading-relaxed text-foreground-400">
            확인한 내용만 저장되고, 서버가 저장 상태를 결정해요.
          </p>
        )}
      </div>
    </MobileLayout>
  );
}