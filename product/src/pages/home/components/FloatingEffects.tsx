import { useState, useEffect } from 'react';

export default function FloatingEffects() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // === 1. 별똥별 — 은색 트레일 x15 ===
  const shootingStars = [
    { top: '2%', left: '5%', delay: '0s', duration: '2.8s' },
    { top: '8%', left: '25%', delay: '1.2s', duration: '3.2s' },
    { top: '12%', left: '60%', delay: '0.6s', duration: '2.5s' },
    { top: '5%', left: '80%', delay: '2.1s', duration: '3.0s' },
    { top: '18%', left: '40%', delay: '3.5s', duration: '2.7s' },
    { top: '3%', left: '90%', delay: '1.8s', duration: '3.4s' },
    { top: '22%', left: '15%', delay: '4.2s', duration: '2.9s' },
    { top: '10%', left: '50%', delay: '0.3s', duration: '3.1s' },
    { top: '28%', left: '70%', delay: '5.0s', duration: '2.6s' },
    { top: '6%', left: '35%', delay: '2.7s', duration: '3.3s' },
    { top: '15%', left: '85%', delay: '3.8s', duration: '2.4s' },
    { top: '35%', left: '10%', delay: '1.0s', duration: '3.5s' },
    { top: '40%', left: '55%', delay: '4.5s', duration: '2.8s' },
    { top: '1%', left: '65%', delay: '2.3s', duration: '3.6s' },
    { top: '30%', left: '45%', delay: '5.5s', duration: '3.0s' },
  ];

  // === 2. 둥실둥실 구름 — 흰색 반투명 x12 ===
  const clouds = [
    { top: '5%', left: '-8%', scale: 1.3, delay: '0s', duration: '38s' },
    { top: '15%', right: '-10%', scale: 1.0, delay: '5s', duration: '45s' },
    { top: '30%', left: '2%', scale: 0.8, delay: '12s', duration: '40s' },
    { top: '45%', right: '3%', scale: 1.2, delay: '3s', duration: '42s' },
    { top: '60%', left: '8%', scale: 1.1, delay: '18s', duration: '36s' },
    { top: '75%', right: '-5%', scale: 0.9, delay: '7s', duration: '48s' },
    { top: '20%', left: '55%', scale: 0.7, delay: '22s', duration: '35s' },
    { top: '50%', left: '35%', scale: 1.4, delay: '9s', duration: '44s' },
    { top: '85%', left: '15%', scale: 1.0, delay: '14s', duration: '50s' },
    { top: '8%', left: '70%', scale: 0.8, delay: '25s', duration: '38s' },
    { top: '65%', right: '20%', scale: 1.2, delay: '1s', duration: '46s' },
    { top: '40%', left: '78%', scale: 0.6, delay: '16s', duration: '34s' },
  ];

  // === 3. 반짝이는 별들 — 은색/금색 x25 ===
  const twinkles = [
    { top: '5%', left: '10%', size: 2, delay: '0s', duration: '2s' },
    { top: '12%', left: '85%', size: 3, delay: '0.3s', duration: '3s' },
    { top: '18%', left: '30%', size: 2, delay: '0.7s', duration: '2.5s' },
    { top: '25%', left: '65%', size: 2, delay: '1.1s', duration: '2s' },
    { top: '32%', left: '15%', size: 3, delay: '1.5s', duration: '3s' },
    { top: '38%', left: '80%', size: 2, delay: '1.9s', duration: '2.5s' },
    { top: '45%', left: '45%', size: 2, delay: '2.3s', duration: '2s' },
    { top: '52%', left: '90%', size: 3, delay: '0.5s', duration: '3.5s' },
    { top: '58%', left: '25%', size: 2, delay: '2.7s', duration: '2.8s' },
    { top: '65%', left: '70%', size: 2, delay: '3.1s', duration: '2.2s' },
    { top: '72%', left: '5%', size: 3, delay: '0.9s', duration: '3s' },
    { top: '78%', left: '55%', size: 2, delay: '3.5s', duration: '2.4s' },
    { top: '85%', left: '35%', size: 2, delay: '1.3s', duration: '2.6s' },
    { top: '92%', left: '75%', size: 3, delay: '3.9s', duration: '3.2s' },
    { top: '8%', left: '50%', size: 2, delay: '2.1s', duration: '2.1s' },
    { top: '22%', left: '95%', size: 2, delay: '4.3s', duration: '2.7s' },
    { top: '48%', left: '8%', size: 3, delay: '1.7s', duration: '3.3s' },
    { top: '68%', left: '40%', size: 2, delay: '4.7s', duration: '2.3s' },
    { top: '15%', left: '20%', size: 2, delay: '5.1s', duration: '2.9s' },
    { top: '55%', left: '60%', size: 3, delay: '5.5s', duration: '3.1s' },
    { top: '82%', left: '88%', size: 2, delay: '2.9s', duration: '2.5s' },
    { top: '35%', left: '78%', size: 2, delay: '5.9s', duration: '2.0s' },
    { top: '90%', left: '18%', size: 3, delay: '3.3s', duration: '3.4s' },
    { top: '42%', left: '92%', size: 2, delay: '6.3s', duration: '2.6s' },
    { top: '2%', left: '42%', size: 2, delay: '4.1s', duration: '2.8s' },
  ];

  // === 4. 금빛 입자 파티클 x30 ===
  const particles = [
    { left: '5%', delay: '0s', duration: '12s', size: 2 },
    { left: '12%', delay: '2s', duration: '15s', size: 3 },
    { left: '20%', delay: '4s', duration: '10s', size: 2 },
    { left: '28%', delay: '1s', duration: '18s', size: 2 },
    { left: '35%', delay: '6s', duration: '14s', size: 3 },
    { left: '42%', delay: '3s', duration: '11s', size: 2 },
    { left: '48%', delay: '8s', duration: '16s', size: 2 },
    { left: '55%', delay: '5s', duration: '13s', size: 3 },
    { left: '62%', delay: '10s', duration: '17s', size: 2 },
    { left: '68%', delay: '2.5s', duration: '12s', size: 2 },
    { left: '75%', delay: '7s', duration: '19s', size: 3 },
    { left: '82%', delay: '4.5s', duration: '14s', size: 2 },
    { left: '88%', delay: '9s', duration: '11s', size: 2 },
    { left: '95%', delay: '1.5s', duration: '15s', size: 3 },
    { left: '15%', delay: '11s', duration: '13s', size: 2 },
    { left: '25%', delay: '13s', duration: '16s', size: 2 },
    { left: '33%', delay: '5.5s', duration: '10s', size: 3 },
    { left: '40%', delay: '14s', duration: '18s', size: 2 },
    { left: '50%', delay: '7.5s', duration: '12s', size: 2 },
    { left: '58%', delay: '3.5s', duration: '14s', size: 3 },
    { left: '65%', delay: '9.5s', duration: '17s', size: 2 },
    { left: '72%', delay: '11.5s', duration: '11s', size: 2 },
    { left: '78%', delay: '6.5s', duration: '15s', size: 3 },
    { left: '85%', delay: '8.5s', duration: '13s', size: 2 },
    { left: '92%', delay: '10.5s', duration: '16s', size: 2 },
    { left: '8%', delay: '12.5s', duration: '14s', size: 3 },
    { left: '18%', delay: '4.5s', duration: '18s', size: 2 },
    { left: '45%', delay: '6.5s', duration: '12s', size: 2 },
    { left: '52%', delay: '8.5s', duration: '15s', size: 3 },
    { left: '60%', delay: '2s', duration: '17s', size: 2 },
  ];

  // === 5. 유리 구슬 오브 x6 (3D 입체) ===
  const orbs = [
    { top: '10%', left: '15%', size: '50px', delay: '0s', duration: '16s', hue: '200' },
    { top: '30%', left: '80%', size: '40px', delay: '4s', duration: '20s', hue: '150' },
    { top: '55%', left: '10%', size: '60px', delay: '8s', duration: '18s', hue: '320' },
    { top: '70%', left: '75%', size: '45px', delay: '2s', duration: '22s', hue: '30' },
    { top: '20%', left: '50%', size: '35px', delay: '12s', duration: '15s', hue: '180' },
    { top: '85%', left: '35%', size: '55px', delay: '6s', duration: '19s', hue: '260' },
  ];

  // === 6. 빛 기둥 빔 x4 ===
  const lightBeams = [
    { left: '15%', delay: '0s', duration: '10s', width: '60px' },
    { left: '45%', delay: '3s', duration: '12s', width: '80px' },
    { left: '70%', delay: '6s', duration: '11s', width: '50px' },
    { left: '88%', delay: '1.5s', duration: '13s', width: '70px' },
  ];

  // === 7. 물결 링 x3 ===
  const ripples = [
    { left: '20%', bottom: '10%', delay: '0s', duration: '6s' },
    { left: '50%', bottom: '5%', delay: '2s', duration: '8s' },
    { left: '75%', bottom: '15%', delay: '4s', duration: '7s' },
  ];

  // === 8. 폭죽 불꽃 x5 ===
  const fireworks = [
    { top: '10%', left: '30%', delay: '0s' },
    { top: '25%', left: '70%', delay: '3s' },
    { top: '40%', left: '20%', delay: '6s' },
    { top: '60%', left: '80%', delay: '9s' },
    { top: '75%', left: '45%', delay: '12s' },
  ];

  return (
    <div className="fixed inset-0 z-[1] pointer-events-none overflow-hidden">

      {/* === 무지개 아크 === */}
      <div
        className={`absolute ${isMobile ? 'hidden' : ''}`}
        style={{
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          // 2026-09-16 반응형 수정: 140vw 대신 부모(fixed inset-0 = 화면) 기준 140%. 비율은 2:1 로 동일.
          width: '140%',
          aspectRatio: '2 / 1',
          borderRadius: '50%',
          background: 'conic-gradient(from 180deg at 50% 100%, transparent 0deg, rgba(255,180,180,0.05) 30deg, rgba(255,230,150,0.05) 60deg, rgba(160,255,200,0.05) 90deg, rgba(160,220,255,0.05) 120deg, rgba(210,180,255,0.05) 150deg, transparent 180deg)',
          // filter: blur(50px) 제거(Android GPU 블러 잘림 원인). 가장자리는 마스크로 투명하게 사라지게 한다.
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 100%, black 40%, transparent 72%)',
          maskImage: 'radial-gradient(ellipse at 50% 100%, black 40%, transparent 72%)',
          animation: 'rainbow-sweep 14s ease-in-out infinite',
        }}
      />

      {/* === 빛 기둥 빔 === */}
      {(isMobile ? lightBeams.slice(0, 2) : lightBeams).map((beam, i) => (
        <div
          key={`beam-${i}`}
          className="absolute"
          style={{
            left: beam.left,
            top: '-10%',
            width: beam.width,
            height: '120%',
            // 2026-09-16 반응형 수정: filter: blur(20px) 제거. 세로 방향 밝기는 그대로 두고
            // 가로 가장자리를 타원 그라디언트로 투명하게 만들어 같은 "빛 기둥" 느낌을 낸다.
            background: 'radial-gradient(ellipse 50% 50% at 50% 45%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 45%, transparent 100%)',
            animation: `light-beam-sway ${beam.duration} ease-in-out infinite`,
            animationDelay: beam.delay,
            transformOrigin: 'top center',
          }}
        />
      ))}

      {/* === 유리 구슬 오브 (3D 입체) === */}
      {(isMobile ? orbs.slice(0, 3) : orbs).map((orb, i) => (
        <div
          key={`orb-${i}`}
          className="absolute"
          style={{
            top: orb.top,
            left: orb.left,
            width: orb.size,
            height: orb.size,
            borderRadius: '50%',
            background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.05) 40%, transparent 70%), radial-gradient(circle at center, hsla(${orb.hue}, 70%, 75%, 0.12) 0%, transparent 60%)`,
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: `inset -5px -5px 15px rgba(255,255,255,0.1), 0 0 ${parseInt(orb.size) * 0.6}px hsla(${orb.hue}, 60%, 70%, 0.15)`,
            animation: `orb-float-3d ${orb.duration} ease-in-out infinite`,
            animationDelay: orb.delay,
            // 2026-09-16 반응형 수정: backdrop-filter 제거(Android 에서 뒤 배경 샘플링 시 사각 잔상 위험).
            // 구슬 자체의 그라디언트·테두리·그림자는 그대로다.
            perspective: '800px',
          }}
        >
          {/* 하이라이트 반짝임 */}
          <div
            className="absolute rounded-full"
            style={{
              top: '15%',
              left: '20%',
              width: '25%',
              height: '20%',
              background: 'radial-gradient(ellipse, rgba(255,255,255,0.5) 0%, transparent 70%)',
            }}
          />
        </div>
      ))}

      {/* === 구름 둥실둥실 x12 === */}
      {(isMobile ? clouds.slice(0, 5) : clouds).map((cloud, i) => (
        <div
          key={`cloud-${i}`}
          className="absolute"
          style={{
            top: cloud.top,
            left: cloud.left,
            right: cloud.right,
            transform: `scale(${cloud.scale})`,
            animation: `cloud-float ${cloud.duration} ease-in-out infinite`,
            animationDelay: cloud.delay,
          }}
        >
          {/* 2026-09-16 반응형 수정: 구름 조각의 filter: blur 를 제거하고 같은 밝기의 타원 그라디언트로 번짐을 표현한다. */}
          <div className="relative" style={{ width: '220px', height: '90px' }}>
            <div className="absolute rounded-full" style={{ width: '110px', height: '65px', background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.07) 0%, transparent 70%)', top: '12px', left: '25px' }} />
            <div className="absolute rounded-full" style={{ width: '90px', height: '55px', background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.05) 0%, transparent 70%)', top: '8px', left: '70px' }} />
            <div className="absolute rounded-full" style={{ width: '70px', height: '45px', background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.04) 0%, transparent 70%)', top: '22px', left: '5px' }} />
            <div className="absolute rounded-full" style={{ width: '50px', height: '35px', background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, transparent 70%)', top: '5px', left: '120px' }} />
          </div>
        </div>
      ))}

      {/* === 금빛 입자 파티클 x30 === */}
      {(isMobile ? particles.slice(0, 12) : particles).map((p, i) => (
        <div
          key={`particle-${i}`}
          className="absolute"
          style={{
            left: p.left,
            top: '-20px',
            width: `${p.size}px`,
            height: `${p.size}px`,
            borderRadius: '50%',
            background: i % 3 === 0
              ? 'radial-gradient(circle, rgba(255,220,150,0.7) 0%, transparent 70%)'
              : i % 3 === 1
                ? 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(200,240,255,0.6) 0%, transparent 70%)',
            boxShadow: `0 0 ${p.size * 3}px ${p.size}px ${i % 3 === 0 ? 'rgba(255,220,150,0.3)' : i % 3 === 1 ? 'rgba(255,255,255,0.25)' : 'rgba(200,240,255,0.25)'}`,
            animation: `particle-fall ${p.duration} linear infinite`,
            animationDelay: p.delay,
          }}
        />
      ))}

      {/* === 반짝이는 별 x25 === */}
      {(isMobile ? twinkles.slice(0, 10) : twinkles).map((star, i) => (
        <div
          key={`star-${i}`}
          className="absolute"
          style={{
            top: star.top,
            left: star.left,
            width: `${star.size * 2.5}px`,
            height: `${star.size * 2.5}px`,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 70%)',
            boxShadow: `0 0 ${star.size * 5}px ${star.size * 1.5}px ${i % 2 === 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,230,180,0.3)'}`,
            animation: `twinkle ${star.duration} ease-in-out infinite`,
            animationDelay: star.delay,
          }}
        />
      ))}

      {/* === 별똥별 x15 === */}
      {(isMobile ? shootingStars.slice(0, 6) : shootingStars).map((s, i) => (
        <div
          key={`shooting-${i}`}
          className="absolute"
          style={{
            top: s.top,
            left: s.left,
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            background: 'white',
            boxShadow: '0 0 8px 3px rgba(255,255,255,0.9), 0 0 16px 6px rgba(220,230,255,0.5)',
            animation: `shooting-star-trail ${s.duration} linear infinite`,
            animationDelay: s.delay,
          }}
        >
          <div
            className="absolute"
            style={{
              top: '50%',
              right: '0',
              width: '100px',
              height: '1.5px',
              background: 'linear-gradient(to right, rgba(255,255,255,0.9), rgba(255,255,255,0.3), transparent)',
              transform: 'translateY(-50%) rotate(-35deg)',
              transformOrigin: 'right center',
            }}
          />
        </div>
      ))}

      {/* === 물결 링 x3 === */}
      {(isMobile ? ripples.slice(0, 2) : ripples).map((r, i) => (
        <div
          key={`ripple-${i}`}
          className="absolute"
          style={{
            left: r.left,
            bottom: r.bottom,
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '1.5px solid rgba(255,255,255,0.12)',
            animation: `ripple-expand ${r.duration} ease-out infinite`,
            animationDelay: r.delay,
          }}
        />
      ))}

      {/* === 폭죽 불꽃 x5 === */}
      {(isMobile ? fireworks.slice(0, 3) : fireworks).map((fw, i) => (
        <div
          key={`firework-${i}`}
          className="absolute"
          style={{
            top: fw.top,
            left: fw.left,
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'white',
            boxShadow: '0 0 10px 4px rgba(255,255,255,0.8)',
            animation: `firework-pop 4s ease-out infinite`,
            animationDelay: fw.delay,
          }}
        >
          {/* 불꽃 트레일 점들 */}
          {[...Array(8)].map((_, j) => (
            <div
              key={j}
              className="absolute rounded-full"
              style={{
                width: '3px',
                height: '3px',
                background: j % 3 === 0 ? 'rgba(255,200,150,0.8)' : j % 3 === 1 ? 'rgba(200,230,255,0.8)' : 'rgba(255,255,255,0.8)',
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) rotate(${j * 45}deg) translateX(20px)`,
                animation: `firework-spark 4s ease-out infinite`,
                animationDelay: `${parseFloat(fw.delay) + 0.1}s`,
              }}
            />
          ))}
        </div>
      ))}

    </div>
  );
}