import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startInstallPromptCapture } from './doit/lib/installPrompt'
import { registerAppServiceWorker, reloadOnceOnStaleChunk } from './lib/appBoot'

// 갤럭시의 "앱으로 설치" 신호는 첫 화면 전에 올 수 있어 가장 먼저 듣는다(브랜드 사이트에서는 신호가 오지 않는다).
startInstallPromptCapture()
// 배포 직후 옛 코드 조각을 부르다 실패하면 한 번만 새로 고친다 · 앱 빌드만 서비스 워커 등록(삼성 인터넷 설치 조건).
reloadOnceOnStaleChunk()
registerAppServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
