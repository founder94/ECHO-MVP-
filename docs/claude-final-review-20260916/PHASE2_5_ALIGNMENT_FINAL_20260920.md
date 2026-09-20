# PHASE 2.5 · PRODUCT/BACKEND ALIGNMENT FINAL (2026-09-20)

읽기 전용. 변경 0. DB 조회 1회 + 코드·Edge 소스 읽기 1회로 묶어 실행했다.

---

## 1. DB 활성 Purpose 4종 (운영 실측)

| id | label | description | sort_order |
| --- | --- | --- | ---: |
| friend | 친구를 만나고 싶어요 | 편하게 알아가며 친구 관계를 만들고 싶어요. | 1 |
| romantic | 연애로 이어질 만남을 원해요 | 연애 가능성을 열어두고 사람을 알아가고 싶어요. | 2 |
| conversation | 깊은 대화부터 시작하고 싶어요 | 친구나 연애라는 이름을 먼저 정하기보다 깊은 대화부터 시작하고 싶어요. | 3 |
| open | 아직 정하지 않았어요 | 관계의 이름을 미리 정하지 않고 사람부터 알아가고 싶어요. | 4 |

비활성 6종: slow(사람을 천천히 알아가기) · hobby(취미) · workout(운동) · culture(문화 활동) · local(지역 활동) · create(만들기)
→ 이 6종은 **활동·관심사** 계열이다. 활성 4종은 **관계의 성격** 계열이다. 두 축이 한 테이블에 섞여 있다.

## 2. 화면 하드코딩 Purpose 12종 (`PurposeSelect.tsx`)

| id | label | note |
| --- | --- | --- |
| friend | 친구 관계 | 편하게 어울릴 사람 |
| romantic | 이성 관계 | 천천히 알아가는 연결 |
| same-gender | 동성 친구 관계 | 깊이 공감하는 우정 |
| colleague | 동료 관계 | 함께 성장하는 사람 |
| interest | 관심사 기반 관계 | 취미와 열정이 통하는 사람 |
| values | 가치관 기반 관계 | 삶의 방향이 비슷한 사람 |
| startup | 창업가 그룹 | 같이 만들어가는 사람 |
| professional | 전문직 그룹 | 전문성을 나눌 사람 |
| creator | 크리에이터 그룹 | 창작 에너지가 맞는 사람 |
| project | 프로젝트·스터디·성장 목적 그룹 | 함께 배우고 만들어가는 목적 |
| conversation | 목적성 기반 대화 그룹 | 의미 있는 대화 |
| lgbtq | 성소수자 보호 공간 | 안전과 정체성 보호 (`protected: true`) |

## 3. 기존 저장값 집계 (개인 식별정보 없음)

| 구분 | id | 화면/DB 문구 | 현재 활성 | 저장 사용자 수 | 판정 |
| --- | --- | --- | --- | ---: | --- |
| 저장값 | romantic | 저장 "이성 관계" / DB "연애로 이어질 만남을 원해요" | 활성 | 1 | **id 일치, 문구 불일치** |
| 저장값 | values | 가치관 기반 관계 | — | 1 | **purposes 에 없음** |
| 저장값 | (null) | (null) | — | 3 | 미선택 |
| 참조 | spaces | purpose_id FK 사용 | — | 0행 | 아직 영향 없음 |

지금 당장 깨진 것은 없다. `spaces`가 0행이라 외래키 충돌이 아직 일어나지 않았다.
그러나 `values`로 저장된 사용자는 **어떤 목적 공간에도 들어갈 수 없는 상태**다.

## 4. 12종 의미 분석 (통합·삭제하지 않음)

