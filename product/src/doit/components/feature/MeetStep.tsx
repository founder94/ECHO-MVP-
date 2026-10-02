import { useEffect, useRef, useState, type ReactNode } from 'react';
import { UnderstandingError } from '@/doit/lib/understandingApi';
import { confirmMeetCheck, fetchMeetStatus, reportSubmission, sendMeetIntent, type MeetIntent, type MeetStatus } from '@/doit/lib/connectApi';

// 2026-10-02 PR #99 마지막 구간(2·결정): 앱 안 영상 → 각자 상대 모습 확인 → 각자 만남 의사 → 둘 다 유효할 때만 약속 정하기.
// 무엇을 보여 줄지는 서버가 준 상태(meet_status)만 따른다. 서버가 꺼져 있거나(MEET_NOT_CONFIGURED) 실패하거나 「지금은 어려움」이면
// 이 구간을 아예 그리지 않는다 — 가짜 완료·0 표시 없음. 영상 기록 번호(sessionId)는 화면에 보이지 않고 확인·의사를 보낼 때만 돌려준다.
// 영상 확인은 신원·안전 보증이 아니다(문구로도 말하지 않는다).

const INTENTS: readonly (readonly [MeetIntent, string])[] = [
  ['yes', '만나 보고 싶어요'],
  ['not_now', '조금 더 이야기할래요'],
  ['no', '여기서 마무리할래요'],
];

export default function MeetStep({ userId, matchId, safety }: { userId: string; matchId: string; safety: ReactNode }) {
  const [status, setStatus] = useState<MeetStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [later, setLater] = useState(false); // 「조금 더 생각할게요」 — 저장 0, 이 화면에서만 접음
  const submission = useRef(reportSubmission()); // 의사 한 번의 제출 = 요청 id 하나(같은 선택 재시도는 같은 id)

  useEffect(() => {
    let alive = true;
    void fetchMeetStatus(userId, matchId).then(s => { if (alive) setStatus(s); });
    return () => { alive = false; };
  }, [userId, matchId]);

  if (!status || status.state === 'unavailable') return null;

  const act = async (run: () => Promise<MeetStatus | null>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setStatus(await run());
    } catch (e) {
      // 서버가 지금 상태로는 받을 수 없다고 하거나(다른 기록·동의 철회·차단 등) 그사이 상태가 바뀌었으면(STATE_CHANGED) 다시 읽어 서버 상태대로만 그린다.
      if (e instanceof UnderstandingError && (e.code === 'MEET_UNAVAILABLE' || e.code === 'STATE_CHANGED')) setStatus(await fetchMeetStatus(userId, matchId));
      else setError('저장하지 못했어요. 다시 눌러 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const sid = status.sessionId;
  const ver = status.stateVersion;
  return <section className="doit-meet" data-meet={status.state} aria-label="만나기 전 마지막 단계">
    <p className="doit-match-kicker">만나기 전에</p>

    {status.state === 'need_video' && <p className="doit-connect-note">앱 안에서 짧게 영상으로 인사하면, 각자 상대 모습을 확인하고 만남을 정할 수 있어요.</p>}

    {status.state === 'need_my_check' && sid && ver && !later && <>
      <p className="doit-meet-title">영상에서 본 모습이 소개와 같았나요?</p>
      <p className="doit-connect-note">각자 따로 확인해요. 내 확인이 상대의 확인을 대신하지 않아요.</p>
      <button type="button" className="doit-product-action" disabled={busy} onClick={() => void act(() => confirmMeetCheck(userId, matchId, sid, ver))}>{busy ? '저장하는 중' : '상대 모습을 확인했어요'}<span aria-hidden="true">↗</span></button>
      <button type="button" className="doit-connect-link" disabled={busy} onClick={() => setLater(true)}>조금 더 생각할게요</button>
    </>}

    {status.state === 'need_my_intent' && sid && ver && !later && <>
      <p className="doit-meet-title">직접 만나 볼까요?</p>
      <p className="doit-connect-note">내 선택은 상대에게 그대로 보이지 않아요. 두 분이 모두 원할 때만 약속을 정할 수 있어요.</p>
      <div className="doit-outcome-chips" role="group" aria-label="만남 의사">
        {INTENTS.map(([intent, label]) => <button key={intent} type="button" disabled={busy} onClick={() => void act(() => sendMeetIntent(userId, matchId, sid, ver, intent, submission.current.idFor(`${matchId}:${sid}:${intent}`)))}>{label}</button>)}
      </div>
    </>}

    {later && (status.state === 'need_my_check' || status.state === 'need_my_intent') && <p className="doit-connect-note">천천히 이야기를 더 나눠도 괜찮아요. <button type="button" className="doit-connect-link" onClick={() => setLater(false)}>다시 보기</button></p>}

    {status.state === 'waiting_partner' && <p className="doit-connect-note echo-waiting"><span className="echo-signal-pulse" aria-hidden="true" />내 선택을 남겼어요. 상대의 선택을 기다리고 있어요.</p>}

    {status.state === 'allowed' && status.allowed && <>
      <p className="doit-meet-title">두 분 모두 만나 보고 싶어 해요</p>
      <p className="doit-connect-note">이야기에서 편한 시간과 장소를 함께 정해 보세요. 영상 확인은 신원이나 안전을 보증하지 않아요.</p>
      <div className="doit-meet-safety" role="note" aria-label="만나기 전에">{safety}</div>
    </>}

    {error && <p className="doit-product-error" role="alert">{error}</p>}
  </section>;
}
