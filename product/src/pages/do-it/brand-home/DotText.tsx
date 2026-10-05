// 2026-10-05 대표 「JUST TRY 는 두번째 이미지처럼 점박으로」: 빛나는 둥근 점으로 찍은 글자(5×7 점 글꼴). 그림 파일 없이 점(circle)만 그린다.
// 지원 글자 = 회사 슬로건에 쓰는 것만(J·U·S·T·R·Y·마침표·띄어쓰기). 없는 글자는 빈칸.
const GLYPHS: Record<string, string[]> = {
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  '.': ['0', '0', '0', '0', '0', '0', '1'],
  ' ': ['00', '00', '00', '00', '00', '00', '00'],
};

export default function DotText({ text, className }: { text: string; className?: string }) {
  const dots: Array<[number, number]> = [];
  let x = 0;
  for (const ch of text.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS[' '];
    g.forEach((row, y) => [...row].forEach((on, c) => { if (on === '1') dots.push([x + c, y]); }));
    x += g[0].length + 1;
  }
  const width = Math.max(1, x - 1);
  return (
    <svg className={className} viewBox={`-0.5 -0.5 ${width} 7`} role="img" aria-label={text}>
      {dots.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.4" />)}
    </svg>
  );
}
