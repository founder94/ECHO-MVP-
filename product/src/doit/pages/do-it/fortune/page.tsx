import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SajuTaroEntry } from "@/doit/app/plan-a/screens/SajuTaroEntry";
import { SajuInput } from "@/doit/app/plan-a/screens/SajuInput";
import { TaroCardSelect } from "@/doit/app/plan-a/screens/TaroCardSelect";
import { FreeResult } from "@/doit/app/plan-a/screens/FreeResult";
import { SajuResult } from "@/doit/app/plan-a/screens/SajuResult";
import type { SajuInput as SajuCalcInput } from "@/doit/lib/saju/engine";
import { readSelectedCard } from "@/doit/app/plan-a/screens/FreeResult.parts";
import { setContentSeed } from "@/doit/lib/contentSeed";
import { MenuButton } from "@/doit/components/feature/TopBar";

// 사주·타로 — 햄버거 메뉴에서 진입하는 별도 무료 재미 기능.
// A구조의 필수 과정(목적 → 프로필 → 공간)과 분리되어 있으며,
// 목적·가입·프로필·매칭 흐름은 포함하지 않는다.
// 결과 화면에서 "이어서 관계 탐색"을 고르면 A 진입(목적)으로 안내한다.
//
// ※ 타로 해석은 openai-chat 함수로 실제 제공된다(이 파일에서 타로 흐름은 바꾸지 않았다).
// ※ 2026-09-26 대표 「SAJU / TAROT FINAL LOCK」: 사주는 계산 엔진(src/doit/lib/saju/engine.ts)으로 실제 명식을 만들고
//   SajuResult 가 보인다. 입력은 이 화면 상태에만 있다(저장·전송 0). 사주만 보고 나가도 된다.

// 2026-09-26 대표 §17: 사주·타로 화면에서도 햄버거 메뉴(대화·나의 이해 등으로 이동 · 대화는 서버에 있어 돌아가면 이어진다).
const menu = (
  <div className="fixed right-3 z-50" style={{ top: "calc(env(safe-area-inset-top) + 10px)" }}>
    <MenuButton onDark />
  </div>
);

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
      <>{menu}<SajuTaroEntry
        onSaju={() => {
          setMode("saju");
          setStep("input");
        }}
        onTaro={() => {
          setMode("taro");
          setStep("input");
        }}
      /></>
    );
  }

  if (step === "input") {
    if (mode === "saju") {
      return (
        <>{menu}<SajuInput initial={sajuInput} onNext={(input) => { setSajuInput(input); setStep("result"); }} onSwitchToTaro={() => setMode("taro")} /></>
      );
    }
    return (
      <>{menu}<TaroCardSelect
        onNext={() => setStep("result")}
        onSwitchToSaju={() => setMode("saju")}
      /></>
    );
  }

  if (mode === "saju" && sajuInput) {
    // 2026-09-26 대표 MASTER §13~§15: 결과 종류(세 갈래 중 하나)만 이야기 거리로 넘긴다 — 생년월일·시간·명식은 넘기지 않는다.
    return <>{menu}<SajuResult input={sajuInput} onEdit={() => setStep("input")} onExit={exitToHome} onTalk={(key) => { setContentSeed({ source: "SAJU", key }); navigate("/doit/conversation"); }} /></>;
  }

  return (
    <>{menu}<FreeResult
      mode={mode}
      // MASTER §14·§16: 타로 결과 → ECHO 대화(카드 이름만 이야기 거리로 · 해석 글은 넘기지 않는다). 타로 화면 파일은 바꾸지 않았다.
      onJoin={() => { const c = readSelectedCard(); if (c) setContentSeed({ source: "TAROT", card: c.card.nameKo }); navigate("/doit/conversation"); }}
      onExit={exitToHome}
    /></>
  );
}