# P0 PUBLIC ACCESS INCIDENT — 「app.do-it.company 가 다른 사이트로 열림」 (2026-09-25 · 읽기 전용 실측)

대표 보고: 외부 사용자 iPhone 에서 「Publish Engaging Polls on Your Facebook Page」가 열렸고, 대표 폰에서는 ECHO 가 정상이었다.
이어진 대표 최신 확정: 그 화면은 전체 주소가 아니라 링크가 **app.do** 로 잘려 인식된 경우였다. 외부 사용자에게서도 app.do-it.company 정상 접속을 확인했다.

## 실측 (이 작업 환경 · 변경 0)

| 이름 | 이 환경 해석기 결과 | 비고 |
|---|---|---|
| app.do-it.company | 18.208.88.157 · 98.84.224.111 | do-it.company 와 같은 주소 = Netlify 가장자리 |
| do-it.company | 18.208.88.157 · 98.84.224.111 | 응답 머리 `server: Netlify` 확인 |
| echo.do-it.company | 레코드 없음 | 공개 주소로 쓰지 않음(대표 확정) |
| app.do | 192.53.122.28 | Netlify 가 아닌 **다른 도메인**(.do = 도미니카 공화국 국가 도메인) |

- Netlify `doitmobile` 주 주소 = https://app.do-it.company, 현재 배포 = `6ab64ad171a45e1b47d13c45`(ready).
- 확인 불가(이 환경 차단):
  - 공용 해석기(Google·Cloudflare DNS)
  - 권한 DNS 서버
  - IPv6
  - app.do-it.company 의 인증서·이동 경로
  - app.do 의 화면 내용

## 판단

- 가장 가능성 높은 원인은 메신저나 문자에서 주소 자동 링크가 하이픈(-) 앞에서 끊겨 `app.do` 로 이어진 것이다. `app.do` 는 실제로 다른 곳에 있는 별개의 도메인이다.
- 이는 대표 확정 내용과 맞는다. 이 환경에서 DNS 이상 증거는 0이다.
- 서비스 워커(PWA)와는 관계없다. 다른 도메인이면 우리 앱의 서비스 워커가 끼어들 수 없다.
- 수정할 DNS·Netlify 설정은 없다(변경 0).
- 예방책: 공유하는 주소는 항상 `https://` 를 붙인 전체 주소로 쓴다.
  - 앱의 「주소 복사」는 이미 전체 주소(`https://app.do-it.company/`)다.
  - 이번에 앱 안 안내 문구 2곳도 전체 주소로 고쳤다.
  - 홈페이지 문구 1곳(「주소는 app.do-it.company」)은 홈페이지 ZIP 을 올리지 않으므로 그대로다(대표 결정 P-17).
- 남은 것: `openai-chat` 서버의 허용 주소 목록에 옛 `echo.do-it.company` 가 있다. 이 함수의 배포는 대표 승인 대상이라 보고만 한다.
