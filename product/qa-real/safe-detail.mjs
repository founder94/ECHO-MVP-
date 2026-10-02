// 검사 출력에서 비밀값 모양을 지운다(2026-10-02 사고 재발 방지 — CI 로그에 저장된 세션 JSON 이 실패 메시지로 남았던 일).
// GitHub 의 자동 가림에 기대지 않는다: 접근·갱신 토큰, JWT, 비밀번호·키 칸, 저장 세션, Bearer, 메일 주소를 지운 뒤에만 찍는다.
const KEY = /(["']?)(access_token|refresh_token|provider_token|provider_refresh_token|id_token|password|apikey|api_key|secret|service_role|token)\1(\\?["']?)\s*:\s*\\?(["'])((?:\\.|(?!\\?\4).)*)\\?\4/gi;
export function safeDetail(value) {
  let s = typeof value === 'string' ? value : (() => { try { return JSON.stringify(value); } catch { return String(value); } })();
  s = s.replace(KEY, (_m, q, k, q2, quote) => `${q}${k}${q2}:${quote}[가림]${quote}`);
  s = s.replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[가림-JWT]');
  s = s.replace(/\b(Bearer|bearer)\s+[A-Za-z0-9._~+/=-]{8,}/g, '$1 [가림]');
  s = s.replace(/sb_(secret|publishable)_[A-Za-z0-9_-]{8,}/g, 'sb_$1_[가림]');
  s = s.replace(/\bsk-[A-Za-z0-9_-]{12,}/g, 'sk-[가림]');
  s = s.replace(/([A-Za-z0-9._%+-]{1,3})[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '$1***@$2');
  return s;
}
