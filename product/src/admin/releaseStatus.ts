// 배포 상태 기록 — 자동 측정이 아니라 마지막 검사 보고의 기록이다(화면에 「기록 기준」과 날짜를 같이 보인다).
// 배포 서버(Netlify)·운영 서버 판 번호를 관리자 화면이 직접 읽는 연결은 아직 없다(연결 필요).
// 바꿀 때: 새 검사 보고가 나오면 이 값을 고치고 함께 커밋한다(근거 = 보고서의 commit·검사 run).
export type Gate = 'PASS' | 'HOLD' | '확인 필요';

export interface ReleaseLine { name: string; where: string; version: string; state: string }

export const RELEASE_RECORD = {
  recordedAt: '2026-09-28',
  source: 'FINAL COMPLETION REPORT (PR #12 · commit 146e2af)',
  lines: [
    { name: '모바일 앱(ECHO)', where: 'app.do-it.company', version: '확인 필요', state: '운영 판 번호를 읽는 연결 없음' },
    { name: '모바일 앱 QA', where: 'thriving-melba (QA)', version: '4ba37ce(올라가 있음) · 146e2af(올릴 판)', state: '새 판 업로드 대기' },
    { name: 'ECHO 대화 서버', where: 'QA 서버', version: 'echo-agent-v2.4.1', state: 'QA 배포됨' },
    { name: 'ECHO 대화 서버', where: '운영 서버', version: '확인 필요', state: '운영 배포 안 함(대표 GO 전)' },
    { name: '브랜딩 홈페이지', where: 'do-it.company', version: '확인 필요', state: 'QA 사이트 없음' },
    { name: '관리자 페이지', where: 'admin.do-it.company', version: '이 화면의 빌드', state: '운영 연결 안 함(대표 GO 전)' },
  ] as ReleaseLine[],
  gates: [
    { name: 'QA 자동검사(실제 AI 80회)', gate: 'PASS' as Gate, note: '80/80 · 오류 0' },
    { name: 'Chrome · WebKit', gate: 'PASS' as Gate, note: 'iPhone · Galaxy 크기' },
    { name: '실기기 iPhone', gate: 'HOLD' as Gate, note: '새 앱 판 업로드 전' },
    { name: '실기기 Galaxy', gate: 'HOLD' as Gate, note: '새 앱 판 업로드 전' },
    { name: '운영 확인', gate: 'HOLD' as Gate, note: '운영 배포 전' },
  ],
};

// 이 관리자 화면을 만든 판(빌드 때 넣는다). 없으면 「확인 필요」.
export const ADMIN_BUILD = (import.meta.env.VITE_BUILD_COMMIT as string | undefined) || '확인 필요';
