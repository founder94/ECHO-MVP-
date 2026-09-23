import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startInstallPromptCapture } from './doit/lib/installPrompt'

// 갤럭시의 "앱으로 설치" 신호는 첫 화면 전에 올 수 있어 가장 먼저 듣는다(브랜드 사이트에서는 신호가 오지 않는다).
startInstallPromptCapture()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
