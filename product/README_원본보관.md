# DO IT 앱·홈페이지 원본 (2026-09-24 보관)

이 폴더가 **앱(app.do-it.company)과 홈페이지(do-it.company)의 전체 원본**입니다.
38차까지의 ZIP 은 모두 이 원본을 빌드한 결과입니다.

- 그동안 원본은 작업 환경의 임시 폴더에만 있었고, 저장소에는 바뀐 파일 사본(`docs/.../PATCH-*`)만 있었습니다. 작업 환경이 사라지면 원본도 사라질 위험이 있어 여기에 통째로 보관합니다.
- 빠진 것: `.env`(비밀값 · 절대 저장소에 넣지 않음), `node_modules`, 빌드 결과(`out-*`), 예전 ZIP.
- 빌드: `npm ci` → 앱 `VITE_QA_HARNESS=true npm run build:app`(→ out-app), 홈페이지 `npm run build:brand`(→ out-brand). `.env` 에는 `.env.example` 의 공개값 3개만 넣는다.
- 검사: `npx tsc --noEmit -p tsconfig.app.json` · `npm run lint` · `node --test qa/*.test.mjs`.
