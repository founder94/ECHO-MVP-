import { useCallback, useEffect, useRef, useState } from 'react';
import { VOICE_ACTIVE_EVENT } from '@/doit/lib/voiceOutput';
import { DOIT_TRACKS } from '@/lib/doitMusic';

// 2026-09-26 대표 「DO IT MUSIC · MVP FINAL LOCK」: 첫 화면에서 내렸다(지금 쓰는 곳 0 · 파일은 보존). 음원 주소는 src/lib/doitMusic.ts 한 곳.
const TRACKS = DOIT_TRACKS;

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// 직접 정지·곡 교체로 인해 발생한 AbortError는 자동재생 차단이 아니다.
function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: number };
  return e.name === 'AbortError' || e.code === 20;
}

// 사용자 제스처 없이 재생해서 생기는 NotAllowedError만 "브라우저 차단"으로 표시.
// 그 밖의 실패(포맷·네트워크 등)는 원인을 특정하지 않고 일반 실패로 표시한다.
function isNotAllowedError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: number };
  return e.name === 'NotAllowedError';
}

export default function OriginalMusicCard() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<number | null>(null);
  const sequenceRef = useRef(false);
  // 재생 시도별 요청 번호. 곡 변경·정지·취소·언마운트 시 증가시켜 이전 요청을 무효화한다.
  const requestIdRef = useRef(0);
  // 컴포넌트 활성 수명. 언마운트되면 false → 늦은 then/catch가 상태를 바꾸지 못한다.
  const aliveRef = useRef(true);

  const [track, setTrack] = useState<number | null>(null);
  const [sequence, setSequence] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  // 오류 상태를 원인별로 구분: 'blocked'(브라우저 차단) / 'failed'(그 밖의 재생 실패).
  const [errorState, setErrorState] = useState<'blocked' | 'failed' | null>(null);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  // 오디오 엘리먼트는 단 1개만 재사용 → 두 곡 동시 재생 불가.
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;
    aliveRef.current = true;

    const onTime = () => setCurrent(audio.currentTime);
    const onMeta = () =>
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    // play 이벤트가 아니라 playing 이벤트(실제 재생 시작)로만 "재생 중"을 켠다.
    // 로딩 단계에서는 play 이벤트가 떠도 아직 재생이 시작되지 않았을 수 있다.
    const onPlaying = () => {
      if (!aliveRef.current) return;
      setIsPlaying(true);
      setErrorState(null);
    };
    const onPause = () => {
      if (!aliveRef.current) return;
      setIsPlaying(false);
    };
    const onEnded = () => {
      if (!aliveRef.current) return;
      const idx = trackRef.current;
      if (sequenceRef.current && idx === 0) {
        // 이어 듣기: 원음 1 끝 → 원음 2로 이어 재생.
        const reqId = ++requestIdRef.current;
        trackRef.current = 1;
        setTrack(1);
        setCurrent(0);
        setDuration(0);
        audio.src = TRACKS[1].src;
        audio
          .play()
          .then(() => {
            if (reqId !== requestIdRef.current || !aliveRef.current) return;
            setErrorState(null);
          })
          .catch((err) => {
            if (reqId !== requestIdRef.current || !aliveRef.current) return;
            if (isAbortError(err)) return;
            setErrorState(isNotAllowedError(err) ? 'blocked' : 'failed');
            setIsPlaying(false);
          });
        return;
      }
      // 단일 곡 끝 또는 이어 듣기 마지막 곡 끝 → 정지(자동 반복 없음).
      audio.pause();
      setIsPlaying(false);
      setCurrent(0);
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    // 2026-09-26 대표 「음악 + Voice 충돌 금지」: ECHO 가 듣거나 말하기 시작하면 음악을 멈춘다(위치·곡은 그대로). 다시 틀기는 사용자가 재생을 누를 때만.
    const onVoice = () => { if (!audio.paused) { requestIdRef.current += 1; audio.pause(); } };
    window.addEventListener(VOICE_ACTIVE_EVENT, onVoice);

    return () => {
      aliveRef.current = false;
      requestIdRef.current += 1;
      audio.pause();
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      window.removeEventListener(VOICE_ACTIVE_EVENT, onVoice);
      audio.src = '';
      audioRef.current = null;
    };
  }, []);

  const playTrack = useCallback((idx: number, seq: boolean) => {
    const audio = audioRef.current;
    if (!audio) return;
    const reqId = ++requestIdRef.current;
    trackRef.current = idx;
    sequenceRef.current = seq;
    setTrack(idx);
    setSequence(seq);
    setCurrent(0);
    setDuration(0);
    setErrorState(null);
    audio.src = TRACKS[idx].src;
    audio
      .play()
      .then(() => {
        if (reqId !== requestIdRef.current || !aliveRef.current) return;
        setErrorState(null);
      })
      .catch((err) => {
        if (reqId !== requestIdRef.current || !aliveRef.current) return;
        if (isAbortError(err)) return;
        setErrorState(isNotAllowedError(err) ? 'blocked' : 'failed');
        setIsPlaying(false);
      });
  }, []);

  const stopAll = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    // 진행 중이던 모든 재생 요청을 무효화 → 늦은 then/catch가 다시 상태를 켜지 못한다.
    requestIdRef.current += 1;
    audio.pause();
    audio.currentTime = 0;
    audio.src = '';
    trackRef.current = null;
    sequenceRef.current = false;
    setTrack(null);
    setSequence(false);
    setIsPlaying(false);
    setErrorState(null);
    setCurrent(0);
    setDuration(0);
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || trackRef.current === null) return;
    if (isPlaying) {
      // 일시정지도 이전 재생 시도를 무효화하고 pause한다.
      // stopAll과 달리 곡·재생 위치·이어 듣기 선택은 보존한다.
      requestIdRef.current += 1;
      audio.pause();
      return;
    }
    const reqId = ++requestIdRef.current;
    audio
      .play()
      .then(() => {
        if (reqId !== requestIdRef.current || !aliveRef.current) return;
        setErrorState(null);
      })
      .catch((err) => {
        if (reqId !== requestIdRef.current || !aliveRef.current) return;
        if (isAbortError(err)) return;
        setErrorState(isNotAllowedError(err) ? 'blocked' : 'failed');
        setIsPlaying(false);
      });
  }, [isPlaying]);

  const retryPlay = useCallback(() => {
    const audio = audioRef.current;
    const idx = trackRef.current;
    if (!audio || idx === null) return;
    const reqId = ++requestIdRef.current;
    // 로드 실패(네트워크·포맷)로 error 가 남은 엘리먼트는 play() 만으로 복구되지 않는다 → 같은 곡을 다시 로드한다.
    // 브라우저 차단(NotAllowedError)은 error 가 없으므로 재생 위치를 보존한 채 그대로 재생한다.
    if (audio.error) {
      setCurrent(0);
      setDuration(0);
      audio.src = TRACKS[idx].src;
    }
    audio
      .play()
      .then(() => {
        if (reqId !== requestIdRef.current || !aliveRef.current) return;
        setErrorState(null);
      })
      .catch((err) => {
        if (reqId !== requestIdRef.current || !aliveRef.current) return;
        if (isAbortError(err)) return;
        setErrorState(isNotAllowedError(err) ? 'blocked' : 'failed');
      });
  }, []);

  const selectTrack = (idx: number) => playTrack(idx, false);
  const selectSequence = () => playTrack(0, true);

  const progressPct = duration > 0 ? (current / duration) * 100 : 0;
  const hasSelection = track !== null;
  // 2026-09-26 대표 실기기 「0:00 / 0:00 — 어떻게 듣는지 모르겠다」: 곡을 고르기 전·불러오는 중을 시간 대신 글로 알린다(재생되는 척 0).
  const loading = hasSelection && !isPlaying && !errorState && duration === 0;
  const nowLabel = !hasSelection ? '듣고 싶은 곡을 눌러 주세요'
    : `${sequence ? `이어 듣기 · ${TRACKS[track].label}${track === 0 ? ' → 원음 2' : ' (마지막 곡)'}` : TRACKS[track].label}${loading ? ' · 불러오는 중' : isPlaying ? ' · 재생 중' : ' · 일시정지'}`;

  const versionBtnClass = (active: boolean) =>
    `inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
      active
        ? 'border-white/50 bg-white/20 text-white'
        : 'border-white/15 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white/85'
    }`;

  return (
    <div className="mt-5 w-full max-w-[480px] rounded-2xl border border-white/15 bg-black/45 px-4 py-4 text-left backdrop-blur-md">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/90">
            <i className="ri-music-2-fill text-base" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-white">DO IT 오리지널 음악</p>
            <p className="mt-0.5 text-[11px] text-white/55">먼저 한 걸음, DO IT.</p>
          </div>
        </div>
        {/* 음악 끄기 */}
        <button
          type="button"
          onClick={stopAll}
          disabled={!hasSelection}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ${
            hasSelection
              ? 'border-white/20 bg-white/5 text-white/75 hover:bg-white/15 hover:text-white cursor-pointer'
              : 'border-white/10 text-white/25 cursor-not-allowed'
          }`}
          aria-label="음악 끄기"
        >
          <i className="ri-stop-fill text-sm" />
        </button>
      </div>

      {/* 버전 선택 */}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => selectTrack(0)}
          className={versionBtnClass(track === 0 && !sequence)}
        >
          {TRACKS[0].label}
        </button>
        <button
          type="button"
          onClick={() => selectTrack(1)}
          className={versionBtnClass(track === 1 && !sequence)}
        >
          {TRACKS[1].label}
        </button>
        <button
          type="button"
          onClick={selectSequence}
          className={versionBtnClass(sequence)}
        >
          이어 듣기
        </button>
      </div>

      {/* 재생 컨트롤 + 실제 진행 시간 */}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!hasSelection}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ${
            hasSelection
              ? 'border-white/30 bg-white/10 text-white hover:bg-white/20 cursor-pointer'
              : 'border-white/10 text-white/25 cursor-not-allowed'
          }`}
          aria-label={isPlaying ? '일시정지' : '재생'}
        >
          <i className={isPlaying ? 'ri-pause-fill text-base' : 'ri-play-fill text-base'} />
        </button>

        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white/70 transition-[width] duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <span className="text-[11px] tabular-nums text-white/60 whitespace-nowrap">
          {hasSelection && duration > 0 ? `${formatTime(current)} / ${formatTime(duration)}` : '-:-- / -:--'}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-white/70" aria-live="polite">{nowLabel}</p>

      {/* 재생 오류 안내 (원인별 구분) */}
      {errorState && (
        <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200/90">
          <i className="ri-information-line text-sm" />
          <span className="flex-1 leading-snug">
            {errorState === 'blocked'
              ? '브라우저가 재생을 막았어요. 재생 버튼을 눌러주세요.'
              : '음원을 재생하지 못했어요. 다시 시도해 주세요.'}
          </span>
          <button
            type="button"
            onClick={retryPlay}
            className="rounded-full border border-amber-200/40 px-2.5 py-1 text-[11px] text-amber-100 hover:bg-amber-200/10 cursor-pointer whitespace-nowrap"
          >
            다시 재생
          </button>
        </div>
      )}
    </div>
  );
}