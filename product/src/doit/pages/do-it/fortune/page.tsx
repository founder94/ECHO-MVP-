import { useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SajuTaroEntry } from "@/doit/app/plan-a/screens/SajuTaroEntry";
import { SajuInput } from "@/doit/app/plan-a/screens/SajuInput";
import { TaroCardSelect } from "@/doit/app/plan-a/screens/TaroCardSelect";
import { FreeResult } from "@/doit/app/plan-a/screens/FreeResult";
import { SajuResult } from "@/doit/app/plan-a/screens/SajuResult";
import type { SajuInput as SajuCalcInput } from "@/doit/lib/saju/engine";
import { readSelectedCard } from "@/doit/app/plan-a/screens/FreeResult.parts";
import { setContentSeed } from "@/doit/lib/contentSeed";
import "@/doit/components/feature/app-pastel.css";
import "./fortune-space.css";

// 사주·타로 — 햄버거 메뉴에서 진입하는 별도 무료 재미 기능.
// A구조의 필수 과정(목적 → 프로필 → 공간)과 분리되어 있으며,
// 목적·가입·프로필·매칭 흐름은 포함하지 않는다.
// 결과 화면에서 "이어서 관계 탐색"을 고르면 A 진입(목적)으로 안내한다.
//
// ※ 타로 해석은 openai-chat 함수로 실제 제공된다(이 파일에서 타로 흐름은 바꾸지 않았다).
// ※ 2026-09-26 대표 「SAJU / TAROT FINAL LOCK」: 사주는 계산 엔진(src/doit/lib/saju/engine.ts)으로 실제 명식을 만들고
//   SajuResult 가 보인다. 입력은 이 화면 상태에만 있다(저장·전송 0). 사주만 보고 나가도 된다.

// 2026-09-28: 메뉴는 모든 제품 화면 공통 오른쪽 위 하나(src/components/AppCornerMenu.tsx).

// 2026-10-01 대표 결정 「Saju / Tarot = ECHO 파스텔 세계관 유지」: 완전한 어두운 앱으로 떼지 않고, 같은 파스텔 공간에서
// 빛(저녁빛 막) · 깊이(카드 그림자) · 재질(옅은 결) · 글자(명조 제목)만 달리해 「조금 다른 방」처럼 느끼게 한다. 재미·참고 콘텐츠(매칭 근거 0).
function FortuneSpace({ children }: { children: ReactNode }) {
  return <div className="doit-app-pastel echo-fortune-space"><span className="echo-fortune-light" aria-hidden="true" />{children}</div>;
}

type Mode = "saju" | "taro";
type Step = "entry" | "input" | "result";

export default function Fortune() {
  const navigate = useNavigate();
  // Codex PR #140 P2(4184790623): 타로 결과에서 「로그인하고 해석 보기」로 나갔다 오면(?view=taro) 오늘 고른 카드의 결과 화면으로 바로 돌아온다(고른 카드 없으면 처음 화면).
  const [params] = useSearchParams();
  const backToTaro = params.get("view") === "taro" && readSelectedCard() !== null;
  const [step, setStep] = useState<Step>(backToTaro ? "result" : "entry");
  const [mode, setMode] = useState<Mode>(backToTaro ? "taro" : "saju");
  const [sajuInput, setSajuInput] = useState<SajuCalcInput | null>(null);

  const exitToHome = () => navigate("/doit/home");

  if (step === "entry") {
    return (
      <FortuneSpace><SajuTaroEntry
        onSaju={() => {
          setMode("saju");
          setStep("input");
        }}
        onTaro={() => {
          setMode("taro");
          setStep("input");
        }}
      /></FortuneSpace>
    );
  }

  if (step === "input") {
    if (mode === "saju") {
      return (
        <FortuneSpace><SajuInput initial={sajuInput} onNext={(input) => { setSajuInput(input); setStep("result"); }} onSwitchToTaro={() => setMode("taro")} /></FortuneSpace>
      );
    }
    return (
      <FortuneSpace><TaroCardSelect
        onNext={() => setStep("result")}
        onSwitchToSaju={() => setMode("saju")}
      /></FortuneSpace>
    );
  }

  if (mode === "saju" && sajuInput) {
    // 2026-09-26 대표 MASTER §13~§15: 결과 종류(세 갈래 중 하나)만 이야기 거리로 넘긴다 — 생년월일·시간·명식은 넘기지 않는다.
    return <FortuneSpace><SajuResult input={sajuInput} onEdit={() => setStep("input")} onExit={exitToHome} onTalk={(key) => { setContentSeed({ source: "SAJU", key }); navigate("/doit/conversation"); }} /></FortuneSpace>;
  }

  return (
    <FortuneSpace><FreeResult
      mode={mode}
      // MASTER §14·§16: 타로 결과 → ECHO 대화(카드 이름만 이야기 거리로 · 해석 글은 넘기지 않는다). 타로 화면 파일은 바꾸지 않았다.
      onJoin={() => { const c = readSelectedCard(); if (c) setContentSeed({ source: "TAROT", card: c.card.nameKo }); navigate("/doit/conversation"); }}
      onExit={exitToHome}
    /></FortuneSpace>
  );
}