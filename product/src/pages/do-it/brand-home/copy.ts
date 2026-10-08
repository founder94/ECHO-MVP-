// 홈페이지 승인 문구(2026-10-05 대표 시안 원문 그대로). 2026-10-08 대표 「GetLayers 코드 그대로 쓰고 거기에 글만 넣어」 → 그림·색·글씨체·3D 는 src/vesper 원본, 글은 이 파일.
export const START_PATH = '/doit/start-journey';

export const BRAND_HOME_COPY = {
  eyebrow: 'ECHO · ONLINE SERENDIPITY',
  heroTitle: ['당신이 잠든 사이,', 'AI가 먼저 만나봅니다.'],
  heroLine: ['오늘의 나를 남겨두세요.', '내일, 뜻밖의 연결이 기다립니다.'],
  // 시안의 「사주 또는 타로로 가볍게 시작해요」는 시작 흐름(목적 고르기 → 대화)과 맞지 않아 지금 되는 일만 적는다(옛 홈페이지 승인 문장).
  heroNote: '지금은 당신의 이야기를 듣는 데서 시작합니다.',
  companyLead: ['대화로 시작하는 만남을', '만듭니다.'],
  start: '모바일로 시작하기',
  install: '웹 설치하기',
  storyTitle: ['잘 쓴 소개보다,', '함께한 시간이 궁금해서.'],
  storyLead: '아홉 장면 중 하나를 눌러 열어 보세요.',
  // 2026-10-05 PM 보강: 히어로 「내일, 뜻밖의 연결이 기다립니다.」는 승인 원문이라 그대로 두고, 지금 되는 범위를 한 줄로. 내일·자동·알림·후보 보장 말 0.
  scope: '지금 ECHO에서는 이야기를 나누고 소개와 사진을 준비하면, 지금 보여 드릴 사람이 있는지 확인할 수 있어요. 서로 원할 때만 다음 단계가 열려요.',
} as const;

// 옛 홈페이지(우주인 이야기 9장면)의 승인 문구·사진·순서 그대로.
export type Story = { no: string; label: string; title: [string, string]; body: [string, string]; img: string; pos: 'top' | 'middle' | 'bottom'; focus: string };
export const STORIES: Story[] = [
  { no: '01', label: '당신의 하루', title: ['잘 쓴 소개보다,', '함께한 시간이 궁금해서.'], body: ['어떤 사람인지 묻기 전에,', '같이 무언가를 해보면 어떨까요.'], img: 'story-01', pos: 'top', focus: 'center bottom' },
  { no: '02', label: 'AI의 이해', title: ['내 이야기는,', '내 말로.'], body: ['정해진 답에 나를 맞추지 않고,', '내가 느낀 감정부터 이야기합니다.'], img: 'story-02', pos: 'top', focus: '70% center' },
  { no: '03', label: '연결의 시작', title: ['나를 설명하는', '마지막 말은, 나에게.'], body: ['AI의 해석이 나와 다르면 고칠 수 있어야 합니다.', '우리가 지키려는 약속입니다.'], img: 'story-03', pos: 'top', focus: 'center bottom' },
  { no: '04', label: '메아리의 답', title: ['대화가 끝나도,', '나에 대한 이해는 남도록.'], body: ['흘려보냈던 말에서 내 기준을 발견하고,', '다음 선택에 다시 꺼내볼 수 있도록.'], img: 'story-04', pos: 'bottom', focus: 'center center' },
  { no: '05', label: '감정의 이유', title: ['오늘의 감정에도', '이유가 있으니까.'], body: ['좋은 날만 이야기하지 않아도 괜찮습니다.', '설명하기 어려운 마음도 나의 일부니까요.'], img: 'story-05', pos: 'bottom', focus: '65% center' },
  { no: '06', label: '감정의 변화', title: ['어제와 다른 나여도,', '괜찮습니다.'], body: ['늘 같은 답을 할 필요는 없습니다.', '지금의 내 말을 먼저 듣는 것부터.'], img: 'story-06', pos: 'middle', focus: 'center bottom' },
  { no: '07', label: '새로운 시선', title: ['조금 다른 시선으로,', '나를 다시 봅니다.'], body: ['내가 당연하게 여겼던 것들.', '누군가와 함께하면 새롭게 보이기도 합니다.'], img: 'story-07', pos: 'top', focus: 'center center' },
  { no: '08', label: '우주의 연결', title: ['연결의 속도는,', '각자가 정합니다.'], body: ['서두르지 않고, 내가 원하는 관계부터.', '서로의 선택을 존중하는 연결을 생각합니다.'], img: 'story-08', pos: 'top', focus: 'center center' },
  { no: '09', label: '이제, 당신의 이야기', title: ['어떤 사람을', '만나고 싶으세요?'], body: ['친구가 필요한지, 새로운 관계를 원하는지.', '지금의 내 마음에 맞는 목적부터 고르세요.'], img: 'story-09', pos: 'top', focus: 'center bottom' },
];

export const LEGAL = {
  company: '두잇(DO IT) · 대표 박진욱',
  registration: '사업자등록번호 121-46-51503 · 통신판매업 신고 제 2026-다산-0583호',
  address: '경기도 남양주시 강변북로632번길 41-7, 102동 101호(수석동)',
  email: '0423doit@gmail.com',
  copyright: '© 2026 DO IT COMPANY',
} as const;
