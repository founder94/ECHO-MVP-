// ECHO 앱(app.do-it.company) 서비스 워커 — 2026-10-10 갤럭시 삼성 인터넷 「홈 화면에 추가 → 앱 설치」 조건용.
// 아무것도 저장(캐시)하지 않고, 요청을 가로채지도 않는다(respondWith 없음 = 브라우저가 평소처럼 받는다).
// 그래서 배포 뒤 옛 화면이 남는 일이 없다. 앱 빌드에서만 등록한다(src/lib/appBoot.ts).
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 설치 조건(fetch 처리기 있음)만 채우는 통과용. 일부러 비워 둔다.
self.addEventListener('fetch', () => {});
