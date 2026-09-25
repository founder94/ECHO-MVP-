import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '@/doit/components/feature/MobileLayout';
import Card from '@/doit/components/base/Card';
import Button from '@/doit/components/base/Button';
import Badge from '@/doit/components/base/Badge';
import { useUnderstanding, type FirstRecord } from '@/doit/hooks/useUnderstanding';

const EMOTION_LABEL: Record<string, string> = {
  calm: '편안해요',
  excited: '설레요',
  heavy: '무거워요',
};

function formatFullDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function RecordRow({
  record,
  onEdit,
}: {
  record: FirstRecord;
  onEdit: (record: FirstRecord) => void;
}) {
  const isCorrected = record.status === 'corrected';

  return (
    <Card padding="md" className="mb-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-foreground-500">
          {formatFullDate(record.createdAt)}
        </span>
        {isCorrected && (
          <Badge tone="accent">
            <i className="ri-pencil-line text-xs" />
            수정됨
          </Badge>
        )}
      </div>

      {record.emotion && (
        <div className="mb-2">
          <Badge tone="secondary">
            <i className="ri-leaf-line text-xs" />
            {EMOTION_LABEL[record.emotion] ?? record.emotion}
          </Badge>
        </div>
      )}

      <p className="mb-3 text-sm leading-relaxed text-foreground-900">{record.text}</p>

      {isCorrected && record.originalText !== record.text && (
        <p className="mb-3 rounded-xl bg-background-100 px-3 py-2 text-xs leading-relaxed text-foreground-400 line-through">
          {record.originalText}
        </p>
      )}

      <div className="flex justify-end">
        <Button size="sm" variant="secondary" onClick={() => onEdit(record)}>
          <i className="ri-pencil-line text-sm" />
          수정
        </Button>
      </div>
    </Card>
  );
}

export default function Timeline() {
  const navigate = useNavigate();
  const { records, updateRecord } = useUnderstanding();

  const confirmed = records.filter((r) => r.status !== 'rejected');
  const [editing, setEditing] = useState<FirstRecord | null>(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const startEdit = (record: FirstRecord) => {
    setEditing(record);
    setEditText(record.text);
    setSaveError(null);
  };

  const commitEdit = async () => {
    const trimmed = editText.trim();
    if (!trimmed || !editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateRecord(editing.id, { text: trimmed });
      setEditing(null);
    } catch (e) {
      // 실패해도 입력을 유지하고 재시도할 수 있게 한다.
      setSaveError(
        e instanceof Error && e.message ? e.message : '저장에 실패했어요. 다시 시도해 주세요.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileLayout title="타임라인" back>
      <div className="animate-fade-up pt-4">
        <div className="mb-4">
          <h1 className="font-heading text-xl font-semibold text-foreground-950">
            내 마음은 어떻게 달라져왔을까?
          </h1>
          <p className="mt-1.5 text-sm text-foreground-500">
            내가 확인한 기록만 시간순으로 남아요. 거절한 기록은 여기에 표시되지 않아요.
          </p>
        </div>

        {confirmed.length === 0 ? (
          <Card padding="lg" className="text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-background-200 text-foreground-400">
              <i className="ri-time-line text-xl" />
            </span>
            <p className="text-sm text-foreground-500">아직 확인한 기록이 없어요.</p>
            <p className="mt-1 text-xs text-foreground-400">
              첫 기록을 만들고 확인하면 여기에 쌓여요.
            </p>
            <Button full className="mt-4" onClick={() => navigate('/doit/first-record')}>
              첫 기록 만들기
            </Button>
          </Card>
        ) : (
          <>
            {confirmed.map((r) => (
              <RecordRow key={r.id} record={r} onEdit={startEdit} />
            ))}
            <p className="text-center text-[11px] leading-relaxed text-foreground-400">
              삭제는 서버 승인 전까지 실행하지 않아요. 승인된 서버 처리 후에 제공돼요.
            </p>
          </>
        )}
      </div>

      {/* 수정 바텀시트 */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground-950/40">
          <div className="w-full max-w-md rounded-t-3xl bg-background-50 p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-background-300" />
            <h2 className="mb-3 font-heading text-base font-semibold text-foreground-950">
              기록 수정하기
            </h2>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              maxLength={500}
              rows={4}
              autoFocus
              className="w-full resize-none rounded-xl border border-background-300 bg-background-50 px-3 py-2.5 text-sm leading-relaxed text-foreground-900 outline-none transition-colors focus:border-primary-400"
            />
            <p className="mb-4 mt-1.5 text-right text-[11px] text-foreground-400">
              {editText.length}/500
            </p>
            {saveError && (
              <p className="mb-3 rounded-xl bg-accent-100/70 px-3 py-2 text-sm leading-relaxed text-foreground-800">
                {saveError}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                full
                size="lg"
                disabled={!editText.trim() || saving}
                loading={saving}
                onClick={() => void commitEdit()}
              >
                저장하기
              </Button>
              <Button full size="lg" variant="ghost" onClick={() => setEditing(null)}>
                취소
              </Button>
            </div>
          </div>
        </div>
      )}
    </MobileLayout>
  );
}