# predeploy-check.sh 회귀시험 로그 (2026-09-13 · 합성 산출물 · 가짜 마커) — 기대: clean_1file 만 PASS/VERIFIED
```
OK    clean_1file            PASS  번들 내 서버 secret 패턴 0 (검출 0) | RESULT: ARTIFACT VERIFIED
OK    marked_1file           FAIL  번들 내 서버 secret 패턴 0 → 검출 1건 | RESULT: ARTIFACT HOLD
OK    multi_one_match        FAIL  번들 내 서버 secret 패턴 0 → 검출 1건 | RESULT: ARTIFACT HOLD
OK    missing_js             FAIL  번들 내 서버 secret 패턴 0 → 검사 불가(ERR_NOFILES) | RESULT: ARTIFACT HOLD
OK    read_error             FAIL  번들 내 서버 secret 패턴 0 → 검사 불가(ERR_UNREADABLE:broken.js) | RESULT: ARTIFACT HOLD

SUMMARY  ok=5 ng=0 (uid=0)
```

구 검사기(커밋 df3cc00 시점) 대조: marked_1file 에서 `PASS  번들 내 서버 secret 패턴 0` + `RESULT: ARTIFACT VERIFIED` (거짓 PASS 재현). 교정 후 동일 입력 → `FAIL … 검출 1건` + `HOLD`.
