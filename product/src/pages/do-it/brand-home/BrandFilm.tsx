import { useEffect, useRef, useState } from 'react';
import { GUIDE_OPEN_EVENT } from '@/lib/guide/bus';

// 홈페이지 제작과정 영상(2026-10-05 대표 「두 번째 동영상을 홈페이지 제작과정이라 글을 쓰고, 스크롤 내리면 자동재생」).
// - 영상 = 대표가 직접 올린 16초 영상(세로 600×1066 · 소리 트랙 없음). 예전 25초 「서비스 이용 예시」 영상 파일은 지우지 않고 쓰지만 않는다.
// - 화면에 절반 이상 들어오면 소리 없이 저절로 재생 · 4분의 1 아래로 나가면 멈춤 · 끝나면 처음부터 다시(반복).
// - 「움직임 줄이기」를 켠 사람에게는 저절로 틀지 않고 「영상 보기」 버튼을 보여 준다(누르면 재생).
// - 영상을 누르거나 오른쪽 아래 「멈춤/재생」 버튼(키보드로도 누름)으로 멈춤/다시 재생 · 이용 안내 창을 열면 멈춤 · 영상을 못 받으면 대표 이미지 + 「다시 시도」.
// - 첫 화면 로딩과 분리: 영상 칸이 화면 가까이 오기 전에는 영상 파일을 받지 않는다(preload="none" + 그때 src 를 붙임).
export const BRAND_FILM_COPY = { title: '홈페이지 제작과정', play: '영상 보기', error: '영상을 불러오지 못했어요. 다시 시도해 주세요.', retry: '다시 시도', note: '홈페이지를 만든 과정을 담은 16초 영상이에요.' } as const;
export const FILM = { mp4: '/brand/film/homepage-making.mp4', webm: '/brand/film/homepage-making.webm', poster: '/brand/film/homepage-making-poster.jpg' } as const;
const reduceMotion = () => { try { return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

type State = 'waiting' | 'ready' | 'error';

export default function BrandFilm() {
  const [state, setState] = useState<State>('waiting'); // waiting = 아직 화면 가까이 오지 않음(영상 받지 않음)
  const [attempt, setAttempt] = useState(0);
  const [askPlay, setAskPlay] = useState(false); // 움직임 줄이기 · 브라우저가 저절로 재생을 막았을 때만 「영상 보기」
  const [playing, setPlaying] = useState(false); // 멈춤/재생 버튼 글(키보드·스위치로도 멈출 수 있게)
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const userPaused = useRef(false); // 사용자가 직접 멈췄으면 다시 화면에 들어와도 저절로 틀지 않는다
  // 재생 거절 중 「막힘」(NotAllowedError)만 「영상 보기」로 · 화면 밖으로 나가 멈춰서 끊긴 시도(AbortError)는 무시
  const blocked = (e: unknown) => { if ((e as { name?: string } | null)?.name === 'NotAllowedError') setAskPlay(true); };

  // 화면 가까이(아래 300px) 오면 그때 영상을 붙인다.
  useEffect(() => {
    if (state !== 'waiting') return;
    const box = boxRef.current;
    if (!box || typeof IntersectionObserver === 'undefined') { setState('ready'); return; }
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) setState('ready'); }, { rootMargin: '0px 0px 300px 0px' });
    io.observe(box);
    return () => io.disconnect();
  }, [state]);

  // 절반 이상 보이면 재생 · 4분의 1 아래면 멈춤
  useEffect(() => {
    if (state !== 'ready') return;
    const v = videoRef.current, box = boxRef.current; if (!v || !box) return;
    const fail = () => setState('error');
    v.addEventListener('error', fail);
    // 실제로 재생되면 「영상 보기」를 거둔다 · 멈춤/재생 버튼 글을 맞춘다
    const onPlaying = () => { setAskPlay(false); setPlaying(true); };
    const onPause = () => setPlaying(false);
    v.addEventListener('playing', onPlaying); v.addEventListener('pause', onPause);
    const onGuide = () => { if (!v.paused) v.pause(); };
    window.addEventListener(GUIDE_OPEN_EVENT, onGuide);
    const tryPlay = () => {
      if (reduceMotion() || userPaused.current) { if (reduceMotion()) setAskPlay(true); return; }
      v.muted = true;
      v.play()?.catch(blocked); // 저전력 모드 등으로 막히면 「영상 보기」 버튼
    };
    const io = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([e]) => {
          if (!e) return;
          if (e.intersectionRatio >= 0.5) tryPlay();
          else if (e.intersectionRatio < 0.25 && !v.paused) v.pause();
        }, { threshold: [0, 0.25, 0.5, 0.75] })
      : null;
    io?.observe(box);
    if (!io) tryPlay();
    return () => { v.removeEventListener('error', fail); v.removeEventListener('playing', onPlaying); v.removeEventListener('pause', onPause); window.removeEventListener(GUIDE_OPEN_EVENT, onGuide); io?.disconnect(); };
  }, [state, attempt]);

  const toggle = () => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) { userPaused.current = false; setAskPlay(false); v.muted = true; v.play()?.catch(blocked); }
    else { userPaused.current = true; v.pause(); }
  };

  return <div ref={boxRef} className="bh-film" data-state={state} data-orient="portrait">
    {state === 'ready'
      ? <div className="bh-film-frame">
          <video key={attempt} ref={videoRef} className="bh-film-video" muted loop playsInline preload="metadata" poster={FILM.poster}
            aria-label={`${BRAND_FILM_COPY.title} 영상`} onClick={toggle}>
            {/* H.264(사파리·크롬) 먼저, 못 틀면 VP9. 마지막 원본까지 실패할 때만 실패 안내. */}
            <source src={FILM.mp4} type="video/mp4" onError={(e) => e.stopPropagation()} />
            <source src={FILM.webm} type="video/webm" onError={(e) => { e.stopPropagation(); setState('error'); }} />
          </video>
          <button type="button" className="bh-film-toggle" onClick={toggle} aria-label={playing ? '영상 멈추기' : '영상 재생하기'}>{playing ? '멈춤' : '재생'}</button>
          {askPlay && <button type="button" className="bh-film-play" onClick={toggle}>
            <span className="bh-film-play-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg></span>
            {BRAND_FILM_COPY.play}
          </button>}
        </div>
      : <div className="bh-film-poster">
          <img src={FILM.poster} alt="" loading="lazy" decoding="async" />
          {state === 'error' && <div className="bh-film-msg" role="alert"><p>{BRAND_FILM_COPY.error}</p><button type="button" className="bh-btn bh-btn--outline" onClick={() => { setAttempt((n) => n + 1); setAskPlay(false); setState('ready'); }}>{BRAND_FILM_COPY.retry}</button></div>}
        </div>}
    <p className="bh-film-note">{BRAND_FILM_COPY.note}</p>
  </div>;
}
