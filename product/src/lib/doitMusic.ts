// DO IT 오리지널 음악 — 지금 가진 실제 음원 2곡(저장소 밖 Readdy 저장소 주소). 파일은 지우지 않는다.
// 2026-09-26 대표 「DO IT MUSIC · MVP FINAL LOCK」: 첫 화면의 일반 음악 플레이어(원음 1·원음 2·이어 듣기)는 내리고,
// 「ECHO가 이해한 나」를 [맞아요]로 확인한 뒤 한 번 만나는 작은 카드(MusicMoment)로 옮겼다.
// 성별 확인 전이므로 「원음 1 / 원음 2」로만 부른다. 파일 순서로 성별을 추정하지 않는다.
export const DOIT_TRACKS = [
  { id: 'origin-1', label: '원음 1', src: 'https://storage.helloreaddy.io/project_files/3af9018b-0984-400b-9a04-099fb48dbecd/80bd6071-35bc-4ca9-898c-cc7f3d8adc51_65f5bc59-e582-437a-97af-88cc38b6d259.mp3' },
  { id: 'origin-2', label: '원음 2', src: 'https://storage.helloreaddy.io/project_files/3af9018b-0984-400b-9a04-099fb48dbecd/7bd42734-8e58-4474-8eed-08f21c108a30_02c258b7-43c4-40c2-b6f1-ac72d7d5be8d.mp3' },
] as const;

// Music Moment 에서 들려줄 곡. 대표가 「대표 음악」을 아직 지정하지 않아 첫 곡(원음 1)을 둔다 — 대표 확인 필요.
// 「핵심 구간」 시작·끝도 대표 승인 전이라 임의로 자르지 않는다(누를 때만 처음부터 재생 · 언제든 멈춤).
export const MOMENT_TRACK = DOIT_TRACKS[0];

// 대표가 직접 쓴 실제 가사 한 줄. 저장소·문서·자산 어디에도 가사 원문이 없어 비워 둔다(MISSING · AI 로 만들지 않는다).
export const MOMENT_LYRIC: string | null = null;
