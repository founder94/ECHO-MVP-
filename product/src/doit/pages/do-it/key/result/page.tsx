import { useSearchParams } from "react-router-dom";
import MobileLayout from "@/doit/components/feature/MobileLayout";
import Card from "@/doit/components/base/Card";
import Button from "@/doit/components/base/Button";

type ResultStatus = "success" | "fail" | "cancel" | "processing";

const views: Record<
  ResultStatus,
  { icon: string; title: string; desc: string; tone: string }
> = {
  processing: {
    icon: "ri-loader-4-line animate-spin-slow",
    title: "KEY 지급 처리 중",
    desc: "결제 승인 후 서버 검증이 끝나면 KEY가 지급돼요.",
    tone: "bg-accent-100 text-accent-700",
  },
  success: {
    icon: "ri-checkbox-circle-line",
    title: "결제 성공",
    desc: "결제가 완료됐어요. 서버 검증 후 KEY가 지급돼요.",
    tone: "bg-accent-100 text-accent-700",
  },
  fail: {
    icon: "ri-close-circle-line",
    title: "결제 실패",
    desc: "결제를 완료하지 못했어요. 다시 시도해 주세요.",
    tone: "bg-primary-100 text-primary-700",
  },
  cancel: {
    icon: "ri-close-circle-line",
    title: "결제 취소",
    desc: "결제가 취소됐어요. KEY는 차감되지 않았어요.",
    tone: "bg-secondary-100 text-secondary-900",
  },
};

export default function KeyResult() {
  const [params] = useSearchParams();
  const status = (params.get("status") as ResultStatus) || "processing";
  const view = views[status] || views.processing;

  return (
    <MobileLayout title="결제 결과">
      <div className="animate-fade-up flex min-h-[70vh] flex-col items-center justify-center pt-6 text-center">
        <span
          className={`flex h-16 w-16 items-center justify-center rounded-full ${view.tone}`}
        >
          <i className={`${view.icon} text-3xl`} />
        </span>
        <h1 className="mt-5 font-heading text-xl font-semibold text-foreground-950">
          {view.title}
        </h1>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-foreground-500">
          {view.desc}
        </p>

        <Card padding="md" className="mt-6 max-w-xs border-accent-200 bg-accent-50 text-left">
          <p className="text-xs leading-relaxed text-accent-900">
            데모 화면이에요. 실제 결제는 아직 연결되지 않았고, KEY 지급도 서버 검증
            이후에만 처리돼요.
          </p>
        </Card>

        <div className="mt-8 flex gap-3">
          <Button to="/doit/key" variant="secondary">
            KEY 충전으로 돌아가기
          </Button>
          {status === "fail" && <Button to="/doit/key">다시 시도</Button>}
        </div>
      </div>
    </MobileLayout>
  );
}