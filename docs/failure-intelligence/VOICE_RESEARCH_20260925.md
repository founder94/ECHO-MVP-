# Voice 조사 · 구현 범위 · STOP (2026-09-25)

근거: 대표 「ECHO CONVERSATION AGENT v1 / v1.1 FINAL」.
- 이 문서는 읽기만 해서 쓴 조사다.
- 운영 변경은 0이다.

## 1. 공식 자료에서 확인한 것
이 환경에서는 openai.com · platform.openai.com · developers.openai.com 이 막혀 있다. 그래서 OpenAI 가 직접 관리하는 GitHub 저장소 문서로 확인했다.

| 무엇 | 출처(공식) | 확인한 내용 |
|---|---|---|
| 실시간 음성 대화 | `openai/openai-agents-js` 음성 에이전트 빠른 시작 · `openai/openai-realtime-console` 서버 예제 | ① 브라우저는 WebRTC 로 연결한다. ② 브라우저용 임시 키는 **우리 서버가 일반 API 키로 `POST /v1/realtime/client_secrets` 를 불러 발급**한다(`ek_…`, 짧게 유효). ③ 예시 모델 `gpt-realtime-2.1` · `gpt-realtime`. ④ 브라우저에서는 SDK 가 마이크 캡처와 소리 재생을 맡는다 |
| 받아쓰기(STT) | `openai/openai-python` 형식 정의(`audio_model.py`) · `api.md` | `POST /audio/transcriptions`. 모델 이름: `gpt-4o-transcribe` · `gpt-4o-mini-transcribe` · `gpt-transcribe` · `whisper-1` 등 |
| 읽어 주기(TTS) | `openai/openai-python` 형식 정의(`speech_model.py`) | `POST /audio/speech`. 모델 이름: `gpt-4o-mini-tts` · `tts-1` · `tts-1-hd` |
| Claude 음성 | platform.claude.com 공식 문서 3쪽(개요 · 메시지 API · 모델 개요) | 「audio」·「speech」 언급 0번 → Claude API 는 음성 입출력이 없다고 판단한다. 그래서 Claude 를 대화 두뇌로 쓰면 음성 입출력 공급자는 따로 둬야 한다(명세 §11 과 같음) |

### 확인하지 못한 것 — 추정 금지
- 한국어 품질
- 공식 단가
- 음성 원본을 저장하는지(데이터 보관 정책)
- iPhone Safari · Galaxy Chrome 에서 실제로 되는지

## 2. 지금 시험 페이지에서 되는 것 — 「말로 대화하기(시험판)」
- **말하기**
  - 휴대폰 키보드의 마이크 버튼(기기 받아쓰기)으로 입력창에 적는다.
  - 받아쓰기는 휴대폰 운영체제가 하고, ECHO 는 글자만 받는다.
  - 음성 원본 저장은 0이다.
- **듣기**: ECHO 대답을 기기 내장 읽기(`speechSynthesis`, 무료 · 키 없음)로 소리 내 읽는다.
  - 걸린 시간은 자동 기록(`audio_output_ms`)에 남긴다.
  - 이 기능이 없는 기기에서는 「글로 계속할게요」로 넘어간다(빠져나갈 문).
- **글·말은 같은 에이전트다.** 같은 상태·기억·다섯 질문·매칭 프로필을 쓴다. 기록 칸의 `input_mode` 만 VOICE 다.
- **한계**
  - 버튼을 누르고 말하면 ECHO 가 알아서 듣는 실시간 음성은 아니다.
  - claude.ai 페이지는 플랫폼 규칙상 마이크를 쓸 수 없다(묻지 않고 거절한다).
  - 아이폰 사파리는 첫 소리를 사용자 누름 안에서 시작해야 해서 「대화 시작」 누를 때 소리를 준비한다. 그래도 실제로 소리가 나는지는 아무도 확인하지 않았다.

## 3. 실시간 음성 STOP 보고(한 번에)
| 항목 | 내용 |
|---|---|
| 이유 | ① 실시간 음성에는 마이크가 필요한데, claude.ai 페이지는 마이크를 막는다. ② 공식 방식은 우리 서버가 API 키로 임시 키를 발급해야 한다 |
| 대상 | 새 Supabase Edge 함수 1개(예: `doit-voice-token`) 운영 배포 + 마이크가 되는 화면(앱 app.do-it.company 의 새 화면, Netlify 배포) |
| 정확한 변경 | 함수는 로그인 토큰을 확인한 뒤 `POST /v1/realtime/client_secrets` 로 임시 키 1개를 발급해 돌려준다. 그 밖의 일은 하지 않는다 |
| 두뇌를 지키는 방식 | 두 가지 중 하나를 고른다. ⓐ `gpt-realtime` 이 대화까지 맡는다 — 에이전트 계약(다섯 질문·상태)을 서버가 쥐기 어렵다. ⓑ 받아쓰기(`gpt-4o-transcribe`) → echo-agent → 읽어 주기(`gpt-4o-mini-tts`) — 계약을 그대로 지킬 수 있다. 권장은 ⓑ다. ⓑ 도 서버 함수가 필요하다 |
| 키 | 운영 Supabase 에 이미 있는 OpenAI 키를 쓰면 새 Secret 은 0이다. 다만 키의 쓰임새가 늘어나므로 대표 승인이 필요하다 |
| 영향 | DB·RLS·Auth 변경 0. 운영 함수 1개 추가, 앱 화면 1개 추가 |
| 비용 | 공식 단가를 확인하지 못해 숫자를 쓰지 않는다. 호출 수·음성 길이·토큰을 기록해서 나중에 계산한다 |
| 복구 | 함수 삭제(또는 비활성) + Netlify 직전 배포로 되돌리기. 운영 데이터 삭제는 0이다 |
| 음성 원본 | 저장하지 않는다(전사 글자만). 저장이 필요해지면 목적·동의·보관 기간·삭제·접근 권한을 먼저 설계하고 대표 승인을 받는다 |
