// 로그인·가입 실패 문구(2026-09-26 대표 「LEGAL / PRIVACY / AUTH」 §11): Supabase 가 돌려주는 영어 문장을 35~52세가 바로 이해하는 한국어로 바꾼다.
// 인증 방식·설정은 바꾸지 않는다(문구만). 모르는 문장은 원문을 보이지 않고 일반 안내로.
const RULES: [RegExp, string][] = [
  [/invalid login credentials/i, '이메일 또는 비밀번호가 맞지 않아요.'],
  [/email not confirmed/i, '이메일 인증을 먼저 마쳐 주세요. 가입할 때 받은 메일의 링크를 눌러 주세요.'],
  [/already (been )?registered|user already exists/i, '이미 가입된 이메일이에요. 로그인해 주세요.'],
  [/password should be at least|weak password/i, '비밀번호는 8자 이상으로 적어 주세요.'],
  [/invalid email|unable to validate email/i, '이메일 주소를 다시 확인해 주세요.'],
  [/rate limit|too many requests|security purposes/i, '요청이 많았어요. 잠시 뒤 다시 시도해 주세요.'],
  [/provider is not enabled|unsupported provider/i, '이 로그인 방법은 지금 쓸 수 없어요.'],
  [/failed to fetch|network/i, '네트워크 연결을 확인해 주세요.'],
];

export function authErrorText(message: string | null | undefined, fallback = '로그인하지 못했어요. 잠시 뒤 다시 시도해 주세요.'): string {
  const m = String(message ?? '').trim();
  if (!m) return fallback;
  for (const [re, text] of RULES) if (re.test(m)) return text;
  return /[가-힣]/.test(m) ? m : fallback;
}
