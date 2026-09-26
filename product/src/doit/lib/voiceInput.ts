// 대표 2026-09-25 「글 적는 칸에 음성 버튼 — 누르면 말하는 대로 글자가 채워지게」.
// 브라우저 음성 인식(Web Speech API)을 쓴다. 말하는 동안 중간 결과가 바로 칸에 흐르고, 끝나면 확정된 글자만 남는다.
// 목소리는 ECHO 서버로 보내지도 저장하지도 않는다. 인식은 휴대폰 브라우저(구글·애플)의 음성 인식이 한다.
// 이 기기에서 못 쓰면 supported=false — 화면은 버튼을 숨기고 글로 이어 간다.
import { useCallback, useEffect, useRef, useState } from 'react';

interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void; stop(): void; abort(): void;
}
type RecognitionCtor = new () => Recognition;

export type VoiceInputError = 'denied' | 'no-speech' | 'failed';

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canListen = () => recognitionCtor() !== null;

/** 결과 목록을 확정된 글자 + 아직 말하는 중인 글자로 합친다(순수 함수 — qa 에서 검사). */
export function joinTranscript(base: string, results: ArrayLike<RecognitionResult>): string {
  let spoken = '';
  for (let i = 0; i < results.length; i++) spoken += results[i][0].transcript;
  const said = spoken.replace(/\s+/g, ' ').trim();
  if (!said) return base;
  return base.trim() ? `${base.trimEnd()} ${said}` : said;
}

export function useVoiceInput(onText: (text: string) => void, maxLength: number) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<VoiceInputError | null>(null);
  const rec = useRef<Recognition | null>(null);
  const supported = canListen();

  const stop = useCallback(() => { rec.current?.stop(); }, []);

  const start = useCallback((base: string) => {
    const Ctor = recognitionCtor();
    if (!Ctor || rec.current) return;
    const r = new Ctor();
    r.lang = 'ko-KR';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => onText(joinTranscript(base, e.results).slice(0, maxLength));
    r.onerror = (e) => setError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'denied' : e.error === 'no-speech' ? 'no-speech' : e.error === 'aborted' ? null : 'failed');
    r.onend = () => { rec.current = null; setListening(false); };
    try {
      setError(null);
      r.start();
      rec.current = r;
      setListening(true);
    } catch { rec.current = null; setListening(false); setError('failed'); }
  }, [onText, maxLength]);

  useEffect(() => () => { rec.current?.abort(); rec.current = null; }, []);

  return { supported, listening, error, start, stop };
}

/**
 * 말로 대화하기(Voice Lite · 2026-09-26 대표 「ChatGPT Voice 처럼」): 마이크 한 번 = 말 한 번.
 * 사용자가 말을 멈추면 브라우저가 스스로 듣기를 끝내고(continuous=false), 들은 글자를 onHeard 로 한 번 넘긴다 — 키보드 0.
 * 듣는 중에 다시 누르면(stop) 거기까지 들은 말을 넘긴다. cancel 은 아무것도 넘기지 않는다.
 * 목소리 자체는 저장·전송하지 않는다(글자만 기존 대화 서버로 간다 — 글로 적은 말과 같은 길).
 */
export function useVoiceTurn(onHeard: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [error, setError] = useState<VoiceInputError | null>(null);
  const rec = useRef<Recognition | null>(null);
  const said = useRef('');
  const dropped = useRef(false);
  const deliver = useRef(onHeard);
  useEffect(() => { deliver.current = onHeard; }, [onHeard]);
  const supported = canListen();

  const stop = useCallback(() => { rec.current?.stop(); }, []);
  const cancel = useCallback(() => { dropped.current = true; rec.current?.abort(); }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor || rec.current) return false;
    const r = new Ctor();
    r.lang = 'ko-KR';
    r.continuous = false;
    r.interimResults = true;
    said.current = ''; dropped.current = false;
    r.onresult = (e) => { said.current = joinTranscript('', e.results); setHeard(said.current); };
    r.onerror = (e) => setError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'denied' : e.error === 'no-speech' ? 'no-speech' : e.error === 'aborted' ? null : 'failed');
    r.onend = () => {
      rec.current = null; setListening(false); setHeard('');
      const text = said.current.trim(); said.current = '';
      if (text && !dropped.current) deliver.current(text);
    };
    try {
      setError(null); setHeard('');
      r.start();
      rec.current = r;
      setListening(true);
      return true;
    } catch { rec.current = null; setListening(false); setError('failed'); return false; }
  }, []);

  useEffect(() => () => { dropped.current = true; rec.current?.abort(); rec.current = null; }, []);

  return { supported, listening, heard, error, start, stop, cancel };
}

export const VOICE_INPUT_ERROR_TEXT: Record<VoiceInputError, string> = {
  denied: '마이크를 쓸 수 없어요. 휴대폰 설정에서 이 앱(브라우저)의 마이크를 허용해 주세요.',
  'no-speech': '소리가 들리지 않았어요. 다시 눌러 말해 주세요.',
  failed: '음성 인식이 멈췄어요. 다시 누르거나 글로 적어 주세요.',
};
