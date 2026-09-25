import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SajuTaroEntry } from "@/doit/app/plan-a/screens/SajuTaroEntry";
import { SajuInput } from "@/doit/app/plan-a/screens/SajuInput";
import { TaroCardSelect } from "@/doit/app/plan-a/screens/TaroCardSelect";
import { FreeResult } from "@/doit/app/plan-a/screens/FreeResult";

// 사주·타로 — 햄버거 메뉴에서 진입하는 별도 무료 재미 기능.
// A구조의 필수 과정(목적 → 프로필 → 공간)과 분리되어 있으며,
// 목적·가입·프로필·매칭 흐름은 포함하지 않는다.
// 결과 화면에서 "이어서 관계 탐색"을 고르면 A 진입(목적)으로 안내한다.
//
// ※ 타로 해석은 openai-chat 함수로 실제 제공된다. 사주 명식 엔진은 아직 미연결이라
//   사주 결과 화면은 가짜 명식을 만들지 않고 "준비 중"으로 표시한다.

type Mode = "saju" | "taro";
type Step = "entry" | "input" | "result";

export default function Fortune() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("entry");
  const [mode, setMode] = useState<Mode>("saju");

  const exitToHome = () => navigate("/doit/home");

  if (step === "entry") {
    return (
      <SajuTaroEntry
        onSaju={() => {
          setMode("saju");
          setStep("input");
        }}
        onTaro={() => {
          setMode("taro");
          setStep("input");
        }}
      />
    );
  }

  if (step === "input") {
    if (mode === "saju") {
      return (
        <SajuInput onNext={() => setStep("result")} onSwitchToTaro={() => setMode("taro")} />
      );
    }
    return (
      <TaroCardSelect
        onNext={() => setStep("result")}
        onSwitchToSaju={() => setMode("saju")}
      />
    );
  }

  return (
    <FreeResult
      mode={mode}
      onJoin={() => navigate("/doit/start-journey")}
      onExit={exitToHome}
    />
  );
}