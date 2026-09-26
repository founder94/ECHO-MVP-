// ECHO 목소리(기기 TTS · 브라우저 speechSynthesis). 새 유료 API·서버 호출 0 — 휴대폰에 들어 있는 읽기 기능만 쓴다.
// 2026-09-26 대표 실기기 FAIL VOICE_RESPONSE_NOT_SPOKEN 코드 원인(확인됨):
//   예전 speak(' ') 는 「빈 글자면 읽지 않는다」 검사에 걸려 아무것도 하지 않았다 → 아이폰에서 누름 안에서 소리 길을 여는 일이 한 번도 없었다.
//   그 뒤 서버 대답을 기다린 다음(누름 밖) 읽으려 하면 아이폰 사파리는 소리를 막는다(애플 정책). 실제 아이폰 동작은 실기기로만 확인된다.
// 그래서 소리 길은 사용자가 누른 그 순간 unlockSpeech() 로 연다(들리지 않는 음량 0 · 실제 글자 한 개).

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';

// 음악(첫 화면 오리지널 음악)과 ECHO 목소리가 겹치지 않게: 듣기·말하기를 시작할 때 알린다. 음악은 멈추기만 하고 저절로 다시 틀지 않는다.
export const VOICE_ACTIVE_EVENT = 'echo:voice-active';
export function announceVoiceActive() {
  try { window.dispatchEvent(new Event(VOICE_ACTIVE_EVENT)); } catch { /* 알림 실패는 대화를 막지 않는다 */ }
}

/** 사용자가 누른 그 순간에 불러야 한다(아이폰: 첫 소리는 누름 안에서만 시작된다). */
let unlocked = false;
export function unlockSpeech() {
  if (!canSpeak() || unlocked) return; // 한 문서에서 한 번 열면 된다(말 듣기 직전에 빈 소리를 거듭 내지 않게)
  unlocked = true;
  try {
    const u = new SpeechSynthesisUtterance('.');
    u.volume = 0;
    u.lang = 'ko-KR';
    window.speechSynthesis.speak(u);
  } catch { /* 글로 이어 간다 */ }
}

export function stopSpeaking() {
  if (!canSpeak()) return;
  try { window.speechSynthesis.cancel(); } catch { /* 이미 멈춤 */ }
}

function koreanVoice(): SpeechSynthesisVoice | null {
  try { return window.speechSynthesis.getVoices().find(v => /^ko/i.test(v.lang)) ?? null; } catch { return null; }
}

export type SpeakEnd = 'done' | 'stopped' | 'failed';

/** 글을 소리로 읽는다. 시작하면 onStart, 끝·멈춤·실패는 onEnd 한 번. 못 읽는 기기면 바로 onEnd('failed'). */
export function speakText(text: string, onStart: () => void, onEnd: (how: SpeakEnd) => void) {
  const t = text.trim();
  if (!canSpeak() || !t) { onEnd('failed'); return; }
  let ended = false;
  const end = (how: SpeakEnd) => { if (!ended) { ended = true; onEnd(how); } };
  try {
    const synth = window.speechSynthesis;
    // 읽는 중일 때만 멈춘다(크롬·사파리는 cancel 바로 뒤 speak 를 가끔 버린다).
    if (synth.speaking || synth.pending) synth.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = 'ko-KR';
    const v = koreanVoice(); if (v) u.voice = v;
    u.onstart = () => { announceVoiceActive(); onStart(); };
    u.onend = () => end('done');
    u.onerror = (e) => end(e.error === 'interrupted' || e.error === 'canceled' ? 'stopped' : 'failed');
    synth.speak(u);
  } catch { end('failed'); }
}
