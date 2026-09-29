import Card from '@/doit/components/base/Card';
import Badge from '@/doit/components/base/Badge';
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  type UnderstandingItem,
} from '@/doit/mocks/understanding';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function UnderstandingItemCard({ item }: { item: UnderstandingItem }) {
  const isCorrected = item.status === 'corrected';

  return (
    <Card padding="md" className="mb-3">
      <div className="mb-2 flex items-center justify-between">
        <Badge tone="secondary">
          <i className={`${CATEGORY_ICON[item.category]} text-xs`} />
          {CATEGORY_LABEL[item.category]}
        </Badge>
        <Badge tone={isCorrected ? 'accent' : 'primary'}>
          {isCorrected ? '수정됨' : '확인됨'}
        </Badge>
      </div>

      {/* 해석 (수정본 우선) */}
      {isCorrected ? (
        <div className="mb-2">
          <p className="text-sm font-medium leading-relaxed text-foreground-900">
            {item.correctedText}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-foreground-400 line-through">
            {item.interpretation}
          </p>
        </div>
      ) : (
        <p className="mb-2 text-sm font-medium leading-relaxed text-foreground-900">
          {item.interpretation}
        </p>
      )}

      {/* 원문 근거 */}
      <p className="mb-2 rounded-xl bg-background-100 px-3 py-2 text-xs leading-relaxed text-foreground-500">
        &ldquo;{item.source}&rdquo;
      </p>

      <div className="flex items-center justify-between text-[11px] text-foreground-400">
        <span>{item.sourceLabel}</span>
        <span>{formatDate(item.createdAt)}</span>
      </div>
    </Card>
  );
}