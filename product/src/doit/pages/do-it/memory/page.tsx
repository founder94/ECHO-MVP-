import { useState } from 'react';
import MobileLayout from '@/doit/components/feature/MobileLayout';
import Card from '@/doit/components/base/Card';
import Button from '@/doit/components/base/Button';
import InsightCard from '@/doit/components/feature/InsightCard';
import { useUnderstanding, type EntryStatus, type Insight } from '@/doit/hooks/useUnderstanding';

interface Bucket {
  key: string;
  label: string;
  icon: string;
}

// 우선순위: 직접 설명 > 수정 > 확인(AI) > 미확정 후보. 거절은 하단에 차단 목록으로.
const BUCKETS: Bucket[] = [
  { key: 'self', label: '내가 직접 설명한 내용', icon: 'ri-quill-pen-line' },
  { key: 'corrected', label: '내가 수정한 내용', icon: 'ri-pencil-line' },
  { key: 'confirmed', label: '내가 맞다고 확인한 내용', icon: 'ri-check-line' },
  { key: 'candidate', label: '미확정 AI 후보', icon: 'ri-sparkling-2-line' },
];

export default function Memory() {
  const { insights, updateInsight } = useUnderstanding();
  const [ctaOpen, setCtaOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const setStatus = async (insight: Insight, status: EntryStatus, text?: string) => {
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
    }
  };

  const pick = (insight: Insight): Bucket['key'] | 'rejected' => {
    if (insight.status === 'rejected') return 'rejected';
    if (insight.origin === 'self') return 'self';
    if (insight.status === 'corrected') return 'corrected';
    if (insight.status === 'confirmed') return 'confirmed';
    return 'candidate';
  };

  const rejected = insights.filter((i) => i.status === 'rejected');
  const hasAny = insights.length > 0;

  return (
    <MobileLayout title="선택 기억" back>
      <div className="animate-fade-up pt-4">
        <div className="mb-4">
          <h1 className="font-heading text-xl font-semibold text-foreground-950">
            내가 확인한 나를 기억할게요.
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground-500">
            지금까지 내가 맞다고 하거나 수정·거절한 내용을 직접 보고 관리해요.
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

        {!hasAny ? (
          <Card padding="lg" className="text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-background-200 text-foreground-400">
              <i className="ri-bookmark-3-line text-xl" />
            </span>
            <p className="text-sm text-foreground-500">아직 기억에 남긴 내용이 없어요.</p>
            <p className="mt-1 text-xs leading-relaxed text-foreground-400">
              가치 기준과 패턴에서 확인·수정한 내용이 여기에 모여요.
            </p>
            <Button full className="mt-4" to="/doit/value">
              가치 기준 보러 가기
            </Button>
          </Card>
        ) : (
          <>
            {BUCKETS.map((bucket) => {
              const items = insights.filter((i) => pick(i) === bucket.key);
              if (items.length === 0) return null;
              return (
                <div key={bucket.key} className="mb-5">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-background-100 text-foreground-600">
                      <i className={`${bucket.icon} text-sm`} />
                    </span>
                    <h2 className="font-heading text-sm font-semibold text-foreground-900">
                      {bucket.label}
                    </h2>
                    <span className="text-xs text-foreground-400">{items.length}</span>
                  </div>
                  {items.map((item) => (
                    <InsightCard
                      key={item.id}
                      insight={item}
                      onConfirm={() => setStatus(item, 'confirmed')}
                      onCorrect={(text) => setStatus(item, 'corrected', text)}
                      onReject={() => setStatus(item, 'rejected')}
                    />
                  ))}
                </div>
              );
            })}

            {rejected.length > 0 && (
              <div className="mb-5">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-background-200 text-foreground-500">
                    <i className="ri-close-line text-sm" />
                  </span>
                  <h2 className="font-heading text-sm font-semibold text-foreground-500">
                    내가 아니라고 한 내용
                  </h2>
                  <span className="text-xs text-foreground-400">{rejected.length}</span>
                </div>
                {rejected.map((item) => (
                  <InsightCard
                    key={item.id}
                    insight={item}
                    onConfirm={() => setStatus(item, 'confirmed')}
                    onCorrect={(text) => setStatus(item, 'corrected', text)}
                    onReject={() => setStatus(item, 'rejected')}
                  />
                ))}
                <p className="text-[11px] leading-relaxed text-foreground-400">
                  거절한 내용은 다시 추천하거나 질문의 전제로 쓰지 않아요.
                </p>
              </div>
            )}
          </>
        )}

        {/* 연결 준비 CTA */}
        <div className="mt-2">
          <Button full size="lg" onClick={() => setCtaOpen((v) => !v)}>
            <i className="ri-hearts-line text-lg" />
            연결 준비하기
          </Button>
          {ctaOpen && (
            <Card padding="md" className="mt-3 bg-background-100">
              <p className="text-sm font-semibold text-foreground-900">다음 단계 준비 중</p>
              <p className="mt-1 text-xs leading-relaxed text-foreground-500">
                연결 준비 기능은 아직 준비 중이에요. 확인한 내용을 바탕으로 연결을 준비하는 다음
                단계가 열리면 여기서 이어갈 수 있어요.
              </p>
            </Card>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-foreground-400">
          삭제는 서버 정책 승인 전까지 실행하지 않아요.
        </p>
      </div>
    </MobileLayout>
  );
}