# A 음악 카드 — 2026-09-13 수신 기록 (래디 보고문, 대표 채팅 붙여넣기)

## 수신 범위
| 항목 | 수신 |
|---|---|
| DOIT_A_MUSIC_CLAUDE_REVIEW_HANDOFF_20260913.zip | **미도착** (업로드 폴더 0건) |
| src/pages/do-it/hero/components/OriginalMusicCard.tsx 전체 | **미수신** (래디 보고문에 함수 2개 전문 + 부분 diff 7개만) |
| retryPlay 전문 / togglePlay 전문 | 수신 |
| diff C-1~C-7 (isNotAllowedError 헬퍼, errorState 상태, onPlaying/onEnded/playTrack/stopAll catch, 안내 JSX) | 수신(부분) |
| TRACKS(원격 URL) · playTrack · stopAll · onEnded 이어듣기 · 이벤트 바인딩 · JSX 전체 | 미수신 |
| audio/origin-1.mp3 · origin-2.mp3 · MANIFEST.json · SOURCE_PROVENANCE.md · tests/ · evidence/ | 미수신 |

## 래디 자체 보고 (그대로 옮김 · Claude 검증 아님)
- 수정 파일 1개(OriginalMusicCard.tsx), 라우트·배치·다른 파일 미접촉
- togglePlay 일시정지 분기 requestIdRef += 1 추가, 곡·위치·이어듣기 보존
- blocked 불리언 → errorState('blocked'|'failed'|null), NotAllowedError 만 차단 문구
- build 통과(래디 환경). type-check/lint NOT RUN(래디 셸 없음)

## 수신 원문 — retryPlay
```ts
  const retryPlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || trackRef.current === null) return;
    const reqId = ++requestIdRef.current;
    audio
      .play()
      .then(() => {
        if (reqId !== requestIdRef.current || !aliveRef.current) return;
        setErrorState(null);
      })
      .catch((err) => {
        if (reqId !== requestIdRef.current || !aliveRef.current) return;
        if (isAbortError(err)) return;
        setErrorState(isNotAllowedError(err) ? 'blocked' : 'failed');
      });
  }, []);
```

## 수신 원문 — togglePlay
```ts
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || trackRef.current === null) return;
    if (isPlaying) {
      requestIdRef.current += 1;
      audio.pause();
      return;
    }
    const reqId = ++requestIdRef.current;
    audio
      .play()
      .then(() => {
        if (reqId !== requestIdRef.current || !aliveRef.current) return;
        setErrorState(null);
      })
      .catch((err) => {
        if (reqId !== requestIdRef.current || !aliveRef.current) return;
        if (isAbortError(err)) return;
        setErrorState(isNotAllowedError(err) ? 'blocked' : 'failed');
        setIsPlaying(false);
      });
  }, [isPlaying]);
```

## 수신 원문 — diff 조각 (C-1 헬퍼)
```ts
function isNotAllowedError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: number };
  return e.name === 'NotAllowedError';
}
```
(C-2~C-7 은 setBlocked→setErrorState 치환, 일시정지 분기 requestIdRef 증가, 안내 JSX 분기. 전문은 대표 채팅 원문 참조.)

## Claude 정적 검토 (수신 범위 한정 · 실행 없음)
- 일치: 재생 요청 번호(requestIdRef)·aliveRef 가드가 retryPlay/togglePlay 양쪽 성공·실패 경로에 있음. 늦은 Promise 가 현재 상태를 덮지 않는 구조.
- 일치: 일시정지 분기가 요청 번호를 올린 뒤 pause → 진행 중이던 play() 는 AbortError 로 거절되고 isAbortError 로 무시됨. currentTime 을 건드리지 않아 같은 위치 재개 가능(코드상).
- 일치: 성공 경로에서 setIsPlaying(true) 를 하지 않음 → 실제 `playing` 이벤트 기준 표시(onPlaying 에서 설정, C-3).
- 일치: NotAllowedError 만 'blocked', 그 외 'failed'. 기술 오류 문자열 노출 없음.
- 확인 불가(미수신): TRACKS URL·onEnded 이어듣기 종료(무한반복 여부)·stopAll 의 "늦은 자동 재시작" 방지·이벤트 해제·JSX 버튼 이름/키보드·배치 위치. 이 부분은 전체 파일이 있어야 판단.
- 관찰(버그 단정 아님): retryPlay 실패 경로는 setIsPlaying(false) 를 호출하지 않음(togglePlay 는 호출). 재시도는 정지 상태에서만 눌린다면 영향 없음. 전체 파일 확인 후 판단.
- 관찰: `isNotAllowedError` 의 `code?: number` 필드는 사용되지 않음(타입만). lint 의 unused 규칙에는 걸리지 않는 형태(객체 타입 속성)라 무해.

## 판정
SOURCE PARTIAL — 카드 단위 브라우저 검사(A~J)·원음 검사·type-check/lint/build 전부 NOT RUN. 전체 파일 + 원음 ZIP 수신 후 실행.