### (가) 큰 관계 목적 후보 — DB 활성 4종과 대응
| 화면 id | 대응 DB id | 관계 |
| --- | --- | --- |
| friend | friend | 같은 개념, 문구만 다름 |
| romantic | romantic | 같은 개념, 문구만 다름 |
| conversation | conversation | 같은 개념, 문구 크게 다름 ("목적성 기반 대화 그룹" vs "깊은 대화부터 시작하고 싶어요") |
| — | open | **화면에 대응 없음** (아직 정하지 않았어요) |

### (나) Purpose 아래 세부 관심사·활동 후보 — 목적이 아니라 필터에 가깝다
interest(관심사) · startup(창업가) · professional(전문직) · creator(크리에이터) · project(프로젝트·스터디)
→ 이들은 "어떤 관계를 원하는가"가 아니라 "어떤 사람들과"에 해당한다. DB 비활성 6종(취미·운동·문화·지역·만들기)과 같은 축이다.

### (다) 중복
same-gender(동성 친구)는 friend(친구)의 하위 조건이다. 성별 조건은 목적이 아니라 매칭 조건이다.
colleague(동료)는 professional(전문직)과 겹친다.

### (라) 어디에도 대응하지 않음 — 별도 성격
- **values(가치관 기반 관계)**: 실제로 1명이 이미 선택했다. 관계 목적으로 볼 수도, 필터로 볼 수도 있다.
- **lgbtq(성소수자 보호 공간)**: `protected: true` 플래그가 붙은 유일한 항목이다. 이것은 목적이 아니라 **공간 정책**이다. 목적 목록에 섞으면 안 된다. 안전·정체성 보호는 별도 설계가 필요하고 법적 검토도 따른다.

## 5. Purpose 정본 권장안 (제시만, 실행 안 함)

**두 축을 분리한다.**

- **축 1 · 관계 목적 (Purpose)** — DB `purposes` 활성 4종을 정본으로 한다.
  friend · romantic · conversation · open.
  이유: 문구가 사용자 1인칭으로 쓰여 있고("친구를 만나고 싶어요"), ECHO 브랜드 톤과 맞는다.
  화면의 "친구 관계 / 이성 관계"는 카테고리 이름이고, DB 쪽은 사용자의 말이다. ECHO는 후자다.
  또 `open`(아직 정하지 않았어요)은 ECHO 철학에 중요한 선택지인데 화면에 없다.

- **축 2 · 관심사·활동 (Interest)** — 지금 결정하지 않는다.
  interest · startup · professional · creator · project와 DB 비활성 6종을 여기에 모은다.
  MVP에서는 쓰지 않고, 공간 기능을 만들 때 필터로 다시 꺼낸다.

- **제외** — same-gender · colleague (중복), lgbtq (공간 정책이지 목적이 아님. 별도 설계)

- **기존 데이터 2건**: `values` 1명은 `open`으로 볼지 새 목적으로 남길지 대표 판단이 필요하다.
  `romantic` 1명은 id가 맞으므로 문구만 DB 기준으로 다시 읽으면 된다. **어느 쪽도 이번에 건드리지 않았다.**

---

## 6. A 엔진 vs B 검증 엔진 — 서버 기능 비교

