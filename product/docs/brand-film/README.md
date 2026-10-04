# DO IT 브랜드 영상 — 만드는 법(2026-10-04)

근거: 대표 「추가 필수 구현 — 홈페이지 안에 들어갈 DO IT 브랜드 영상」.
결과물: `public/brand/film/`
- 가로 1280×720: `doit-brand-film-landscape.mp4`(H.264), `.webm`(VP9)
- 세로 720×1280: `doit-brand-film-portrait.mp4`(H.264), `.webm`(VP9)
- 대표 이미지: `poster-landscape.jpg`, `poster-portrait.jpg`
- 자막: `captions.ko.vtt`
- 공통: 25초, 소리 트랙 없음

## 장면(초)
| 장면 | 시간 | 내용 |
|---|---|---|
| 1 시작 | 0–3.8 | 지구 + DO IT 로고 |
| 2 이야기 | 3.8–9.4 | 실제 모바일 입력 화면에서 한 줄을 타자로 입력(합성 문장) |
| 3 확인 | 9.4–14 | 「이렇게 이해했는데, 맞나요?」 |
| 4 선택 | 14–17.2 | 각자 고른 두 표시가 이어짐 |
| 5 찌릿 | 17.2–20.6 | 청록·흰 전류 + 「찌릿! 텔레파시가 통했어요」 |
| 6 마무리 | 20.6–25 | 「당신이 잠든 사이, AI가 먼저 만나봅니다.」 + 로고 · 관련 기능 준비 중 |

- 화면 속 내용은 모두 **합성**(실제 회원 정보 0)이다. 화면에 「서비스 이용 예시 · 합성 화면」, 「관련 기능 준비 중」을 표시한다.
- 보라 네온·옆으로 쓸고 지나가는 효과·Figma 흉내는 쓰지 않았다.

## 다시 만들기
1. `film.html` 옆에 `a/` 폴더를 둔다. 크기 때문에 저장소에는 넣지 않았다.
   - 로고·심볼·지구 이미지는 `public/brand/` 원본에서 가져온다.
   - 입력 화면·확인 화면 PNG는 로컬 미리보기 빌드를 캡처한 것이다.
2. `film.html`이 있는 폴더를 4320번 포트로 띄운다.
3. 장면을 이미지로 뽑는다(Playwright).
   - 가로: `node render.mjs all 1280 720 fL`
   - 세로: `node render.mjs all 720 1280 fP`
4. 영상으로 묶는다(ffmpeg).
   - mp4: `ffmpeg -framerate 30 -i fL/%05d.jpg -c:v libx264 -pix_fmt yuv420p -movflags +faststart -an out.mp4`
   - webm: `ffmpeg -framerate 30 -i fL/%05d.jpg -c:v libvpx-vp9 -b:v 0 -crf 38 -row-mt 1 -pix_fmt yuv420p -an out.webm`
   - 대표 이미지: 78번째 장면 이미지(`00078.jpg`)를 쓴다.
