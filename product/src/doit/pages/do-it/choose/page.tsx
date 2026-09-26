import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  PathSelect,
  type PathChoice,
} from "@/doit/app/plan-a/screens/PathSelect";
import { getAppMode, setAppMode } from "@/lib/echo/appMode";
import { visibleInRelease } from "@/doit/lib/releaseScope";

// 확정 흐름 ②: DO IT만 / ECHO만 / 둘 다 선택.
// - echo      → 기존 B 흐름(ECHO, /weather)으로 바로 진입
// - doit·both → 스크롤 소개 9구간으로 진입한 뒤 목적 선택·진행 복원으로 이어진다.
// 일반 재방문(이미 선택한 사용자)은 자동 이동으로 같은 선택을 반복시키지 않는다.
// 단 "여정 다시 고르기"(?rechoose=1)로 진입하면 저장된 선택값이 있어도 선택 화면에 머물러 다시 고를 수 있다.
// 사주·타로는 필수 단계가 아니라 원할 때만 보는 무료 기능이라
// "건너뛰기" 링크(/doit/fortune)로만 안내한다.
export default function Choose() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 명시적 재선택 여부: true면 자동 이동하지 않고 선택 화면에 머문다.
  const rechoose = searchParams.get("rechoose") === "1";
  const [existing] = useState(() => getAppMode());

  useEffect(() => {
    if (rechoose) return;
    if (!existing) return;
    // 2026-09-20 대표 확정: 브라우저에 남아 있던 예전 선택값('echo')만으로
    // 마음 날씨로 되돌리지 않는다. 재방문은 항상 Plan A 소개 흐름으로 이어진다.
    navigate("/do-it/landing", { replace: true });
  }, [rechoose, existing, navigate]);

  if (existing && !rechoose) return null;

  const handleDoit = (choice: PathChoice) => {
    setAppMode(choice);
    navigate("/do-it/landing");
  };

  const handleEcho = () => {
    setAppMode("echo");
    navigate("/weather");
  };

  return (
    <PathSelect
      onDoit={handleDoit}
      onEcho={handleEcho}
      // 2026-09-26 MVP: 사주·타로 숨김(releaseScope) — 숨긴 동안 「먼저 무료 사주·타로」 버튼을 넘기지 않는다.
      onSkipToFortune={visibleInRelease("/doit/fortune") ? () => navigate("/doit/fortune") : undefined}
    />
  );
}