import { useEffect, useRef, useState } from 'react';

// 2026-10-05 대표 「동영상 제작과정이라고 이걸 홈페이지 안에 그대로 박아」: 대표가 준 16초 세로 영상을 손대지 않고(원본 mp4 다시 압축 0 · 소리 없음) 넣는다.
// 버튼 없이 화면에 들어오면 소리 없이 저절로 반복 재생 · 화면 밖이면 멈춤. 움직임 줄이기면 저절로 재생하지 않고 기본 재생 막대만.
export const MAKING_FILM_COPY = {
  title: '홈페이지 제작 과정',
  note: '디자인부터 장면 15개가 하나의 세계가 되기까지 · 16초 개념 영상이에요(실제 작업 화면 녹화 아님).',
  error: '영상을 불러오지 못했어요.',
} as const;
// 원본(H.264 mp4) 그대로가 기본. H.264 를 못 트는 브라우저만 같은 영상의 webm 사본.
// Codex PR #130 P2: 파일에 실제로 들어 있는 형식(avcC = High 3.1 → avc1.64001f)으로 물어본다. 더 높은 4.0 으로 물으면 틀 수 있는 기기도 webm 으로 빠진다.
const MP4_CODEC = 'avc1.64001f';
const SRC = { mp4: '/brand/film/doit-making-portrait.mp4', webm: '/brand/film/doit-making-portrait.webm', poster: '/brand/film/poster-making.jpg' } as const;
const pickSrc = () => { try { return document.createElement('video').canPlayType(`video/mp4; codecs="${MP4_CODEC}"`) ? SRC.mp4 : SRC.webm; } catch { return SRC.mp4; } };

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
const reducedQuery = (): MediaQueryList | null => { try { return typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_QUERY) : null; } catch { return null; } };
const prefersReduced = () => reducedQuery()?.matches ?? false;

const VISIBLE_RATIO = 0.35;

export default function MakingFilm() {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [still, setStill] = useState(prefersReduced);
  const [failed, setFailed] = useState(false);
  // 브라우저·사용자 설정이 소리 없는 자동 재생도 막으면(play() 거절) 기본 재생 막대를 보여 직접 틀 수 있게 한다(Codex PR #130 P2)
  const [blocked, setBlocked] = useState(false);
  const [src] = useState(pickSrc);

  // Codex PR #130 P2: 페이지를 연 뒤에 움직임 줄이기를 켜도 바로 멈추고 재생 막대를 보여 준다(끄면 다시 보이는 비율에 따라 저절로 재생).
  useEffect(() => {
    const mq = reducedQuery();
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => { if (e.matches) ref.current?.pause(); setStill(e.matches); };
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

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
