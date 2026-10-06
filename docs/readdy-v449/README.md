# Readdy V449 검수 산출물 (2026-09-13)

- 원본: 대표 전달 ZIP project-13853932 (배포 V449, Supabase zyyhhxyupizcqhxqnxuu). 원본 소스는 이 저장소에 넣지 않는다.
- PATCH_A_returnPath.diff — 범위 내. DEFAULT_RETURN_PATH '/weather' 고정 → 여정 선택(appMode) 기준 기본값. ECHO fallback 유지.
- PATCH_B_typecheck_lint.diff — 범위 밖·선택. 기존 type-check 4건·lint 5건 최소 수정(인증 로직 변경 없음).
- FINAL_src_lib_auth_returnPath.ts — PATCH A 적용 후 전체 파일.
- CHECK_LOG_2026-09-13.md — 기준선/패치 후 실제 검사 결과.

V449 실측 요약: PATCH 1(custom lock 제거) 적용됨 · PATCH 2(콜백 늦은 복구 허용) 적용됨 · doit/lib/supabase.ts 공용 client 공유(변경 불필요) · doit/hooks/useAuth.tsx anon_session_id 0건 재시도 이미 구현(PATCH 3 불필요) · vite sourcemap:true, outDir 'out' · ZIP에 .env 포함(공개 가능한 VITE_PUBLIC_* 4개만, 비밀키 없음).
