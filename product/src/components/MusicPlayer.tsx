import { useState, useEffect, useRef, useCallback } from 'react';

// YouTube IFrame API 타입
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | null;
  }
}

const VIDEO_ID = 'MiAsgo9k0RM';
const START_SECONDS = 1200; // 20분
const DEFAULT_VOLUME = 25; // 잔잔하게

function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }
    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (existingScript) {
      const originalCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        originalCallback?.();
        resolve();
      };
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    window.onYouTubeIframeAPIReady = () => {
      resolve();
    };
  });
}

export default function MusicPlayer() {
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef<any>(null);

  // YouTube Player 초기화
  useEffect(() => {
    let destroyed = false;

    const initPlayer = async () => {
      try {
        await loadYouTubeAPI();
        if (destroyed) return;

        const player = new window.YT.Player('youtube-music-player', {
          videoId: VIDEO_ID,
          playerVars: {
            autoplay: 1,
            controls: 0,
            start: START_SECONDS,
            mute: 0,
            loop: 1,
            playlist: VIDEO_ID,
            playsinline: 1,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            iv_load_policy: 3,
          },
          events: {
            onReady: (event: any) => {
              if (destroyed) return;
              playerRef.current = event.target;
              setPlayerReady(true);
              event.target.unMute();
              event.target.setVolume(DEFAULT_VOLUME);
              event.target.playVideo();
            },
            onStateChange: (event: any) => {
              if (destroyed) return;
              // YT.PlayerState.PLAYING = 1, PAUSED = 2
              if (event.data === 1) {
                setIsPlaying(true);
              } else if (event.data === 2 || event.data === 0) {
                setIsPlaying(false);
              }
            },
          },
        });
      } catch {
        // YouTube API 로드 실패 시 조용히 넘어감
      }
    };

    initPlayer();

    return () => {
      destroyed = true;
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
      }
    };
  }, []);

  const toggleMusic = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;

    if (isPlaying) {
      player.pauseVideo();
    } else {
      player.seekTo(START_SECONDS);
      player.unMute();
      player.setVolume(DEFAULT_VOLUME);
      player.playVideo();
    }
  }, [isPlaying]);

  return (
    <>
      {/* 숨겨진 YouTube player container */}
      <div id="youtube-music-player" className="absolute -left-[9999px] -top-[9999px] w-0 h-0 opacity-0 pointer-events-none" />

      {/* 플로팅 음악 토글 버튼 */}
      <div className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-6 z-[100] flex flex-col items-start gap-2">
        {/* 토글 버튼 */}
        <button
          type="button"
          onClick={toggleMusic}
          className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all duration-300 cursor-pointer shadow-lg backdrop-blur-sm ${
            isPlaying
              ? 'bg-pink-500/90 border-pink-400 text-white scale-100 animate-pulse'
              : 'bg-pink-300/60 border-pink-300/40 text-pink-700 hover:bg-pink-400/80 hover:text-white'
          }`}
          aria-label={isPlaying ? '음악 끄기' : '음악 켜기'}
        >
          {isPlaying ? (
            <i className="ri-music-fill text-base" />
          ) : (
            <i className="ri-music-line text-base" />
          )}
        </button>

        {/* 사운드 웨이브 인디케이터 (재생 중일 때만) */}
        {isPlaying && (
          <div className="flex items-center gap-[2px] h-4">
            <span className="w-[2px] h-2 bg-pink-400 rounded-full animate-pulse" style={{ animationDuration: '0.6s' }} />
            <span className="w-[2px] h-3 bg-pink-400 rounded-full animate-pulse" style={{ animationDuration: '0.5s', animationDelay: '0.1s' }} />
            <span className="w-[2px] h-2 bg-pink-400 rounded-full animate-pulse" style={{ animationDuration: '0.7s', animationDelay: '0.2s' }} />
          </div>
        )}
      </div>
    </>
  );
}