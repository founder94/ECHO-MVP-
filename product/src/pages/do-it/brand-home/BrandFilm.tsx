import { useEffect, useRef, useState } from 'react';

// DO IT 브랜드 영상(2026-10-04 대표 「홈페이지 안에 들어갈 DO IT 브랜드 영상」). ECHO 소개 다음 · 회사 소개 앞.
// - 처음에는 대표 이미지 + 「영상 보기」만. 누르기 전에는 영상 파일을 받지 않는다(첫 화면 로딩과 분리).
// - 누르면 이 자리에서 재생: 재생·일시정지·전체화면은 브라우저 기본 조작. 소리 트랙이 없는 영상이라 소리가 저절로 나지 않는다.
// - 화면 밖으로 나가면 멈춘다 · 실패하면 대표 이미지 + 「영상을 불러오지 못했어요. 다시 시도해 주세요.」
// - 영상 속 화면은 「서비스 이용 예시 · 합성 화면」이다(실제 회원 정보 0). 영상 안에는 시작 버튼을 그리지 않았고, 진짜 시작 버튼은 아래(부모)에 따로 있다.
// - 휴대폰 세로 화면이면 세로 영상, 그 밖에는 가로 영상.
export const BRAND_FILM_COPY = { title: '이야기가 연결이 되기까지', play: '영상 보기', error: '영상을 불러오지 못했어요. 다시 시도해 주세요.', retry: '다시 시도', note: '서비스 이용 예시 · 합성 화면으로 만든 25초 영상이에요.' } as const;
const FILM = {
  landscape: { mp4: '/brand/film/doit-brand-film-landscape.mp4', webm: '/brand/film/doit-brand-film-landscape.webm', poster: '/brand/film/poster-landscape.jpg' },
  portrait: { mp4: '/brand/film/doit-brand-film-portrait.mp4', webm: '/brand/film/doit-brand-film-portrait.webm', poster: '/brand/film/poster-portrait.jpg' },
  captions: '/brand/film/captions.ko.vtt',
} as const;
const PORTRAIT_QUERY = '(orientation: portrait) and (max-width: 900px)';
const isPortrait = () => { try { return typeof window.matchMedia === 'function' && window.matchMedia(PORTRAIT_QUERY).matches; } catch { return false; } };

type State = 'idle' | 'playing' | 'error';

export default function BrandFilm() {
  const [state, setState] = useState<State>('idle');
  const [attempt, setAttempt] = useState(0);
  const [portrait] = useState(isPortrait);
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const film = portrait ? FILM.portrait : FILM.landscape;

  // 누른 뒤에만 재생(사용자 동작) · 화면 밖이면 멈춤
  useEffect(() => {
    if (state !== 'playing') return;
    const v = videoRef.current; if (!v) return;
    // 영상 자체 오류(받은 뒤 깨짐 등)는 브라우저 이벤트로 직접 받는다. React onError 를 <video> 에 달면
    // 앞 원본(mp4)을 못 트는 브라우저에서 <source> 오류가 부모로 전달돼, 뒤 원본(webm)으로 넘어가기 전에 실패로 바뀐다.
    const fail = () => setState('error');
    v.addEventListener('error', fail);
    v.play()?.catch(() => { /* 브라우저가 막으면 조작 막대의 재생 버튼으로 이어서 */ });
    const box = boxRef.current;
    const io = box && typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([e]) => { if (e && e.intersectionRatio < 0.25 && !v.paused) v.pause(); }, { threshold: [0, 0.25, 0.5] })
      : null;
    if (box) io?.observe(box);
    return () => { v.removeEventListener('error', fail); io?.disconnect(); };
  }, [state, attempt]);

  return <div ref={boxRef} className="bh-film" data-state={state} data-orient={portrait ? 'portrait' : 'landscape'}>
    {state === 'playing'
      ? <video key={attempt} ref={videoRef} className="bh-film-video" controls playsInline preload="metadata" poster={film.poster}
          aria-label={`${BRAND_FILM_COPY.title} — 서비스 이용 예시 영상`}>
          {/* H.264(사파리·크롬) 먼저, 못 틀면 VP9. 마지막 원본까지 실패할 때만 실패 안내. */}
          <source src={film.mp4} type="video/mp4" onError={(e) => e.stopPropagation()} />
          <source src={film.webm} type="video/webm" onError={(e) => { e.stopPropagation(); setState('error'); }} />
          <track kind="captions" srcLang="ko" label="한국어" src={FILM.captions} default />
        </video>
      : <div className="bh-film-poster">
          <img src={film.poster} alt="" loading="lazy" decoding="async" />
          {state === 'error'
            ? <div className="bh-film-msg" role="alert"><p>{BRAND_FILM_COPY.error}</p><button type="button" className="bh-btn bh-btn--outline" onClick={() => { setAttempt((n) => n + 1); setState('playing'); }}>{BRAND_FILM_COPY.retry}</button></div>
            : <button type="button" className="bh-film-play" onClick={() => setState('playing')}>
                <span className="bh-film-play-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg></span>
                {BRAND_FILM_COPY.play}
              </button>}
        </div>}
    <p className="bh-film-note">{BRAND_FILM_COPY.note}</p>
  </div>;
}
