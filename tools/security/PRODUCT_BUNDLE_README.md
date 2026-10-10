# Private product source wrapper

`product/package.json`의 기존 보안 lifecycle은 `../tools/security/patch-braces.cjs`를 실행한다. 따라서 `product/`만 보내면 보안 검사가 실패한다. 이 도구는 코드를 바꾸거나 보안 검사를 없애지 않고 `product/`와 정확한 guard를 같은 비공개 wrapper에 넣는다.

저장소 루트에서:

```sh
node tools/security/prepare-product-bundle.cjs /absolute/repository /absolute/new-private-wrapper 40_character_source_commit
node --test --test-isolation=none tools/security/prepare-product-bundle.test.cjs
```

실제 40자리 전체 커밋을 사용한다. 출력은 기존 폴더를 덮어쓰지 않으며 source 바깥에 만들어야 한다. source·guard·output의 심볼릭 링크를 따라가지 않는다. guard Git blob은 `b6ab1f40332998cc3fe29cf109948691fd947aa6`으로 고정했으며 바뀌면 재검토해야 한다. 현재 승인된 `postinstall/prebuild/prebuild:app/prebuild:brand` 네 명령을 유지한다.

파일과 하위 폴더는 비공개 권한으로 만들고 복사 파일의 SHA256을 대조한다. `.env`, 자격증명 보관함·설정 백업, 세션 저장 파일, 설치 폴더·검사 결과 등은 이름으로 제외한다. 포함된 일반 인증 코드 파일은 유지한다.

**중요한 구분:** `sourceCommit`은 호출자가 준 라벨이다. 이 도구는 Git 서버에서 원본을 확인하지 않으므로 manifest에 `DECLARED_NOT_GIT_VERIFIED`를 표시한다. 검수 담당이 별도로 실제 커밋·원본 바이트를 대조해야 한다. 이름 제외는 파일 본문 전체의 키·개인정보 검사와 다르며 `sensitivityReview: NOT_PERFORMED`로 남긴다. source는 쓰기 중인 폴더 대신 변경이 멈춘 정확한 스냅샷을 사용한다. 중간 오류가 난 wrapper는 제출하지 않는다.

이 도구는 npm 설치·모델 호출·서버 검사·DB 변경·배포·업로드를 실행하지 않는다. wrapper의 `product/`에서 기존 설치와 빌드를 실행할 수 있도록 구조만 준비한다. 비공개 wrapper 생성은 외부 공유 승인이나 사이트 반영 완료가 아니다. 테스트는 가상 파일이며 실제 계정·대화·키를 사용하지 않는다.

복구: 이 새로운 도구의 사용을 멈추면 된다. 제품·서버·DB 상태는 바뀌지 않는다. 출력 폴더는 제출 전 검토하고 다른 작업과 분리해 관리한다.
