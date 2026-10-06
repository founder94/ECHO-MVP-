import { useState } from "react";
import { BottomSheet, Modal } from "@/doit/components/base/Modal";
import Button from "@/doit/components/base/Button";
import { exitReasons, safetyReasons } from "@/doit/mocks/do-it";
import {
  evaluateExitReward,
  REWARD_COPY,
  type RewardVerdict,
} from "@/doit/pages/do-it/room/reward";

interface ExitFlowProps {
  open: boolean;
  onClose: () => void;
  onExitRoom: () => void;
}

type Mode = "menu" | "normal" | "safety" | "reward";

export default function ExitFlow({ open, onClose, onExitRoom }: ExitFlowProps) {
  const [mode, setMode] = useState<Mode>("menu");
  const [reason, setReason] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [safetyReason, setSafetyReason] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<RewardVerdict | null>(null);
  const [submittedTexts, setSubmittedTexts] = useState<string[]>([]);
  const [tookBlock, setTookBlock] = useState(false);
  const [tookReport, setTookReport] = useState(false);

  const reset = () => {
    setMode("menu");
    setReason(null);
    setText("");
    setSafetyReason(null);
    setVerdict(null);
    setTookBlock(false);
    setTookReport(false);
  };

  const close = () => {
    onClose();
    setTimeout(reset, 200);
  };

  const submitNormal = () => {
    if (!reason) return;
    const v = evaluateExitReward(text, submittedTexts);
    if (text.trim()) {
      setSubmittedTexts((prev) => [...prev, text.trim()]);
    }
    setVerdict(v);
    setMode("reward");
  };

  const handleSafety = (action: "exit" | "block" | "report") => {
    if (action === "block") setTookBlock(true);
    if (action === "report") setTookReport(true);
    setVerdict("SAFETY_EXIT");
    setMode("reward");
  };

  if (mode === "menu") {
    return (
      <BottomSheet open={open} onClose={close} title="종료">
        <p className="mb-4 text-sm text-foreground-500">
          이 방을 떠날까요? 일반적인 이유와 안전 문제를 구분해서 도와드릴게요.
        </p>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" full onClick={() => setMode("normal")}>
            일반 종료
          </Button>
          <Button variant="outline" full onClick={() => setMode("safety")}>
            <i className="ri-shield-star-line text-primary-600" />
            <span className="text-primary-600">안전 종료 (즉시 나가기·차단·신고)</span>
          </Button>
          <Button variant="ghost" full onClick={close}>
            취소
          </Button>
        </div>
      </BottomSheet>
    );
  }

  if (mode === "normal") {
    return (
      <BottomSheet open={open} onClose={close} title="종료 이유">
        <p className="mb-3 text-xs text-foreground-500">
          종료하려면 이유를 하나 선택해 주세요.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {exitReasons.map((r) => (
            <button
              key={r.id}
              onClick={() => setReason(r.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                reason === r.id
                  ? "bg-primary-500 text-background-50"
                  : "bg-background-200 text-foreground-700"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="더 구체적으로 남기고 싶다면 적어주세요 (선택)"
          className="w-full resize-none rounded-xl border border-background-300 bg-background-50 px-4 py-3 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
        <div className="mt-1 text-right text-xs text-foreground-400">
          {text.length} / 500
        </div>
        <p className="mt-2 text-xs text-foreground-400">
          남긴 이유는 상대에게 그대로 전달되지 않아요.
        </p>
        <div className="mt-4">
          <Button full onClick={submitNormal} disabled={!reason}>
            종료하기
          </Button>
        </div>
      </BottomSheet>
    );
  }

  if (mode === "safety") {
    return (
      <BottomSheet open={open} onClose={close} title="안전하게 나가기">
        <div className="mb-3 rounded-xl border border-primary-200 bg-primary-50 p-3">
          <p className="text-xs leading-relaxed text-primary-800">
            불편하거나 위험하다고 느꼈다면, 이유를 쓰지 않아도 바로 나갈 수 있어요.
            필요하면 차단·신고도 함께 할 수 있어요.
          </p>
        </div>
        <p className="mb-2 text-xs font-semibold text-foreground-700">
          어떤 상황이었나요? (선택)
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {safetyReasons.map((r) => (
            <button
              key={r.id}
              onClick={() => setSafetyReason(r.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                safetyReason === r.id
                  ? "bg-primary-500 text-background-50"
                  : "bg-background-200 text-foreground-700"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <Button full onClick={() => handleSafety("exit")}>
            바로 나가기
          </Button>
          <Button variant="outline" full onClick={() => handleSafety("block")}>
            차단하고 나가기
          </Button>
          <Button variant="outline" full onClick={() => handleSafety("report")}>
            <i className="ri-alarm-warning-line text-primary-600" />
            <span className="text-primary-600">신고하고 나가기</span>
          </Button>
        </div>
      </BottomSheet>
    );
  }

  const copy = verdict ? REWARD_COPY[verdict] : null;
  return (
    <Modal open={open} onClose={close} title={copy?.title}>
      {copy && (
        <>
          <p className="text-sm leading-relaxed text-foreground-600">{copy.body}</p>
          {verdict === "VALID" && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-background-200 bg-background-100 p-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-100 text-secondary-900">
                <i className="ri-gift-line text-base" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground-950">+1 Reward KEY</p>
                <p className="text-xs text-foreground-500">
                  데모 지급이에요. 실제 지급은 서버 정책이 결정해요.
                </p>
              </div>
            </div>
          )}
          {verdict === "SAFETY_EXIT" && (tookBlock || tookReport) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {tookBlock && (
                <span className="rounded-full bg-background-200 px-3 py-1 text-xs text-foreground-700">
                  차단 완료
                </span>
              )}
              {tookReport && (
                <span className="rounded-full bg-background-200 px-3 py-1 text-xs text-foreground-700">
                  신고 접수 완료
                </span>
              )}
            </div>
          )}
          <div className="mt-4">
            <Button full onClick={onExitRoom}>
              확인
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}