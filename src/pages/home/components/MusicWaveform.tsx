import { useRef, useEffect } from 'react';

// ───────────────────────────────────────────────
// ECHO 음파 파동 시각화
// 참고 이미지: 푸른 음파 파동, 중앙 2개 높은 파, 좌우로 퍼지는 점
// 디자인팀 수정 가이드: 아래 WAVE_* 상수만 수정하면 전체 스타일 변경 가능
// ───────────────────────────────────────────────

const WAVE_COLOR_R = 140;
const WAVE_COLOR_G = 190;
const WAVE_COLOR_B = 255;
const WAVE_GLOW_BLUR = 10;
const WAVE_ITEM_COUNT = 56; // 총 점/바 개수
const WAVE_ITEM_GAP = 3.5; // 항목 간격(px)
const WAVE_BASE_HEIGHT = 4; // 기본 높이
const WAVE_CENTER_HEIGHT = 48; // 중앙 최대 높이
const WAVE_CENTER_WIDTH = 5; // 중앙 바 너비
const WAVE_EDGE_WIDTH = 2; // 가장자리 점 너비
const WAVE_ANIMATION_SPEED = 0.06; // 재생 중 애니메이션 속도
const WAVE_IDLE_SPEED = 0.015; // 멈춤 상태 속도

interface MusicWaveformProps {
  musicPlaying: boolean;
  isDarkMode: boolean;
  onClick?: () => void;
}

export default function MusicWaveform({ musicPlaying, isDarkMode, onClick }: MusicWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const centerX = w / 2;
      const centerY = h / 2;

      ctx.clearRect(0, 0, w, h);

      // 시간 진행
      timeRef.current += musicPlaying ? WAVE_ANIMATION_SPEED : WAVE_IDLE_SPEED;

      const totalItems = WAVE_ITEM_COUNT;
      const halfItems = totalItems / 2;
      const totalWidth = totalItems * WAVE_ITEM_GAP;
      const startX = centerX - totalWidth / 2;

      for (let i = 0; i < totalItems; i++) {
        const offset = i - halfItems;
        const x = startX + i * WAVE_ITEM_GAP;

        // 중앙 거리 (0 = 중앙, 1 = 가장자리)
        const dist = Math.abs(offset) / halfItems;
        const centerFactor = Math.max(0, Math.exp(-dist * dist * 3.5));

        // 높이 계산
        let height: number;
        if (musicPlaying) {
          const wave1 = Math.sin(timeRef.current * 2.2 + i * 0.35) * 0.5;
          const wave2 = Math.cos(timeRef.current * 1.6 + i * 0.55) * 0.3;
          const wave3 = Math.sin(timeRef.current * 3.5 + i * 0.12) * 0.2;
          const noise = Math.random() * 0.12;
          const combined = wave1 + wave2 + wave3 + noise;
          height = WAVE_BASE_HEIGHT + Math.abs(combined) * (WAVE_CENTER_HEIGHT * 0.55) + centerFactor * WAVE_CENTER_HEIGHT * 0.45;
          height *= Math.max(0.4, 1 - dist * 0.4); // 가장자리 살짝 줄이기
        } else {
          const idleWave = Math.sin(timeRef.current + i * 0.25) * 0.5;
          height = (WAVE_BASE_HEIGHT * 0.5 + Math.abs(idleWave) * 2 + centerFactor * 3) * Math.max(0.5, 1 - dist * 0.3);
        }

        // 너비: 중앙이 좁고, 멀어질수록 점처럼
        const itemWidth = WAVE_EDGE_WIDTH + (WAVE_CENTER_WIDTH - WAVE_EDGE_WIDTH) * centerFactor;

        // 투명도: 중앙이 선명, 멀어질수록 흐릿
        const alpha = 0.15 + centerFactor * 0.85;

        // 색상: 중앙이 밝고 푸른, 멀어질수록 흐릿
        const r = Math.round(WAVE_COLOR_R + centerFactor * 60);
        const g = Math.round(WAVE_COLOR_G + centerFactor * 65);
        const b = Math.round(WAVE_COLOR_B);
        const color = `rgba(${r},${g},${b},${alpha})`;
        const glowColor = `rgba(${r},${g},${b},${0.3 + centerFactor * 0.5})`;

        // Glow 효과
        ctx.shadowBlur = musicPlaying ? WAVE_GLOW_BLUR + centerFactor * 14 : WAVE_GLOW_BLUR * 0.5;
        ctx.shadowColor = glowColor;

        // 둥근 바/점 그리기
        ctx.fillStyle = color;
        const halfH = height / 2;
        const radius = itemWidth / 2;

        ctx.beginPath();
        ctx.roundRect(x - itemWidth / 2, centerY - halfH, itemWidth, height, radius);
        ctx.fill();
      }

      // 가운데 기준선 (아주 흐릿하게)
      ctx.shadowBlur = 0;
      ctx.strokeStyle = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(centerX - totalWidth / 2, centerY);
      ctx.lineTo(centerX + totalWidth / 2, centerY);
      ctx.stroke();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
      ro.disconnect();
    };
  }, [musicPlaying, isDarkMode]);

  return (
    <canvas
      ref={canvasRef}
      onClick={onClick}
      className="cursor-pointer w-full h-full block"
      style={{ touchAction: 'none' }}
      aria-label="음악 파동 시각화"
      role="button"
    />
  );
}