| 기능 | A 엔진 (doit-understanding v4) | B 검증 엔진 (gsq v48 + ej v26) | Plan A 필요 | GAP |
| --- | --- | --- | --- | --- |
| 사용자 원문 저장 | 있음 `doit_records.original_text` + `text` 분리 | 있음 `messages.content` | 필요 | 없음 |
| AI 후보 분리 | 있음 `doit_insights.ai_text` vs `text` | 있음 (후보 생성 후 서버 선별) | 필요 | 없음 |
| 맞아요 | 있음 `insight_confirm` → status=confirmed | 있음 choice=agree | 필요 | 없음 |
| 조금 달라요 | 있음 `insight_correct` → status=corrected | 있음 choice=alittle | 필요 | 없음 |
| 그게 아니에요 | 있음 `insight_reject` → status=rejected | 있음 choice=no | 필요 | 없음 |
| 직접 설명할게요 | 있음 `insight_self` → origin=self | 있음 choice=explain | 필요 | 없음 |
| Correction 반영 | 있음 (corrected 텍스트가 이후 근거) | 있음 (`pendingCorrection` + 앵커 제한) | 필요 | **B가 더 강함** |
| Rejected Semantic Block | 있음 **이중 차단** (bigram 겹침 + LLM 의미 판정) | 있음 (`rejected_key` + `rejected_text`) | 필요 | 없음 (A가 더 강함) |
| Context Memory | 부분 (이전 거절 목록만 주입) | 있음 (`[내가 확인한 기억]` 확정 의미 주입) | 필요 | **GAP-A1** |
| Information Status | 있음 `origin`(ai/self) × `status`(confirmed/corrected/rejected) | 부분 (understanding_results.choice) | 필요 | 없음 (A가 더 강함) |
| grounding (근거 없는 말 차단) | 부분 (프롬프트 지시) | 있음 (`not_grounded`·`unsupported_anchor` 코드 차단) | 필요 | **GAP-A2** |
| 다음 질문 변경 | 해당 없음 (질문형 흐름이 아님) | 있음 (상태별 질문 생성) | A UX에선 불필요 | 없음 |
| 서버 상태머신 | 있음 (RPC `doit_apply_*`가 상태 전이 결정) | 있음 (conversations.status) | 필요 | 없음 |
| 재접속 복원 | 있음 (서버 저장, 단 **스위치 off**) | 있음 | 필요 | **GAP-01** |
| timeout | 있음 25초 | 있음 6초 + 남은 예산만큼 최대 9초 | 필요 | **GAP-A3** |
| retry | 있음 (후보 전멸 시 재시도 루프) | 있음 (3회 + 구제 체인 5단계) | 필요 | **GAP-A4** |
| 관측 로그 | **없음** (console 출력 0건) | 있음 (40여 종 진단 로그) | 필요 | **GAP-A5** |
| 관리자 확인 | 있음 `admin_read` action | 있음 (admin-conversations) | 필요 | 없음 |
| FINAL100V4 검증 | **없음** | 있음 (실AI 100회) | 필요 | **GAP-A6** |

### 이식 대상 GAP (B에서 검증된 것 중 A에 없거나 약한 것)

| ID | 내용 | 크기 | 왜 필요 |
| --- | --- | --- | --- |
| GAP-A1 | 확정된 의미를 다음 생성에 주입 (Context Memory) | S | 같은 설명을 반복하게 만들지 않는다 |
| GAP-A2 | 근거 없는 후보를 코드로 차단 (grounding) | M | 프롬프트 지시만으로는 새어 나간다. B는 실측으로 확인됨 |
| GAP-A3 | 타임아웃 25초 → 남은 예산 기반으로 조정 | S | 25초는 사용자가 기다리기엔 길다 |
| GAP-A4 | 후보 전멸 시 구제 체인 (원문 인용으로 이어가기) | M | B에서 NO_CANDIDATE 0건을 만든 바로 그 장치 |
| GAP-A5 | 진단 로그 (규칙명·단계·횟수만, 원문 없음) | S | 지금 A 엔진은 실패해도 원인을 알 수 없다 |
| GAP-A6 | A 엔진 실AI 검증 | M | 스위치를 켜기 전에 필요 |

**B UI를 Plan A로 옮기지 않는다. B의 서버 규칙 6개만 A로 가져온다.**

---

## 7. PLAN A AI TARGET ARCHITECTURE (자산 재사용 중심)

