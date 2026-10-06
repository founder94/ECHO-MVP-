import { useEffect, useState } from "react";
import Button from "@/doit/components/base/Button";
import Card from "@/doit/components/base/Card";

interface DoorFlowProps {
  onBack: () => void;
  onNavigateSpaces: () => void;
}

type Step = "choose" | "waiting" | "result";

export default function DoorFlow({ onBack, onNavigateSpaces }: DoorFlowProps) {
  const [step, setStep] = useState<Step>("choose");
  const [connected, setConnected] = useState(false);
  const [signalSent, setSignalSent] = useState(false);

  useEffect(() => {
    if (step !== "waiting") return;
    const t = setTimeout(() => {
      // 데모: 상대방도 '계속'을 선택했다고 시뮬레이션한다.
      setConnected(true);
      setStep("result");
    }, 1600);
    return () => clearTimeout(t);
  }, [step]);

  if (step === "choose") {
    return (
      <div className="animate-fade-up pt-2">
        <Card padding="lg" className="mb-4 text-center">
          <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <i className="ri-door-open-line text-3xl" />
          </span>
          <h2 className="font-heading text-xl font-semibold text-foreground-950">
            각자의 문
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground-500">
            미션을 함께 끝냈어요. 이제 각자 마음의 문을 열지 결정해요.
            <br />
            이 선택은 상대에게 공개되지 않아요.
          </p>
        </Card>

        <div className="mb-3 rounded-2xl border border-background-200 bg-background-50 p-4">
          <div className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center text-foreground-500">
              <i className="ri-lock-2-line text-sm" />
            </span>
            <p className="text-xs leading-relaxed text-foreground-500">
              두 사람 모두 '계속'을 선택해야만 다음 단계가 열려요. 한쪽의 선택만으로는
              열리지 않아요.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button variant="primary" full size="lg" onClick={() => setStep("waiting")}>
            계속하고 싶어요
          </Button>
          <Button
            variant="outline"
            full
            size="lg"
            onClick={() => {
              setConnected(false);
              setStep("result");
            }}
          >
            잠시 보류할게요
          </Button>
        </div>

        <div className="mt-4">
          <Button variant="ghost" full onClick={onBack}>
            방으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  if (step === "waiting") {
    return (
      <div className="animate-fade-up flex min-h-[60vh] flex-col items-center justify-center gap-4 pt-2 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-primary-700">
          <i className="ri-loader-4-line animate-spin-slow text-3xl" />
        </span>
        <h2 className="font-heading text-lg font-semibold text-foreground-950">
          상대방의 선택을 기다리는 중이에요
        </h2>
        <p className="text-sm text-foreground-500">
          나의 선택은 안전하게 보관돼요. 서로의 선택이 겹치면 알려드릴게요.
        </p>
        <p className="rounded-full bg-background-200 px-3 py-1 text-xs text-foreground-500">
          데모: 상대방의 선택을 시뮬레이션하고 있어요
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-up pt-2">
      {connected ? (
        <>
          <Card padding="lg" className="mb-4 border-accent-200 bg-accent-50 text-center">
            <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-accent-100 text-accent-700">
              <i className="ri-hand-heart-line text-3xl" />
            </span>
            <h2 className="font-heading text-xl font-semibold text-foreground-950">
              연결이 열렸어요
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground-600">
              서로의 선택이 겹쳤어요. 이제 다음 공간에서 함께 활동을 이어갈 수 있어요.
            </p>
          </Card>

          <Card padding="md" className="mb-3">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-secondary-900">
                <i className="ri-sparkling-2-line text-lg" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground-950">Signal 보내기</p>
                <p className="mt-0.5 text-xs text-foreground-500">
                  가벼운 관심 표현이에요. 무료이고, 관계가 성립되는 건 아니에요.
                </p>
              </div>
            </div>
            <div className="mt-3">
              <Button
                variant="secondary"
                full
                size="sm"
                disabled={signalSent}
                onClick={() => setSignalSent(true)}
              >
                {signalSent ? "Signal을 보냈어요" : "관심 표현 보내기"}
              </Button>
            </div>
            {signalSent && (
              <p className="mt-2 text-center text-xs text-foreground-500">
                Signal을 보냈어요. 상대가 같은 마음이면 다음 공간 후보에 함께 올라요.
              </p>
            )}
          </Card>

          <div className="flex flex-col gap-3">
            <Button variant="primary" full onClick={onNavigateSpaces}>
              다음 공간으로
            </Button>
            <Button variant="ghost" full onClick={onBack}>
              방으로 돌아가기
            </Button>
          </div>
        </>
      ) : (
        <>
          <Card padding="lg" className="mb-4 text-center">
            <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-background-200 text-foreground-500">
              <i className="ri-time-line text-3xl" />
            </span>
            <h2 className="font-heading text-xl font-semibold text-foreground-950">
              연결은 아직 열리지 않았어요
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground-500">
              잠시 보류했어요. 다음에 다시 마음을 열 수 있어요. 상대에게는 이 선택이
              공개되지 않아요.
            </p>
          </Card>
          <Button variant="primary" full onClick={onBack}>
            방으로 돌아가기
          </Button>
        </>
      )}
    </div>
  );
}