# ECHO 대표 제품 리서치 (FOUNDER_PRODUCT_RESEARCH)

대표가 소개팅·매칭·관계 서비스를 직접 써 보며 얻은 관찰을 **제품 가설**로 보관한다. (2026-09-26 대표 승인 「데이터 자산 2차」)

- 정본: `docs/research/data/observations.json`
- 검사: `node --test product/spike/research/research.test.mjs` (규칙: `product/spike/research/research-lib.mjs`)
- 운영 DB에 넣지 않는다. 앱·서버 코드는 이 폴더를 읽지 않는다(`product/qa/data-asset-separation.test.mjs`가 막는다).

## 네 가지 데이터는 섞지 않는다

| 종류 | 어디에 | 사용자 사실로 쓸 수 있나 |
|---|---|---|
| A. 대표 AI 실패 `FOUNDER_AI_FAILURE` | `docs/failure-intelligence/data/failures.json` | 불가 (`user_fact: false`) |
| **B. 대표 제품 리서치 `FOUNDER_PRODUCT_RESEARCH`** | **여기** | **불가** |
| C. ECHO Agent 실패 `AGENT_FAILURE` + 실제 AI run 기록 | `failures.json` · `docs/failure-intelligence/runs/` | 불가 |
| D. 실제 ECHO 사용자 행동 | 운영 DB(`doit_records`·`doit_insights`·`doit_request_events`·`doit_matches`) | 사용자가 직접 말하고, 확인하고, 정정한 것만 |

## 상태 흐름

```
UNVALIDATED_HYPOTHESIS ──(검증 방법 정함)──▶ IN_VALIDATION ──(ECHO 사용자 데이터로 확인)──▶ VALIDATED_BY_ECHO_USERS ──▶ 정책 후보 ──▶ 대표 승인
                                                                                     └──▶ REFUTED_BY_ECHO_USERS
```

- 새 관찰은 언제나 `UNVALIDATED_HYPOTHESIS`로 시작한다.
- `VALIDATED_BY_ECHO_USERS`·`REFUTED_BY_ECHO_USERS`로 올리려면 조건이 둘 다 필요하다.
  - `validation.echo_user_data: true`
  - 저장소 안 근거 파일(`validation.ref`, 비식별 집계만)과 결과(`validation.result`)
- `policy_candidate: true`는 ECHO 사용자로 검증된 가설만 가질 수 있다.
- `founder_approval.approved: true`는 정책 후보만 가질 수 있고, 날짜가 필요하다.
- 어느 단계에서도 `user_fact`·`usable_for_profile`·`usable_for_matching`은 `false`다. 정책이 되더라도 사용자 한 명에 대한 사실이 되지는 않는다.

## 넣지 않는 것 (개인정보)

다른 서비스 사용자의 다음 정보는 넣지 않는다.
- 이름·닉네임·계정 아이디
- 이메일·전화번호
- 사진 원본·캡처(이미지 파일·주소 포함)
- 대화 원문, 위치, 생년월일

**패턴만** 요약해 적는다(한 칸 300자 이하). 검사가 칸 이름과 글자 흔적(이메일·전화번호·주소·이미지 파일·@아이디·주민번호 모양)을 막는다. 원본 캡처가 필요하면 저장소 밖 대표 개인 보관함에 두고, 보관 기간은 대표가 정한다.

## 칸 (예시 — 실제 데이터 아님)

```json
{
 "id": "RS-01",
 "dataset": "FOUNDER_PRODUCT_RESEARCH",
 "date": "2026-09-26",
 "service_category": "dating",
 "area": "photo",
 "observation": "가입 초기에 사진 6장을 요구",
 "founder_experience": "부담이 컸음",
 "hypothesis": "초기 이탈 가능성 증가",
 "echo_candidate": "초기 2~3장 + 이후 추가",
 "status": "UNVALIDATED_HYPOTHESIS",
 "validation": { "echo_user_data": false, "method": null, "ref": null, "result": null },
 "policy_candidate": false,
 "founder_approval": { "approved": false, "date": null },
 "user_fact": false,
 "usable_for_profile": false,
 "usable_for_matching": false,
 "pii_check": "PATTERN_ONLY",
 "refs": []
}
```

- `service_category`: dating · matching · friendship · community · other
- `area`: signup · photo · profile · matching · messaging · payment · retention · safety · other
- `pii_check: "PATTERN_ONLY"`는 넣는 사람이 "패턴만 남겼다"고 확인했다는 표시다.
- 현재 관찰은 **0건**이다. 대표가 실제로 겪은 관찰을 줄 때만 추가한다(지어내지 않는다).