```
사용자
  |
  v
Plan A UX  (유지: /doit/first-record → review → timeline/value/pattern/memory)
  |   "오늘 있었던 일을 남긴다"  →  "AI가 읽은 것을 보여준다"  →  4버튼
  |
  v
Edge: doit-understanding  (재사용. v4 그대로 + B 규칙 6개 이식)
  |     actions: record_create / record_update / insight_generate
  |              insight_confirm / insight_correct / insight_reject / insight_self
  |     인증: getUser() 실검증 → auth.uid() 소유권
  |     LLM: 후보만 생성 (PERSONA: 추측·판단·진단 금지)
  |     [이식] Context Memory · grounding 차단 · 적응 타임아웃 · 구제 체인 · 진단 로그
  |
  v
서버 상태머신 = DB 함수 (재사용. 이미 완성)
  |     doit_apply_record_create / record_update
  |     doit_apply_insight_generate / insight_self / insight_transition
  |     멱등: pg_advisory_xact_lock + payload_hash
  |     상태 전이는 DB 함수만 결정. 프론트는 직접 쓰기 불가 (RLS: SELECT only)
  |
  v
DB (재사용. 이미 완성)
  |     doit_records   : original_text / text / emotion / status / revision
  |     doit_insights  : ai_text / text / origin(ai|self) / status(confirmed|corrected|rejected)
  |     doit_request_events : 멱등 기록
  |     RLS: 본인 행 SELECT 만
  |
  v
다음 상태
        confirmed → 확정 의미로 다음 생성에 주입 (GAP-A1)
        corrected → 사용자 문장이 새 근거
        rejected  → 의미 차단 목록에 추가 (bigram + LLM 이중 판정)
  |
  v
(보존) B 엔진 get-step-question v48 / echo-journey v26
        conversations 608 · messages 11,856 · understanding_results 599
        → 지우지 않는다. Plan A에서 호출하지 않는다. 검증된 규칙의 원본으로 참조한다.
```

**재사용 비율**: Edge 1개·DB 함수 7개·테이블 3개 전부 재사용. 신규 제작 0.
이식 6건은 기존 Edge 안에서 규칙을 옮겨 심는 작업이다.

---

## 8. GAP 16건 재분류

### P0 — 보안·데이터 무결성 즉시 차단 (2건)

| ID | 내용 | 분류 근거 |
| --- | --- | --- |
| GAP-01 | Plan A 자기이해 서버 저장 OFF | **제품 핵심 데이터 손실.** 사용자가 남긴 기록·통찰이 브라우저에만 저장된다. 브라우저 정리·기기 변경으로 영구 소실된다. ECHO의 제품 가치 자체가 이 데이터다 |
| GAP-16 | Purpose 3중 충돌 | **현재 데이터 정합성 훼손.** 이미 1명이 DB에 없는 id로 저장됐고, 1명은 문구가 어긋났다. `spaces.purpose_id` 외래키가 걸려 있어 그 사용자는 앞으로 어떤 공간에도 들어갈 수 없다 |

### P1 — MVP 핵심 진행 차단 (4건)

| ID | 내용 | 분류 근거 |
| --- | --- | --- |
| GAP-02 | 공간 Membership | 두 사람이 만날 자리가 없다 |
| GAP-06 | 상호 선택 | ECHO의 차별점. 일방 연결을 막는 장치 |
| GAP-07 | 관계 열기 | 상호 선택 결과를 담을 곳 |
| GAP-A1~A6 | B 검증 규칙 6건을 A 엔진에 이식 | 스위치를 켜기 전에 필요. 특히 GAP-A6(검증)과 GAP-A5(로그)가 없으면 문제가 생겨도 원인을 못 찾는다 |

### P1 재분류 — 관리자 anon 함수 (GAP-15)

**P1로 내린다. P0 아니다.**
근거: `is_admin()`은 `select exists (... where p.id = auth.uid() and p.role = 'admin')`이다.
비로그인 호출 시 `auth.uid()`가 null이므로 항상 false를 반환한다.
다른 사용자의 role을 알아낼 수 없고, 권한이 올라가지도 않는다.
**실제 정보 노출 0 · 권한 상승 0.** 불필요한 노출면을 줄이는 정리 작업이다.

