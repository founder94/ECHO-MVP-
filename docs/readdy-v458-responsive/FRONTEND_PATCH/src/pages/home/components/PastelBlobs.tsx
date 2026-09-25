export default function PastelBlobs() {
  const blobs = [
    {
      color: 'rgba(160, 255, 200, 0.15)',
      size: '28rem',
      top: '-8%',
      left: '-6%',
      delay: '0s',
      duration: '24s',
    },
    {
      color: 'rgba(160, 220, 255, 0.12)',
      size: '24rem',
      top: '15%',
      right: '-5%',
      delay: '6s',
      duration: '30s',
    },
    {
      color: 'rgba(255, 235, 160, 0.10)',
      size: '30rem',
      bottom: '5%',
      left: '10%',
      delay: '12s',
      duration: '26s',
    },
    {
      color: 'rgba(255, 180, 180, 0.12)',
      size: '20rem',
      top: '45%',
      right: '15%',
      delay: '3s',
      duration: '22s',
    },
    {
      color: 'rgba(160, 255, 220, 0.10)',
      size: '26rem',
      bottom: '-8%',
      right: '-4%',
      delay: '9s',
      duration: '28s',
    },
    {
      color: 'rgba(200, 230, 255, 0.08)',
      size: '32rem',
      bottom: '25%',
      left: '-8%',
      delay: '4s',
      duration: '32s',
    },
  ];

  return (
    <div className="fixed inset-0 z-[1] pointer-events-none overflow-hidden">
      {blobs.map((blob, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-blob-float"
          style={{
            // 2026-09-16 반응형 수정: 큰 원에 filter: blur(100px) 를 걸면 Android Chrome(GPU 합성)에서
            // 블러 레이어가 사각형 타일 경계에서 잘려 "직각으로 끊긴 초록 배경"으로 보인다.
            // 같은 색·크기·위치·애니메이션을 유지하고, 번짐은 필터 대신 투명으로 사라지는 radial-gradient 로 표현한다.
            background: `radial-gradient(circle at center, ${blob.color} 0%, ${blob.color} 18%, transparent 70%)`,
            width: blob.size,
            height: blob.size,
            top: blob.top,
            left: blob.left,
            right: blob.right,
            bottom: blob.bottom,
            animationDelay: blob.delay,
            animationDuration: blob.duration,
          }}
        />
      ))}
    </div>
  );
}