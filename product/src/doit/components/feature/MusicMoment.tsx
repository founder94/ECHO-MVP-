import { useEffect, useRef, useState } from 'react';
import { MOMENT_LYRIC, MOMENT_TRACK } from '@/lib/doitMusic';

// DO IT MUSIC MOMENT(2026-09-26 대표 「DO IT MUSIC · MVP FINAL LOCK」).
// 「ECHO가 이해한 나」를 [맞아요]로 확인한 뒤 한 번 보이는 작은 카드. 음악을 들어야 넘어가는 문이 아니다.
// - 자동 재생 0: 누를 때만 음원을 불러오고 재생한다(누르기 전에는 음원 주소에 접속하지 않는다).
// - 언제든 멈춤. [지금은 괜찮아요]면 카드를 접는다(이 탭에서는 다시 권하지 않는다). 다음 단계 버튼은 이 카드와 상관없이 늘 아래에 있다.
// - 가사는 대표가 쓴 실제 가사만. 없으면 가사 줄을 그리지 않는다(AI 가 가사를 만들지 않는다).

const SKIP_KEY = 'echo:music-moment';
const skipped = () => { try { return sessionStorage.getItem(SKIP_KEY) === 'skipped'; } catch { return false; } };
const fmt = (sec: number) => Number.isFinite(sec) && sec > 0 ? `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}` : '-:--';

export default function MusicMoment() {
  const [hidden, setHidden] = useState(skipped);
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'paused' | 'failed'>('idle');
  const [time, setTime] = useState({ cur: 0, dur: 0 });
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => { const a = audio.current; if (a) { a.pause(); a.src = ''; } audio.current = null; }, []);

  const play = () => {
    let a = audio.current;
    if (!a) {
      a = new Audio();
      a.preload = 'metadata';
      a.src = MOMENT_TRACK.src;
      a.addEventListener('timeupdate', () => setTime(t => ({ ...t, cur: a!.currentTime })));
      a.addEventListener('loadedmetadata', () => setTime(t => ({ ...t, dur: a!.duration })));
      a.addEventListener('playing', () => setState('playing'));
      a.addEventListener('pause', () => setState(s => (s === 'failed' ? s : 'paused')));
      a.addEventListener('ended', () => { setState('paused'); setTime(t => ({ ...t, cur: 0 })); });
      audio.current = a;
    }
    if (a.error) a.src = MOMENT_TRACK.src; // 불러오기 실패 뒤 다시 누르면 새로 불러온다
    setState('loading');
    a.play().catch(() => setState('failed'));
  };
  const stop = () => { audio.current?.pause(); };
  const skip = () => {
    stop();
    try { sessionStorage.setItem(SKIP_KEY, 'skipped'); } catch { /* 이 화면에서만 접는다 */ }
    setHidden(true);
  };

  if (hidden) return null;
  const on = state === 'playing' || state === 'loading';
  return <section className="echo-done echo-music-moment" aria-label="DO IT MUSIC">
    <p className="echo-done-mark">DO IT MUSIC</p>
    <p className="echo-done-lead">ECHO가 시작되기 전, 직접 겪은 이야기로 쓴 노래예요.</p>
    {MOMENT_LYRIC && <p className="echo-music-lyric">「{MOMENT_LYRIC}」</p>}
    <div className="echo-done-actions">
      {on
        ? <button type="button" className="echo-secondary" onClick={stop}>■ 멈추기</button>
        : <button type="button" className="echo-secondary" onClick={play}>▶ {state === 'paused' ? '이어서 들을래요' : '들어볼래요?'}</button>}
      <button type="button" className="echo-text-button" onClick={skip}>지금은 괜찮아요</button>
    </div>
    {state !== 'idle' && <p className="echo-fine" aria-live="polite">{state === 'failed' ? '지금은 음악을 불러오지 못했어요. 음악 없이 그대로 이어 가도 돼요.' : state === 'loading' ? '불러오는 중이에요' : `${fmt(time.cur)} / ${fmt(time.dur)}`}</p>}
  </section>;
}