### P2 — 출시 후 개선 (4건)
GAP-03 협동 행동 · GAP-05 각자의 문 · GAP-09/10 관리자 분석 2개 · GAP-12 본인확인

### P2 특기 — GAP-04 정보 점진 공개
지금은 백엔드가 없어 위험이 없다. **만드는 순간 P0가 된다.**
개인정보를 API가 미리 내려주고 화면에서만 가리는 구조가 되면 그 자체가 유출이다.
설계 단계에서 RLS를 먼저 잡아야 한다는 조건을 붙여 P2에 둔다.

### MVP 제외 / 보류 (3건)

| ID | 내용 | 보류 근거 | 보존 대상 |
| --- | --- | --- | --- |
| GAP-11 | KEY 경제 | 사용자 5명. 경제를 돌릴 규모가 아니다. `key_spend`는 정책이 없어 안전하게 차단된 상태 | `key_balances`·`key_ledger`·`key_request_events`·RPC 5개 **전부 보존** |
| GAP-13 | 반복 패턴 엔진 | `doit_records` 0행. 패턴을 뽑을 데이터가 없다. 데이터가 쌓인 뒤 재판단 | `doit_insights.category='pattern'` 구조 보존 |
| — | 사람 등급 | 5명 전부 null, 계산 서버 없음. 사람을 등급으로 나누는 것이 ECHO 방향과 맞는지가 먼저 | `profiles.grade` 컬럼 보존 |
| GAP-14 | 가입 전 체험 서버 저장 | 체험은 브라우저에 있어도 된다. 로그인 후 이어가기만 되면 충분 | — |

**보류는 중단이지 삭제가 아니다. 테이블·함수·컬럼을 하나도 지우지 않는다.**

### 대표 결정 (3건으로 축소) — 9번 항목 참조

---

## 9. PHASE 3 최소 승인 후보

### 후보 1 · Plan A 자기이해 서버 저장 켜기

| 항목 | 내용 |
| --- | --- |
| 변경 목적 | 사용자 기록·통찰이 브라우저에서 사라지는 것을 멈춘다 |
| 실제 변경 대상 | 빌드 환경변수 `VITE_A_STRUCTURE_SERVER_ENABLED=true` → 재빌드 → Netlify 수동 업로드 |
| 재사용 자산 | Edge `doit-understanding` v4, DB 함수 7개, 테이블 3개 (전부 기존) |
| DB 변경 | 없음 |
| RLS 변경 | 없음 |
| Edge 변경 | 없음 (단 후보 2 이식을 먼저 할지 대표 판단) |
| 환경변수 변경 | 있음 (빌드 시점만. 운영 Secret 아님) |
| 기존 운영 데이터 영향 | 없음. `doit_records` 0행이라 잃을 것이 없다. 기존 브라우저 데이터는 자동 이전되지 않고 그대로 남는다 |
| 되돌리기 | 직전 ZIP 재업로드 (1분) |
| 테스트 | 로그인 → 기록 1건 작성 → 다른 브라우저로 로그인 → 같은 기록이 보이는지 |
| 대표 승인 | **필요** (Netlify 배포) |

### 후보 2 · B 검증 규칙 6건을 A 엔진에 이식

| 항목 | 내용 |
| --- | --- |
| 변경 목적 | 스위치를 켜기 전에 A 엔진을 B 수준으로 올린다 |
| 실제 변경 대상 | Edge `doit-understanding` 소스 1개 파일 |
| 재사용 자산 | B 엔진 `rules.ts`·`ai.ts`의 검증된 규칙 (복사 대상) |
| DB 변경 | 없음 |
| RLS 변경 | 없음 |
| Edge 변경 | **있음** (doit-understanding v4 → v5) |
| 환경변수 변경 | 없음 |
| 기존 운영 데이터 영향 | 없음 (읽기 방식만 바뀜) |
| 되돌리기 | v4 소스 재배포 |
| 테스트 | 실AI 회귀 (B의 FINAL100V4 방식을 A에 맞게 축소 적용) |
| 대표 승인 | **필요** (Edge 배포) |

