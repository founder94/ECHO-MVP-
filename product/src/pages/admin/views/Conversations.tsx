import type { Period } from '../meta';
import { fmtDate, maskEmail, PanelTitle, Pill } from '../components/ui';
import { useAdminConversations, type ConversationLoadState } from '../hooks/useAdminConversations';

const SIGNAL_LABELS: Record<string, string> = {
  repeat_complaint: '반복 지적',
  confusion: '맥락 혼란',
  low_information_repeat: '답변 어려움 반복',
};

const CHOICE_LABELS: Record<string, string> = {
  agree: '맞아요',
  alittle: '조금 달라요',
  no: '그게 아니에요',
  explain: '직접 설명할게요',
};

function StateBox({ state, message }: { state: ConversationLoadState; message?: string }) {
  const text = state === 'loading'
    ? '불러오는 중입니다.'
    : state === 'empty'
      ? '해당 기간에 저장된 대화가 없습니다.'
      : state === 'forbidden'
        ? '관리자 권한이 없습니다.'
        : state === 'unauthorized'
          ? '로그인이 만료되었습니다. 다시 로그인해 주세요.'
          : message || '대화를 불러오지 못했습니다.';
  return (
    <div className="rounded-xl border border-background-200 bg-background-50 p-5 text-sm text-foreground-600">
      {state === 'loading' && <i className="ri-loader-4-line mr-2 animate-spin" />}
      {text}
    </div>
  );
}

export default function Conversations({ period }: { period: Period }) {
  const model = useAdminConversations(period);

  if (model.detail && model.detailState === 'success') {
    const { conversation, profile, emotions, messages, understandings } = model.detail;
    return (
      <section className="mx-auto max-w-4xl">
        <button type="button" onClick={model.clearDetail} className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-foreground-700">
          <i className="ri-arrow-left-line" /> 대화 목록
        </button>
        <div className="rounded-xl border border-background-200 bg-background-50 p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <PanelTitle>{profile?.nickname || profile?.display_name || maskEmail(profile?.email ?? null)}</PanelTitle>
              <p className="mt-1 text-xs text-foreground-500">{maskEmail(profile?.email ?? null)} · {conversation.id}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill>{conversation.status}</Pill>
              <Pill>STEP {conversation.current_step ?? '—'}</Pill>
            </div>
          </div>
          <p className="mt-3 text-xs text-foreground-500">시작 {fmtDate(conversation.created_at)} · 최근 {fmtDate(conversation.updated_at)}</p>
        </div>

        {emotions.map((emotion, index) => (
          <div key={`${emotion.created_at ?? ''}-${index}`} className="mt-5 rounded-xl border border-primary-100 bg-primary-50 p-4">
            <p className="text-xs font-semibold text-primary-800">처음 남긴 마음</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground-900">{emotion.mind_text}</p>
          </div>
        ))}

        <div className="mt-6 flex flex-col gap-3">
          {messages.map((message) => (
            <article key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] rounded-2xl px-4 py-3 ${message.role === 'user' ? 'bg-primary-600 text-white' : 'border border-background-200 bg-background-50 text-foreground-900'}`}>
                <div className={`mb-1 flex flex-wrap gap-2 text-[11px] ${message.role === 'user' ? 'text-white/70' : 'text-foreground-500'}`}>
                  <span>{message.role === 'user' ? '사용자' : 'ECHO'}</span>
                  <span>STEP {message.step ?? '—'}</span>
                  <span>{message.message_kind ?? '—'}</span>
                  <span>{fmtDate(message.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
              </div>
            </article>
          ))}
        </div>

        {understandings.length > 0 && (
          <div className="mt-6 rounded-xl border border-background-200 bg-background-50 p-4">
            <h3 className="text-sm font-semibold text-foreground-900">이해 확인 기록</h3>
            <div className="mt-3 flex flex-col gap-3">
              {understandings.map((item, index) => (
                <div key={`${item.created_at ?? ''}-${index}`} className="rounded-lg bg-background-100 p-3 text-sm text-foreground-700">
                  <p className="font-semibold">{CHOICE_LABELS[item.choice] ?? item.choice}</p>
                  {item.correction_text && <p className="mt-1 whitespace-pre-wrap">정정: {item.correction_text}</p>}
                  {item.self_explanation && <p className="mt-1 whitespace-pre-wrap">직접 설명: {item.self_explanation}</p>}
                  {item.rejected_interpretation && <p className="mt-1 whitespace-pre-wrap text-foreground-500">거절한 해석: {item.rejected_interpretation}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <PanelTitle>사용자 대화</PanelTitle>
          <p className="mt-1 text-sm text-foreground-500">반복 질문과 맥락 문제를 실제 저장 기록으로 확인합니다.</p>
        </div>
        <button type="button" onClick={() => void model.refresh()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-background-200 px-4 text-sm font-medium text-foreground-700">
          <i className="ri-refresh-line" /> 새로고침
        </button>
      </div>

      <input
        value={model.search}
        onChange={(event) => model.setSearch(event.target.value)}
        placeholder="이메일·닉네임·대화 번호 검색"
        className="mt-4 h-12 w-full rounded-xl border border-background-200 bg-background-50 px-4 text-sm text-foreground-900 outline-none focus:border-primary-400"
      />

      {model.detailState === 'loading' && <div className="mt-4"><StateBox state="loading" /></div>}
      {model.detailState !== 'empty' && model.detailState !== 'success' && model.detailState !== 'loading' && (
        <div className="mt-4"><StateBox state={model.detailState} message={model.errorMessage} /></div>
      )}

      {model.state !== 'success' ? (
        <div className="mt-4"><StateBox state={model.state} message={model.errorMessage} /></div>
      ) : model.items.length === 0 ? (
        <div className="mt-4"><StateBox state="empty" /></div>
      ) : (
        <div className="mt-4 grid gap-3">
          {model.items.map((item) => (
            <button
              key={item.conversationId}
              type="button"
              onClick={() => void model.loadDetail(item.conversationId)}
              className="w-full rounded-xl border border-background-200 bg-background-50 p-4 text-left transition hover:border-primary-300 hover:bg-background-100"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground-950">{item.nickname || item.displayName || maskEmail(item.email)}</p>
                  <p className="mt-1 truncate text-xs text-foreground-500">{maskEmail(item.email)} · {item.conversationId}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Pill>{item.status}</Pill>
                  <Pill>메시지 {item.messageCount}</Pill>
                </div>
              </div>
              {item.attentionSignals.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.attentionSignals.map((signal) => <Pill key={signal} tone="needs_check">{SIGNAL_LABELS[signal] ?? signal}</Pill>)}
                </div>
              )}
              <p className="mt-3 text-xs text-foreground-500">STEP {item.currentStep ?? '—'} · 최근 {fmtDate(item.updatedAt)}</p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
