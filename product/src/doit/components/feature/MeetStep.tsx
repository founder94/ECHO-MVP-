import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { UnderstandingError } from '@/doit/lib/understandingApi';
import { VIDEO_CONSENT_VERSION, confirmMeetCheck, loadMeetStatus, videoConsentState, reportSubmission, sendMeetIntent, setVideoConsent, type MeetIntent, type MeetLoad, type MeetStatus } from '@/doit/lib/connectApi';

// 2026-10-02 PR #99~#101 마지막 구간(2·결정): 영상 이용 동의 → 앱 안 영상 → 각자 상대 모습 확인 → 각자 만남 의사 → 둘 다 유효할 때만 약속 정하기.
// 무엇을 보여 줄지는 서버 상태(meet_status)만 따른다:
//  · 꺼짐(MEET_NOT_CONFIGURED) = 그리지 않음 · 켜졌는데 읽기 실패 = 「불러오지 못했어요 · 다시 불러오기」(숨기지 않음)
//  · 「지금은 어려움」(unavailable) = 이유를 말하지 않음(신고·차단·상대 동의 등 민감한 사유 0). 단 내 영상 이용 동의가 없으면 그 안내만.
// 영상 이용 동의는 이름·사진 공개 동의와 다른 칸이다(서로 대신·덮어쓰기 0). 영상 기록 번호(sessionId)는 화면에 보이지 않는다.
// 영상 확인은 신원·안전 보증이 아니다. 상태가 바뀌면(STATE_CHANGED) 다시 읽어 보여 줄 뿐, 동의·의사를 저절로 다시 보내지 않는다.

const INTENTS: readonly (readonly [MeetIntent, string])[] = [
  ['yes', '만나 보고 싶어요'],
  ['not_now', '조금 더 이야기할래요'],
  ['no', '여기서 마무리할래요'],
];

