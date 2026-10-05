import { useEffect, useRef, useState } from 'react';

// 2026-10-05 대표 「동영상 제작과정이라고 이걸 홈페이지 안에 그대로 박아」: 대표가 준 16초 세로 영상을 손대지 않고(원본 mp4 다시 압축 0 · 소리 없음) 넣는다.
// 버튼 없이 화면에 들어오면 소리 없이 저절로 반복 재생 · 화면 밖이면 멈춤. 움직임 줄이기면 저절로 재생하지 않고 기본 재생 막대만.
export const MAKING_FILM_COPY = {
  title: '홈페이지 제작 과정',
  note: '디자인부터 장면 15개가 하나의 세계가 되기까지 · 16초 개념 영상이에요(실제 작업 화면 녹화 아님).',
  error: '영상을 불러오지 못했어요.',
} as const;
// 원본(H.264 mp4) 그대로가 기본. H.264 를 못 트는 브라우저만 같은 영상의 webm 사본.
const SRC = { mp4: '/brand/film/doit-making-portrait.mp4', webm: '/brand/film/doit-making-portrait.webm', poster: '/brand/film/poster-making.jpg' } as const;
const pickSrc = () => { try { return document.createElement('video').canPlayType('video/mp4; codecs="avc1.640028"') ? SRC.mp4 : SRC.webm; } catch { return SRC.mp4; } };

const prefersReduced = () => { try { return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

const VISIBLE_RATIO = 0.35;

export default function MakingFilm() {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [still] = useState(prefersReduced);
  const [failed, setFailed] = useState(false);
  // 브라우저·사용자 설정이 소리 없는 자동 재생도 막으면(play() 거절) 기본 재생 막대를 보여 직접 틀 수 있게 한다(Codex PR #130 P2)
  const [blocked, setBlocked] = useState(false);
  const [src] = useState(pickSrc);

  useEffect(() => {
    const v = ref.current;
    if (!v || still) return;
    const tryPlay = () => { void v.play().catch(() => setBlocked(true)); };
    if (typeof IntersectionObserver !== 'function') { tryPlay(); return; }
    // Codex PR #130 P2: isIntersecting 은 조금만 보여도 참이라 35% 아래로 내려가도 멈추지 않는다 → 보이는 비율로 정한다(35% 이상 = 재생 · 아래 = 멈춤)
    const io = new IntersectionObserver(([e]) => { if (e.intersectionRatio >= VISIBLE_RATIO) tryPlay(); else v.pause(); }, { threshold: [0, VISIBLE_RATIO] });
    io.observe(v);
    return () => io.disconnect();
  }, [still]);

  return (
    <figure className="bh-making-film">
      <div className="bh-making-frame">
        {failed
          ? <p className="bh-film-msg" role="status">{MAKING_FILM_COPY.error}</p>
          : <video ref={ref} src={src} poster={SRC.poster} muted loop playsInline preload="metadata" controls={still || blocked} aria-label={MAKING_FILM_COPY.title} onError={() => setFailed(true)} />}
      </div>
      <figcaption className="bh-film-note">{MAKING_FILM_COPY.note}</figcaption>
    </figure>
  );
}
