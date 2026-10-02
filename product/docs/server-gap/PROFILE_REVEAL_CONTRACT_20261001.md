# ECHO 프로필 공개 구조 — 서버 부족분 계약 (Codex 전달용)

작성: 2026-10-01 · 기준 `echo-qa` `cf53197` · 작성: Claude(프론트)
범위: ECHO FRAME · LAYERS · FILM · 그 사람의 장면들(Scenes) 중 **서버 지원이 없어 화면에서 만들지 않은 부분**.
원칙: 서버가 클라이언트에 무엇이 있는지 정한다. 화면은 보이는 모습만 정한다. 공개 전 사진·정보는 클라이언트에 오지 않는다.

DB · RLS · Migration · Storage policy · PROD 변경은 이 문서로 승인되지 않는다. 아래 G1~G5 모두 **대표 승인 필요**.

## 0. 지금 서버가 하는 것 (감사 결과 · 코드 위치)

| 항목 | 상태 | 근거 |
|---|---|---|
| 후보(`my_candidates`) 응답 | 상대 정보 0. `id · created_at · purpose(내 목적) · reasons · my_choice · waiting` 만 | `supabase/functions/doit-connect/index.ts` my_candidates 블록 |
| 연결(`my_matches`) 공개 전 | `partner` · `messages` 없음 | 같은 파일 my_matches · `revealed = open && mine && theirs` |
| 연결 공개 뒤 | `partner = { nickname, bio, purpose, answer, photo_url }` · 사진은 대표 사진 **원본 1장**의 10분 서명 주소 | `primaryPhotoUrl()` · `SIGNED_URL_SECONDS: 600` |
| 공개 단계 | **두 단계뿐**(아무것도 없음 → 전부). 부분 공개 없음 | 같은 파일 |
| 사진 저장소 | 비공개 버킷 `profile-photos`, 경로 `{uid}/{slot 1~6}/{captureId}.jpg`, `profile_photos(slot, storage_path, is_primary)` | `src/doit/lib/photoStorage.ts` |
| 파생 이미지(조각·썸네일·크롭) | 없음 | — |
| 사진 설명·분류(장면) | 없음 | `profile_photos` 에 설명·분류 칸 없음 |
| 숨기기 | 후보 `choose` 의 `hide` (DB 저장) | choose 블록 |
| 차단·신고 | 연결 `leave` 의 `block` · `report` → `blocks` · `user_reports` (DB 저장) | leave 블록 |

SECURITY RISK: **없음**. 공개 전 사진·정보가 클라이언트에 오는 경로를 찾지 못했다(서버 코드 + 브라우저 검사 47: 공개 전 사진 요청 0 · DOM 주소 0).

## G1. 부분 공개(PARTIAL_SAFE) — 사진 조각

- 현재: 공개 전 사진은 0, 공개 뒤에는 원본 전체. 「실제 사진의 일부 장면」을 보여 줄 서버 자산이 없다.
- 필요: 서버가 만든 **조각 파생본**(원본의 일부만 담은 별도 파일). 원본 주소는 공개 전 절대 내려가지 않는다.
- 상태 전환: `PROFILE_SAFE(후보·공개 전)` → `PARTIAL_SAFE(상호 선택 뒤 · 첫 답 전)` → `FULL_SAFE(지금의 revealed)`. 기존 `revealed` 를 재사용하고 새 이름은 최소화.
- 출력(`my_matches` 항목에 추가, 공개 전 상태에서만):
  ```json
  { "presence": { "fragment_url": "signed, 10분, 조각 파생본만", "fragment_w": 480, "fragment_h": 600, "sentence": "상대가 직접 쓴 소개 첫 문장(동의 범위 안)" } }
  ```
