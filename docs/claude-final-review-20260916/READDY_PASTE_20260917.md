# 래디(Readdy)에 그대로 붙여넣을 코드 — 2026-09-17

실기기 캡처 3장에서 나온 결함 3개 중 **래디가 고칠 수 있는 것은 1개(화면 문장)뿐**입니다.
나머지 2개(반말 질문, 질문 생성 실패)는 서버 코드라 래디가 손댈 수 없습니다. 아래 1장만 래디에 주세요.

---

## 1장. 래디에게 줄 지시 (이 블록 전체 복사)

```
[ECHO 화면 수정 요청 — 날씨 문장 1곳]

증상: /weather-check 화면에 "오늘 밖은 대체로 맑음예요." 라고 나온다.
"맑음"은 이름표(명사)인데 뒤에 "예요"를 그대로 붙여서 한국어 문법이 깨졌다.

원인: 화면이 {weatherLabel}예요 로 문장을 조립하고 있다.
고치는 방법: 이름표와 문장을 분리한다. 아이콘 키마다 서술형 문장을 따로 둔다.

건드리지 말 것: 배경·색·애니메이션·레이아웃·다른 문구·서버 호출 코드.
아래 두 파일의 해당 부분만 바꾼다.

────────────────────────────────────────
파일 1: src/pages/do-it/weather/hooks/useWeather.ts
`const GEO_TIMEOUT_MS = 4_000;` 바로 아래에 이 블록을 추가한다.
────────────────────────────────────────

// 라벨(명사)과 문장(서술)은 쓰임이 다르므로 아이콘 키마다 자연스러운 서술형을 따로 둔다.
export const WEATHER_SENTENCE: Record<WeatherIconKey, string> = {
  clear: '맑아요',
  partlyCloudy: '대체로 맑아요',
  cloudy: '흐려요',
  fog: '안개가 꼈어요',
  drizzle: '부슬비가 내려요',
  rain: '비가 와요',
  shower: '소나기가 내려요',
  snow: '눈이 와요',
  thunder: '천둥이 쳐요',
  wind: '바람이 불어요',
  unsure: '잘 모르겠어요',
};

/** "오늘 밖은 ___" 뒤에 그대로 붙일 수 있는 서술형 문장을 돌려준다. */
export function weatherSentence(iconKey: WeatherIconKey | null | undefined): string {
  if (!iconKey) return WEATHER_SENTENCE.unsure;
  return WEATHER_SENTENCE[iconKey] ?? WEATHER_SENTENCE.unsure;
}

────────────────────────────────────────
파일 2: src/pages/do-it/weather-check/page.tsx
바꿀 곳 2군데.
────────────────────────────────────────

(2-1) 맨 위 import 한 줄을 바꾼다.

  바꾸기 전:
import type { WeatherIconKey } from '@/pages/do-it/weather/hooks/useWeather';

  바꾼 뒤:
import { weatherSentence, type WeatherIconKey } from '@/pages/do-it/weather/hooks/useWeather';

(2-2) 제목(h1) 안의 한 줄을 바꾼다.

  바꾸기 전:
                오늘 밖은 <span className="text-white/90">{weatherLabel}</span>예요.

  바꾼 뒤:
                오늘 밖은 <span className="text-white/90">{weatherSentence(iconKey)}</span>.

────────────────────────────────────────
확인 방법
────────────────────────────────────────
1. /weather-check 에서 "오늘 밖은 대체로 맑아요." 로 보이면 성공이다.
   "맑음예요" 가 남아 있으면 실패다.
2. 날씨를 못 받은 경우에는 "밖의 날씨는 확인하지 않았어요." 문장이 그대로 나와야 한다.
3. 390px 폭에서 가로 스크롤이 생기지 않아야 한다.
4. 배경 그라데이션과 버튼 위치는 그대로여야 한다.
```

---

## 2장. 래디가 할 수 없는 것 (서버 — Claude 담당)

| 캡처 | 증상 | 어디 문제인가 | 상태 |
|---|---|---|---|
| 1번 | "질문을 만들지 못했어요" | 서버가 STEP 2 질문 후보를 3번 다 막고 되살릴 길이 없었다 | Claude 가 코드 수정·검사 완료, 배포는 대표 승인 대기 |
| 2번 | "…궁금해?" 반말 | 서버 프롬프트에 존댓말 규칙이 없었고 검사도 없었다 | Claude 가 코드 수정·검사 완료, 배포는 대표 승인 대기 |
| 3번 | "대체로 맑음예요." | 화면이 이름표에 "예요"를 붙였다 | **위 1장으로 래디가 수정 가능** |

래디에게 서버 이야기를 시키지 마세요. 결제·로그인·보안·질문 생성은 래디 범위가 아닙니다.