export default function MeetStep({ userId, matchId, safety }: { userId: string; matchId: string; safety: ReactNode }) {
  const [load, setLoad] = useState<MeetLoad | null>(null);
  const [video, setVideo] = useState<{ current: boolean; any: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [later, setLater] = useState(false); // 「조금 더 생각할게요」 — 저장 0, 이 화면에서만 접음
  const submission = useRef(reportSubmission()); // 의사 한 번의 제출 = 요청 id 하나(같은 선택 재시도는 같은 id)

  const reload = useCallback(async () => {
    const [next, consent] = await Promise.all([loadMeetStatus(userId, matchId), videoConsentState()]);
    setLoad(next);
    setVideo(consent);
  }, [userId, matchId]);

  useEffect(() => {
    let alive = true;
    void Promise.all([loadMeetStatus(userId, matchId), videoConsentState()]).then(([next, consent]) => { if (alive) { setLoad(next); setVideo(consent); } });
    return () => { alive = false; };
  }, [userId, matchId]);

  // 영상 이용 동의 거두기 — 기능 꺼짐·불러오기 실패·「지금은 어려움」·정상 어디서든(남아 있는 동의가 있으면) 누를 수 있다.
  const withdrawable = video?.any === true;
  const withdraw = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const failed = await setVideoConsent(false);
    setBusy(false);
    if (failed) setError(failed);
    else await reload();
  };
  const withdrawButton = withdrawable ? <button type="button" className="doit-connect-link" disabled={busy} onClick={() => void withdraw()}>영상 이용 동의 거두기</button> : null;

  if (!load) return null;
  if (load.kind === 'off') return withdrawable ? <section className="doit-meet" data-meet="off" aria-label="영상 이용 동의">{withdrawButton}{error && <p className="doit-product-error" role="alert">{error}</p>}</section> : null;

  if (load.kind === 'error') return <section className="doit-meet" data-meet="error" aria-label="만나기 전 마지막 단계">
    <p className="doit-match-kicker">만나기 전에</p>
    <p className="doit-product-error" role="alert">만나기 전 단계를 불러오지 못했어요.</p>
    <button type="button" className="doit-connect-link" onClick={() => void reload()}>다시 불러오기</button>
    {withdrawButton}
    {error && <p className="doit-product-error" role="alert">{error}</p>}
  </section>;

  const status = load.status;
  const needConsent = !!VIDEO_CONSENT_VERSION && video?.current === false;
  // 「지금은 어려움」: 이유는 말하지 않는다. 남아 있는 영상 이용 동의가 있으면 거두기 버튼만 남긴다.
  const onlyWithdraw = status.state === 'unavailable' && !needConsent;
  if (onlyWithdraw && !withdrawable) return null;

  const act = async (run: () => Promise<MeetStatus | null>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const next = await run();
      setLoad(next ? { kind: 'ready', status: next } : { kind: 'error' });
    } catch (e) {
      // 서버가 지금 상태로는 받을 수 없다고 하거나(MEET_UNAVAILABLE) 그사이 상태가 바뀌었으면(STATE_CHANGED) 다시 읽어 서버 상태대로만 그린다 — 다시 보내지 않음.
      if (e instanceof UnderstandingError && (e.code === 'MEET_UNAVAILABLE' || e.code === 'STATE_CHANGED')) {
        await reload();
        setNote('그사이 상황이 바뀌어 다시 불러왔어요. 지금 화면을 보고 다시 골라 주세요.');
      } else setError('저장하지 못했어요. 다시 눌러 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const consent = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const failed = await setVideoConsent(true);
    setBusy(false);
    if (failed) setError(failed);
    else await reload();
  };

  const sid = status.sessionId;
  const ver = status.stateVersion;
  return <section className="doit-meet" data-meet={needConsent ? 'consent' : status.state} aria-label="만나기 전 마지막 단계">
    {!onlyWithdraw && <p className="doit-match-kicker">만나기 전에</p>}

    {/* 영상 이용 동의(내 것만) — 문구·판 확정은 승인 묶음 B-3. 동의하지 않아도 지금 연결·이야기는 그대로다. */}
    {needConsent && <div className="doit-match-consent" role="group" aria-label="영상 이용 동의">
      <p className="doit-meet-title">앱 안에서 영상으로 인사해 볼까요?</p>
      <ul>
        <li>두 분이 모두 동의했을 때만 앱 안에서 영상으로 인사할 수 있어요.</li>
        <li>이 동의는 이름·사진 공개 동의와 따로예요. 동의하지 않아도 지금 이야기는 그대로 이어져요.</li>
        <li>언제든 거둘 수 있고, 거두면 만남 단계는 바로 멈춰요.</li>
        <li>영상 확인은 신원이나 안전을 보증하지 않아요.</li>
      </ul>
      <button type="button" className="doit-product-action" disabled={busy} onClick={() => void consent()}>{busy ? '저장하는 중' : '영상 이용에 동의할게요'}<span aria-hidden="true">↗</span></button>
    </div>}

    {!needConsent && status.state === 'need_video' && <p className="doit-connect-note">앱 안에서 짧게 영상으로 인사하면, 각자 상대 모습을 확인하고 만남을 정할 수 있어요.</p>}

    {!needConsent && status.state === 'need_my_check' && sid && ver && !later && <>
      <p className="doit-meet-title">영상에서 본 모습이 소개와 같았나요?</p>
      <p className="doit-connect-note">각자 따로 확인해요. 내 확인이 상대의 확인을 대신하지 않아요.</p>
      <button type="button" className="doit-product-action" disabled={busy} onClick={() => void act(() => confirmMeetCheck(userId, matchId, sid, ver))}>{busy ? '저장하는 중' : '상대 모습을 확인했어요'}<span aria-hidden="true">↗</span></button>
      <button type="button" className="doit-connect-link" disabled={busy} onClick={() => setLater(true)}>조금 더 생각할게요</button>
    </>}

    {!needConsent && status.state === 'need_my_intent' && sid && ver && !later && <>
      <p className="doit-meet-title">직접 만나 볼까요?</p>
      <p className="doit-connect-note">내 선택은 상대에게 그대로 보이지 않아요. 두 분이 모두 원할 때만 약속을 정할 수 있어요.</p>
      <div className="doit-outcome-chips" role="group" aria-label="만남 의사">
        {INTENTS.map(([intent, label]) => <button key={intent} type="button" disabled={busy} onClick={() => void act(() => sendMeetIntent(userId, matchId, sid, ver, intent, submission.current.idFor(`${matchId}:${sid}:${intent}`)))}>{label}</button>)}
      </div>
    </>}

    {!needConsent && later && (status.state === 'need_my_check' || status.state === 'need_my_intent') && <p className="doit-connect-note">천천히 이야기를 더 나눠도 괜찮아요. <button type="button" className="doit-connect-link" onClick={() => setLater(false)}>다시 보기</button></p>}

    {!needConsent && status.state === 'waiting_partner' && <p className="doit-connect-note echo-waiting"><span className="echo-signal-pulse" aria-hidden="true" />내 선택을 남겼어요. 상대의 선택을 기다리고 있어요.</p>}

    {!needConsent && status.state === 'allowed' && status.allowed && <>
      <p className="doit-meet-title">두 분 모두 만나 보고 싶어 해요</p>
      <p className="doit-connect-note">이야기에서 편한 시간과 장소를 함께 정해 보세요. 영상 확인은 신원이나 안전을 보증하지 않아요.</p>
      <div className="doit-meet-safety" role="note" aria-label="만나기 전에">{safety}</div>
    </>}

    {note && !onlyWithdraw && <p className="doit-connect-note" role="status">{note}</p>}
    {error && <p className="doit-product-error" role="alert">{error}</p>}

    {withdrawButton}
  </section>;
}
