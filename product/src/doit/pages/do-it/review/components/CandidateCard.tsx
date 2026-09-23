import { useState } from 'react';
import Card from '@/doit/components/base/Card';
import Button from '@/doit/components/base/Button';
import Badge from '@/doit/components/base/Badge';
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  INFO_STATUS_LABEL,
  type InfoStatus,
  type ReviewCandidate,
} from '@/doit/mocks/understanding';

const INFO_TONE: Record<InfoStatus, 'primary' | 'accent' | 'secondary' | 'neutral'> = {
  confirmed: 'primary',
  possible: 'secondary',
  undetermined: 'neutral',
  needs_verification: 'accent',
};

interface CandidateCardProps {
  candidate: ReviewCandidate;
  onConfirm: () => void;
  onCorrect: (correctedText: string) => void;
  onReject: () => void;
}

export default function CandidateCard({
  candidate,
  onConfirm,
  onCorrect,
  onReject,
}: CandidateCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(candidate.interpretation);

  const commitCorrect = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onCorrect(trimmed);
  };

  return (
    <Card padding="md" className="mb-4">
      {/* 분류 + 정보 상태 */}
      <div className="mb-3 flex items-center justify-between">
        <Badge tone="secondary">
          <i className={`${CATEGORY_ICON[candidate.category]} text-xs`} />
          {CATEGORY_LABEL[candidate.category]}
        </Badge>
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-foreground-500">
          <i className="ri-information-line text-sm" />
          {INFO_STATUS_LABEL[candidate.infoStatus]}
        </span>
      </div>

      {/* 사용자 원문 근거 */}
      <p className="mb-3 rounded-xl bg-background-100 px-3 py-2 text-sm leading-relaxed text-foreground-600">
        &ldquo;{candidate.source}&rdquo;
      </p>

      {/* AI 해석 후보 (또는 수정 입력) */}
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
            className="w-full resize-none rounded-xl border border-background-300 bg-background-50 px-3 py-2 text-sm leading-relaxed text-foreground-900 outline-none transition-colors focus:border-primary-400"
          />
          <p className="mt-1 text-right text-[11px] text-foreground-400">
            {draft.length}/500
          </p>
        </div>
      ) : (
        <p className="mb-3 text-sm font-medium leading-relaxed text-foreground-900">
          {candidate.interpretation}
        </p>
      )}

      {/* 행동 */}
      {editing ? (
        <div className="flex gap-2">
          <Button size="sm" variant="primary" full onClick={commitCorrect}>
            저장하기
          </Button>
          <Button
            size="sm"
            variant="ghost"
            full
            onClick={() => {
              setEditing(false);
              setDraft(candidate.interpretation);
            }}
          >
            취소
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" variant="primary" onClick={onConfirm}>
            <i className="ri-check-line text-sm" />
            확인
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <i className="ri-pencil-line text-sm" />
            수정
          </Button>
          <Button size="sm" variant="ghost" onClick={onReject}>
            <i className="ri-close-line text-sm" />
            거절
          </Button>
        </div>
      )}
    </Card>
  );
}