- 권한: 그 연결의 두 사람만. 후보 단계(`my_candidates`)에는 여전히 0.
- 금지: 원본 `storage_path`, 원본 서명 주소, 다른 슬롯 사진, 닉네임(공개 전).
- Storage: 파생본 경로(예: `{uid}/derived/{photoId}/fragment.jpg`) + 생성 함수(업로드 시 또는 지연 생성). **Storage policy 확인 필요**.
- DB/Migration: 파생본 경로 칸 또는 표 필요 → **승인 필요**.
- 동의: 지금 동의 문구(「둘 다 답하기 전에는 아무것도 보이지 않아요」)가 바뀌므로 동의 판(consent_version) 갱신이 필요 → **개인정보 정책 결정 필요(대표)**.
- QA: 공개 전 응답·네트워크·DOM 에 원본 주소 0 · 조각 파일 바이트가 원본과 다름(해시) · 다른 사용자 토큰으로 403.

## G2. 그 사람의 장면들(Scenes)

- 현재: 사진에 설명·분류가 없다.
- 필요: 사진마다 사용자가 직접 쓴 1~2줄과 분류(요즘 · 쉬는 날 · 좋아하는 곳 · 사소하게 좋아하는 것).
- 입력(본인 저장): `{ action: "scene_save", photoId, category: "now|weekend|place|small", caption ≤ 60자 }` — 연락처·링크 거름(기존 메시지 규칙 재사용).
- 출력(공개 단계에 맞춰서만): `scenes: [{ category, caption, image_url(그 단계 파생본) }]`, 최대 4개.
- 권한: 공개 뒤(FULL_SAFE) 그 연결의 상대만. 공개 전에는 0(또는 G1 승인 시 캡션만).
- 금지: AI 가 쓴 캡션, 원본 주소(공개 전).
- DB/Migration: `profile_photos` 에 `caption` · `scene_category` 칸 또는 별도 표 → **승인 필요**.
- QA: 캡션 길이·금지어 거름 · 공개 전 0 · 공개 뒤 순서 유지.

## G3. 사진 파생본 · 성능

- 현재: 원본 JPEG 1장만. `srcset` · 썸네일 · WebP 불가.
- 필요: 업로드 때 `480w` · `960w` 파생본(WebP 우선, JPEG 대체), 서명 주소를 크기별로 같이 반환: `photo: { url_480, url_960, w, h }`.
- 원본 보존: 지금 화면은 업로드 전에 회전·밝기 보정을 원본에 덮어써서 올린다(`src/pages/do-it/photo/page.tsx` `CORRECTION`). 「원본은 항상 보존 · 보정은 덮어쓰기 금지」를 지키려면 원본 + 보정본을 따로 저장해야 한다 → **Storage·DB 승인 필요**.
- Supabase 이미지 변환(render/image) 사용 가능 여부는 요금제 확인 필요(확인 불가 · 미확인).

## G4. 사용자 크롭 값

- 현재: 크롭 없음(가운데 맞춤 `object-fit: cover`).
- 필요: 사진마다 크롭 상자 `{ x, y, w, h }`(0~1 비율) 저장 · 화면은 그 값으로 그리기. 자동 크롭 후보는 확실할 때만 제안, 사용자가 확정.
- DB/Migration: 크롭 칸 → **승인 필요**.

## G5. 연결 전(후보) 신고 — **2026-10-01 구현됨(doit-connect v2.1 · DB 변경 0)** · `FLOW_SAFETY_CONTRACT_20261001.md` 0절

- 현재: 신고는 연결이 열린 뒤 `leave(report)` 로만 가능. 후보 단계는 숨기기만.
- 필요(선택): `choose` 에 `report` 선택지 또는 `report_candidate` 동작 → `user_reports` 기록. 표는 이미 있음(새 표 불필요 예상).

## 화면 쪽 준비 상태

- FRAME · FILM: 구현 완료(공개 뒤 실제 데이터만).
- LAYERS: Layer 1(Presence)·Layer 2(Everyday) = **DESIGN READY / SERVER HOLD**(G1·G2). Layer 3(Closer) = 지금의 공개 화면(FRAME).
- SCENES: **DESIGN READY / SERVER HOLD**(G2·G3). 화면은 가짜 장면을 만들지 않는다.
- 크롭·원본 보존: **SERVER HOLD**(G3·G4).
