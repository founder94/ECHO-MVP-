import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SceneShell, { type ScenePhase } from '@/pages/do-it/components/SceneShell';
import { GHOST_BUTTON, PRIMARY_BUTTON, useReveal } from '@/pages/do-it/components/sceneStyles';
import { useConversationGate } from '@/pages/do-it/components/useConversationGate';
import { listReports, type LockerItem } from '@/lib/echo/api';

const LOCKER_PATH = '/locker';
const SUMMARY_PREVIEW_MAX = 90;
const INVALID_DATA_MESSAGE = '자료 형식이 올바르지 않아요. 다시 시도해 주세요.';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// 보관함: 본인 리포트 목록(서버 RLS). 항목을 누르면 /report?c=대화 로 이동한다.
export default function LockerPage() {
  const navigate = useNavigate();
  const reveal = useReveal();
  const [phase, setPhase] = useState<ScenePhase>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [items, setItems] = useState<LockerItem[]>([]);

  const load = async () => {
    setPhase('loading');
    setErrorMessage('');
    const state = await listReports();
    if (!state.ok) {
      if (state.reason === 'unauthorized') {
        navigate('/login', { state: { from: LOCKER_PATH } });
        return;
      }
      setPhase('error');
      setErrorMessage(state.error ?? '보관함을 불러오지 못했어요.');
      return;
    }
    // 예상 밖 자료(배열이 아닌 값)가 오면 흰 화면 대신 오류를 안내한다.
    if (!Array.isArray(state.items)) {
      setPhase('error');
      setErrorMessage(INVALID_DATA_MESSAGE);
      return;
    }
    setItems(state.items);
    setPhase('ready');
  };

  useConversationGate(LOCKER_PATH, () => void load(), false);

  return (
    <SceneShell phase={phase} loadingText="보관함을 여는 중이에요..." errorMessage={errorMessage} onRetry={() => void load()} align="left">
      <div className="w-full text-left">
        <div style={reveal(100)} className="mb-6">
          <span className="text-[11px] tracking-[0.3em] text-white/50 font-medium">보관함</span>
          <h1 className="text-[24px] leading-snug font-bold text-white mt-2">내가 남긴 이야기</h1>
        </div>

        {items.length === 0 ? (
          <div style={reveal(200)} className="flex flex-col items-center text-center">
            <p className="text-[13.5px] leading-relaxed text-white/60 mb-8 max-w-xs">아직 보관된 리포트가 없어요. 오늘 마음의 날씨부터 적어볼까요?</p>
            <button type="button" onClick={() => navigate('/weather-check')} className={`${PRIMARY_BUTTON} max-w-xs`}>
              내 마음 날씨 적기
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mb-8">
            {items.map((it, i) => (
              <button
                key={it.id ?? i}
                type="button"
                onClick={() => navigate(`/report?c=${encodeURIComponent(it.conversation_id)}`)}
                style={reveal(200 + i * 60)}
                className="w-full text-left rounded-2xl bg-white/[0.06] border border-white/12 px-5 py-4 cursor-pointer hover:bg-white/[0.1] active:scale-[0.99] transition-all duration-200"
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <h2 className="text-[15px] font-semibold text-white truncate">{it.title}</h2>
                  <span className="text-[11px] text-white/40 whitespace-nowrap">{formatDate(it.created_at)}</span>
                </div>
                <p className="text-[12.5px] leading-relaxed text-white/60 line-clamp-2">{typeof it.summary === 'string' ? it.summary.slice(0, SUMMARY_PREVIEW_MAX) : ''}</p>
              </button>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div style={reveal(600)} className="flex flex-col gap-3">
            <button type="button" onClick={() => navigate('/weather-check')} className={GHOST_BUTTON}>
              새 이야기 시작하기
            </button>
          </div>
        )}
      </div>
    </SceneShell>
  );
}