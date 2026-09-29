import { useState } from 'react';
import Card from '@/doit/components/base/Card';
import Button from '@/doit/components/base/Button';
import Badge from '@/doit/components/base/Badge';
import type { Insight, EntryStatus } from '@/doit/hooks/useUnderstanding';

const STATUS_BADGE: Record<
  EntryStatus,
  { label: string; tone: 'primary' | 'accent' | 'secondary' | 'neutral' }
> = {
  candidate: { label: '후보', tone: 'neutral' },
  confirmed: { label: '확정', tone: 'primary' },
  corrected: { label: '수정됨', tone: 'accent' },
  rejected: { label: '거절됨', tone: 'neutral' },
};

interface InsightCardProps {
  insight: Insight;
  onConfirm: () => void;
  onCorrect: (text: string) => void;
  onReject: () => void;
}

export default function InsightCard({ insight, onConfirm, onCorrect, onReject }: InsightCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(insight.text);

  const meta = STATUS_BADGE[insight.status];
  const isSelf = insight.origin === 'self';

  const commitCorrect = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onCorrect(trimmed);
    setEditing(false);
  };

  const showActions = insight.status !== 'rejected';

  return (
    <Card padding="md" className="mb-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          {isSelf && (
            <Badge tone="secondary">
              <i className="ri-quill-pen-line text-xs" />
              직접 설명
            </Badge>
          )}
        </div>
      </div>

      {editing ? (
        <div className="mb-3">
          <label className="mb-1.5 block text-xs font-medium text-foreground-500">
            이렇게 바꿔서 기억할게요
          </label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            rows={3}
            autoFocus
            className="w-full resize-none rounded-xl border border-background-300 bg-background-50 px-3 py-2 text-sm leading-relaxed text-foreground-900 outline-none transition-colors focus:border-primary-400"
          />
          <p className="mt-1 text-right text-[11px] text-foreground-400">{draft.length}/500</p>
        </div>
      ) : (
        <p
          className={`mb-2 text-sm font-medium leading-relaxed ${
            insight.status === 'rejected' ? 'text-foreground-400 line-through' : 'text-foreground-900'
          }`}
        >
          {insight.text}
        </p>
      )}

      {insight.source && (
        <p className="mb-2 rounded-xl bg-background-100 px-3 py-2 text-xs leading-relaxed text-foreground-500">
          &ldquo;{insight.source}&rdquo;
        </p>
      )}

      {showActions && (
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button size="sm" variant="primary" full onClick={commitCorrect}>
                저장하기
              </Button>
              <Button size="sm" variant="ghost" full onClick={() => setEditing(false)}>
                취소
              </Button>
            </>
          ) : (
            <>
              {insight.status !== 'confirmed' && (
                <Button size="sm" variant="primary" onClick={onConfirm}>
                  <i className="ri-check-line text-sm" />
                  확인
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setDraft(insight.text);
                  setEditing(true);
                }}
              >
                <i className="ri-pencil-line text-sm" />
                수정
              </Button>
              <Button size="sm" variant="ghost" onClick={onReject}>
                <i className="ri-close-line text-sm" />
                거절
              </Button>
            </>
          )}
        </div>
      )}

      {insight.status === 'rejected' && (
        <p className="text-[11px] text-foreground-400">
          거절한 내용은 다시 추천하거나 질문의 전제로 쓰지 않아요.
        </p>
      )}
    </Card>
  );
}