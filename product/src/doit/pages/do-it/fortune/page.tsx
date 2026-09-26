import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SajuTaroEntry } from "@/doit/app/plan-a/screens/SajuTaroEntry";
import { SajuInput } from "@/doit/app/plan-a/screens/SajuInput";
import { TaroCardSelect } from "@/doit/app/plan-a/screens/TaroCardSelect";
import { FreeResult } from "@/doit/app/plan-a/screens/FreeResult";
import { SajuResult } from "@/doit/app/plan-a/screens/SajuResult";
import type { SajuInput as SajuCalcInput } from "@/doit/lib/saju/engine";

// 사주·타로 — 햄버거 메뉴에서 진입하는 별도 무료 재미 기능.
// A구조의 필수 과정(목적 → 프로필 → 공간)과 분리되어 있으며,
// 목적·가입·프로필·매칭 흐름은 포함하지 않는다.
// 결과 화면에서 "이어서 관계 탐색"을 고르면 A 진입(목적)으로 안내한다.
//
// ※ 타로 해석은 openai-chat 함수로 실제 제공된다(이 파일에서 타로 흐름은 바꾸지 않았다).
// ※ 2026-09-26 대표 「SAJU / TAROT FINAL LOCK」: 사주는 계산 엔진(src/doit/lib/saju/engine.ts)으로 실제 명식을 만들고
//   SajuResult 가 보인다. 입력은 이 화면 상태에만 있다(저장·전송 0). 사주만 보고 나가도 된다.

type Mode = "saju" | "taro";
type Step = "entry" | "input" | "result";

export default function Fortune() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("entry");
  const [mode, setMode] = useState<Mode>("saju");
  const [sajuInput, setSajuInput] = useState<SajuCalcInput | null>(null);

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
        <SajuInput onNext={(input) => { setSajuInput(input); setStep("result"); }} onSwitchToTaro={() => setMode("taro")} />
      );
    }
    return (
      <TaroCardSelect
        onNext={() => setStep("result")}
        onSwitchToSaju={() => setMode("saju")}
      />
    );
  }

  if (mode === "saju" && sajuInput) {
    return <SajuResult input={sajuInput} onEdit={() => setStep("input")} onExit={exitToHome} onTalk={() => navigate("/doit/conversation")} />;
  }

  return (
    <FreeResult
      mode={mode}
      onJoin={() => navigate("/doit/start-journey")}
      onExit={exitToHome}
    />
  );
}