import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SceneShell, { type ScenePhase } from '@/pages/do-it/components/SceneShell';
import { GHOST_BUTTON, PRIMARY_BUTTON, TEXT_BUTTON, useReveal } from '@/pages/do-it/components/sceneStyles';
import { useConversationGate } from '@/pages/do-it/components/useConversationGate';
import { DOIT_DOOR_LABEL, DOIT_ONBOARDING_PATH, showDoitDoor } from '@/lib/echo/appMode';
import {
  IN_PROGRESS_RETRY_MS,
  UNKNOWN_STATE_MESSAGE,
  generateReport,
  newRequestToken,
  resumeJourney,
  routeWithConversation,
  type FlowState,
  type ReportContent,
  type ReportRow,
} from '@/lib/echo/api';
import { saveDoitHandoff } from '@/doit/lib/understandingApi';
import ContinueConversation from '@/pages/do-it/report/components/ContinueConversation';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const REPORT_STATUSES = ['report_ready', 'report_done'] as const;
const STATUS_LABEL = { confirmed: '내가 말한 것', candidate: 'ECHO의 생각(후보)' } as const;
const INVALID_DATA_MESSAGE = '자료 형식이 올바르지 않아요. 다시 시도해 주세요.';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// 서버 응답 본문이 예상 밖 자료(null·객체·문자열 등)여도 흰 화면을 만들지 않도록 형식을 먼저 검사한다.
function isValidReportContent(content: unknown): content is ReportContent {
  if (!content || typeof content !== 'object') return false;
  const c = content as Record<string, unknown>;
  return (
    typeof c.title === 'string' &&
    typeof c.summary === 'string' &&
    typeof c.next_step === 'string' &&
    Array.isArray(c.sections)
  );
}

