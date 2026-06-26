import { useRef, useState, useEffect, useCallback } from 'react';

// ───────────────────────────────────────────────
// ECHO 음악 플레이어 훅
// 20분(1200초)부터 시작, 반복 재생, 끊김 없이
// 디자인팀 수정 가이드: 아래 상수만 건드리면 됨
// ───────────────────────────────────────────────
const START_TIME = 1200; // 20분 (초)
const VOLUME = 45;
const VIDEO_ID = 'MiAsgo9k0RM';

export function useMusicPlayer() {
  const playerRef = useRef<any>(null);
  const playerReadyRef = useRef(false);
  const audioStartedRef = useRef(false);
  const [musicPlaying, setMusicPlaying] = useState(false);

  const tryStart = () => {
    if (audioStartedRef.current || !playerReadyRef.current || !playerRef.current) return;
    try {
      playerRef.current.seekTo(START_TIME, true);
      playerRef.current.setVolume(VOLUME);
      playerRef.current.playVideo();
      audioStartedRef.current = true;
      setMusicPlaying(true);
    } catch {
      audioStartedRef.current = false;
    }
  };

  useEffect(() => {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);

    (window as any).onYouTubeIframeAPIReady = () => {
      playerRef.current = new (window as any).YT.Player('youtube-audio-player', {
        height: '0',
        width: '0',
        videoId: VIDEO_ID,
        playerVars: {
          autoplay: 0,
          controls: 0,
          showinfo: 0,
          rel: 0,
          modestbranding: 1,
          start: START_TIME,
        },
        events: {
          onReady: () => {
            playerReadyRef.current = true;
            tryStart();
          },
          onStateChange: (event: any) => {
            if (event.data === 1) {
              // PLAYING
              audioStartedRef.current = true;
              setMusicPlaying(true);
            } else if (event.data === 0) {
              // ENDED — 반복 재생
              try {
                playerRef.current?.seekTo(START_TIME, true);
                playerRef.current?.playVideo();
              } catch {
                /* noop */
              }
            } else if (event.data === 2) {
              // PAUSED
              setMusicPlaying(false);
            }
          },
        },
      });
    };

    return () => {
      delete (window as any).onYouTubeIframeAPIReady;
    };
  }, []);

  useEffect(() => {
    const onScroll = () => tryStart();
    const onClick = () => tryStart();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('click', onClick);
    };
  }, []);

  const toggleMusic = useCallback(() => {
    if (!playerRef.current) return;
    if (musicPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.seekTo(START_TIME, true);
      playerRef.current.setVolume(VOLUME);
      playerRef.current.playVideo();
    }
  }, [musicPlaying]);

  return { musicPlaying, toggleMusic };
}