### 후보 3 · Purpose 목록 통일

| 항목 | 내용 |
| --- | --- |
| 변경 목적 | 화면과 DB가 다른 목록을 보여주는 상태를 끝낸다 |
| 실제 변경 대상 | `PurposeSelect.tsx` — 하드코딩 배열을 DB 조회로 교체 |
| 재사용 자산 | `purposes` 테이블·읽기 정책(이미 전체 허용) |
| DB 변경 | 대표 결정에 따라 다름. 활성 4종 유지면 **없음** |
| RLS 변경 | 없음 |
| Edge 변경 | 없음 |
| 환경변수 변경 | 없음 |
| 기존 운영 데이터 영향 | 기존 2건은 건드리지 않는다. `values` 1명은 목록에서 사라진 목적을 갖게 되므로 재선택 안내가 필요하다 |
| 되돌리기 | 코드 되돌림 |
| 테스트 | 목적 선택 → DB 저장값이 `purposes.id`와 일치하는지 |
| 대표 승인 | **필요** (프론트 배포 + 어느 목록이 정본인지 결정) |

### 후보 4 · `is_admin()` anon 권한 회수

| 항목 | 내용 |
| --- | --- |
| 변경 목적 | 불필요한 노출면 제거 |
| 실제 변경 대상 | `revoke execute on function public.is_admin() from anon;` |
| DB 변경 | 권한만 |
| RLS 변경 | 없음 (정책 내용 불변) |
| 기존 운영 데이터 영향 | 없음 |
| 되돌리기 | `grant execute ... to anon;` |
| 테스트 | 비로그인 상태에서 해당 RPC 호출 시 거부되는지 · 관리자 화면 정상 동작 확인 |
| 대표 승인 | **필요** (DB 권한 변경) |
| 비고 | P1이므로 급하지 않다. 후보 1~3과 함께 처리해도 되고 나중에 해도 된다 |

---

## 10. 대표가 결정해야 할 것 — 3개

**결정 1 · Purpose 정본을 무엇으로 할까요?**
권장안은 DB 활성 4종(친구를 만나고 싶어요 / 연애로 이어질 만남을 원해요 / 깊은 대화부터 시작하고 싶어요 / 아직 정하지 않았어요)입니다.
화면의 12종 중 관심사 계열(창업가·전문직·크리에이터 등)은 목적이 아니라 필터로 나중에 씁니다.
성소수자 보호 공간은 목적이 아니라 공간 정책이라 따로 설계해야 합니다.

**결정 2 · A 엔진 스위치를 언제 켤까요?**
- (가) 지금 바로 켠다 — 데이터 손실이 오늘 멈춥니다. 대신 A 엔진은 아직 검증 전이고 진단 로그가 없습니다.
- (나) B 규칙 6건을 이식하고 검증한 뒤 켠다 — 안전하지만 그동안 데이터는 계속 브라우저에만 쌓입니다.
**작성자 의견**: (가). 현재 `doit_records`가 0행이라 실사용이 거의 없고, 서버에 저장되기 시작하는 것 자체가 이득이 큽니다. 이식은 그다음에 해도 됩니다.

**결정 3 · MVP 범위를 공간·관계까지 넣을까요?**
- (가) 넣는다 — 새 테이블 3~4개와 RPC가 필요합니다. "같은 목적의 사람과 이어진다"는 고리가 닫힙니다.
- (나) 이번엔 자기이해까지만 — 공간·관계는 다음 단계로 미룹니다.
이 결정에 따라 PHASE 4 범위가 크게 달라집니다.

---

## 11. 변경 내역

코드 0 · DB 0 · RLS 0 · Migration 0 · Edge 0 · Netlify 0 · 운영 데이터 0