// 자기이해 보고서. 서버가 만든 JSON 만 표시한다. 없으면 서버에 생성 요청(대화당 1건, 토큰 유지).
export default function ReportPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const conversationId = searchParams.get('c') ?? '';
  const reveal = useReveal();

  const [phase, setPhase] = useState<ScenePhase>('loading');
  const [loadingText, setLoadingText] = useState('확인하고 있어요...');
  const [errorMessage, setErrorMessage] = useState('');
  const [report, setReport] = useState<ReportRow | null>(null);
  // 리포트 이후 대화: 서버가 알려준 열린 턴(질문이거나 내 물음에 답만 한 턴)을 그대로 받는다.
  const [continueTurn, setContinueTurn] = useState('');
  const [continueNeedsTurn, setContinueNeedsTurn] = useState(true);
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [handoffError, setHandoffError] = useState('');
  const tokenRef = useRef('');

  const returnPath = `/report?c=${encodeURIComponent(conversationId)}`;

  const showFailure = (state: FlowState) => {
    if (state.reason === 'unauthorized') {
      navigate('/login', { state: { from: returnPath } });
      return;
    }
    if (state.reason === 'not_configured') {
      setPhase('not_configured');
      return;
    }
    if (state.reason === 'payment_required') {
      navigate(`/payment?c=${encodeURIComponent(conversationId)}`, { replace: true });
      return;
    }
    setPhase('error');
    setErrorMessage(state.error ?? '요청을 처리하지 못했어요.');
  };

  const isReportStatus = (s?: string) => (REPORT_STATUSES as readonly string[]).includes(s ?? '');

  const load = async () => {
    setPhase('loading');
    setLoadingText('확인하고 있어요...');
    setErrorMessage('');
    const state = await resumeJourney(conversationId);
    if (!state.ok) {
      showFailure(state);
      return;
    }
    if (!isReportStatus(state.status)) {
      const target = routeWithConversation(state.status, conversationId);
      if (!target) {
        setPhase('error');
        setErrorMessage(UNKNOWN_STATE_MESSAGE);
        return;
      }
      navigate(target, { replace: true });
      return;
    }
    if (!state.reportEntitled) {
      navigate(`/payment?c=${encodeURIComponent(conversationId)}`, { replace: true });
      return;
    }
    setContinueTurn((state.question ?? '').trim());
    setContinueNeedsTurn(state.needsQuestion !== false);
    if (state.report) {
      if (!isValidReportContent(state.report.content)) {
        setPhase('error');
        setErrorMessage(INVALID_DATA_MESSAGE);
        return;
      }
      setReport(state.report);
      setPhase('ready');
      return;
    }
    setLoadingText('ECHO가 리포트를 쓰고 있어요...');
    if (!tokenRef.current) tokenRef.current = newRequestToken();
    let result = await generateReport(conversationId, tokenRef.current);
    if (!result.ok && result.reason === 'in_progress') {
      await wait(IN_PROGRESS_RETRY_MS);
      result = await resumeJourney(conversationId);
    }
    if (!result.ok) {
      showFailure(result);
      return;
    }
    if (!result.report) {
      setPhase('error');
      setErrorMessage('리포트가 아직 준비되지 않았어요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    if (!isValidReportContent(result.report.content)) {
      setPhase('error');
      setErrorMessage(INVALID_DATA_MESSAGE);
      return;
    }
    setReport(result.report);
    setPhase('ready');
  };

  useConversationGate(returnPath, () => void load());

  // "DO IT으로 이어가기"를 직접 누를 때만 대화·리포트 참조를 서버에 저장하고 A 진입 경로로 이동한다.
  const doHandoff = async () => {
    setHandoffBusy(true);
    setHandoffError('');
    try {
      await saveDoitHandoff(conversationId);
      navigate(DOIT_ONBOARDING_PATH);
    } catch (e) {
      setHandoffError(
        e instanceof Error && e.message ? e.message : '연결에 실패했어요. 다시 시도해 주세요.',
      );
    } finally {
      setHandoffBusy(false);
    }
  };

  const content = report?.content;

  return (
    <SceneShell phase={phase} loadingText={loadingText} errorMessage={errorMessage} onRetry={() => void load()} align="left">
      {report && content && (
        <div className="w-full text-left">
          <div style={reveal(100)} className="mb-2 flex items-center justify-between">
            <span className="text-[11px] tracking-[0.3em] text-white/50 font-medium">자기이해 보고서</span>
            <span className="text-[11px] tracking-[0.1em] text-white/35">{formatDate(report.created_at)}</span>
          </div>

          <h1 style={reveal(160)} className="text-[24px] leading-snug font-bold text-white mb-4">
            {content.title}
          </h1>
          <p style={reveal(240)} className="text-[14px] leading-relaxed text-white/80 mb-8 whitespace-pre-wrap">
            {content.summary}
          </p>

          <div className="flex flex-col gap-4 mb-8">
            {(Array.isArray(content.sections) ? content.sections : []).map((s, i) => (
              <div key={`${i}-${s.heading}`} style={reveal(320 + i * 80)} className="rounded-2xl bg-white/[0.06] border border-white/12 px-5 py-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h2 className="text-[15px] font-semibold text-white">{s.heading}</h2>
                  <span className={`text-[10.5px] tracking-[0.1em] whitespace-nowrap ${s.status === 'confirmed' ? 'text-white/70' : 'text-white/40'}`}>
                    {STATUS_LABEL[s.status]}
                  </span>
                </div>
                <p className="text-[13.5px] leading-relaxed text-white/75 whitespace-pre-wrap">{s.body}</p>
              </div>
            ))}
          </div>

          <div style={reveal(720)} className="rounded-2xl bg-white/[0.1] border border-white/20 px-5 py-4 mb-8">
            <p className="text-[11px] tracking-[0.3em] text-white/50 font-medium mb-2">지금 해볼 수 있는 한 걸음</p>
            <p className="text-[14px] leading-relaxed text-white whitespace-pre-wrap">{content.next_step}</p>
          </div>

          <div style={reveal(760)} className="mb-8">
            <ContinueConversation
              conversationId={conversationId}
              initialTurn={continueTurn}
              initialNeedsTurn={continueNeedsTurn}
              onUnavailable={showFailure}
            />
          </div>

          <div style={reveal(800)} className="flex flex-col gap-3">
            <button type="button" onClick={() => navigate('/next-journey')} className={PRIMARY_BUTTON}>
              다음 여정으로
            </button>
            <button type="button" onClick={() => navigate('/locker')} className={GHOST_BUTTON}>
              보관함에서 다시 보기
            </button>
            {showDoitDoor() && (
              <button
                type="button"
                onClick={() => void doHandoff()}
                disabled={handoffBusy}
                className={GHOST_BUTTON}
              >
                {handoffBusy ? '연결하는 중...' : DOIT_DOOR_LABEL}
              </button>
            )}
            {handoffError && (
              <p className="mt-2 text-center text-[13px] text-red-300">{handoffError}</p>
            )}
            <button type="button" onClick={() => navigate('/')} className={TEXT_BUTTON}>
              처음으로
            </button>
          </div>
        </div>
      )}
    </SceneShell>
  );
}
