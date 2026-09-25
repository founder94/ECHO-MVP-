import { useState } from "react";
import { useParams } from "react-router-dom";
import MobileLayout from "@/doit/components/feature/MobileLayout";
import Card from "@/doit/components/base/Card";
import Button from "@/doit/components/base/Button";
import Badge from "@/doit/components/base/Badge";
import { keyPackages, keyPolicy } from "@/doit/mocks/do-it";

export default function KeyOrder() {
  const { packageId } = useParams();
  const [phase, setPhase] = useState<"confirm" | "preparing">("confirm");

  const pkg = keyPackages.find((p) => p.packageId === packageId);

  if (!pkg) {
    return (
      <MobileLayout title="KEY 충전" back>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-foreground-500">상품을 찾을 수 없어요.</p>
          <Button to="/doit/key" variant="secondary">
            KEY 충전으로 돌아가기
          </Button>
        </div>
      </MobileLayout>
    );
  }

  const handlePay = () => {
    // 프론트는 packageId만 서버에 전달합니다.
    // 금액·KEY 수량은 브라우저가 결정하지 않고 서버가 최종 확정합니다.
    // 서버(준비 완료 시)가 반환한 orderId·amount로 토스 결제창을 실행합니다.
    // 현재는 토스·서버가 미연결이라 결제를 진행하지 않고 대기 상태만 표시합니다.
    setPhase("preparing");
  };

  return (
    <MobileLayout title="주문 확인" back>
      <div className="animate-fade-up pt-4">
        {/* Product detail */}
        <Card padding="lg" className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-foreground-500">충전 상품</p>
              <p className="mt-1 font-heading text-2xl font-semibold text-foreground-950">
                {pkg.name}
              </p>
            </div>
            <Badge tone="secondary">개별 충전</Badge>
          </div>
          <div className="mt-4 flex items-end justify-between border-t border-background-200 pt-4">
            <span className="text-sm text-foreground-600">결제 금액</span>
            <span className="text-sm font-medium text-foreground-500">준비 중</span>
          </div>
          <p className="mt-2 text-right text-[11px] text-foreground-400">
            금액·KEY 수량은 서버가 최종 확정해요. 서버 연결 전에는 결제가 열리지 않아요.
          </p>
        </Card>

        {/* Validity */}
        <Card padding="md" className="mb-4">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
              <i className="ri-time-line text-base" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground-900">유효기간</p>
              <p className="mt-0.5 text-xs leading-relaxed text-foreground-600">
                {keyPolicy.validityLabel} · 자동결제 아님
              </p>
            </div>
          </div>
        </Card>

        {/* Refund policy */}
        <Card padding="md" className="mb-4">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-secondary-900">
              <i className="ri-refund-2-line text-base" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground-900">환불정책</p>
              <p className="mt-0.5 text-xs leading-relaxed text-foreground-600">
                {keyPolicy.refundNote}
              </p>
            </div>
          </div>
        </Card>

        {/* Order final confirmation */}
        <Card padding="md" className="mb-4 border-accent-200 bg-accent-50">
          <p className="text-xs font-semibold text-accent-900">주문내용 최종 확인</p>
          <div className="mt-2 space-y-1.5 text-xs text-foreground-700">
            <div className="flex justify-between">
              <span>상품</span>
              <span>{pkg.name}</span>
            </div>
            <div className="flex justify-between">
              <span>KEY 수량</span>
              <span>{pkg.amount} KEY</span>
            </div>
            <div className="flex justify-between">
              <span>결제 금액</span>
              <span>서버 확정 후 표시</span>
            </div>
          </div>
        </Card>

        {phase === "confirm" ? (
          <Button full onClick={handlePay}>
            충전 준비 상태 보기
          </Button>
        ) : (
          <Card padding="md" className="border-accent-200 bg-accent-50 text-center">
            <p className="text-xs leading-relaxed text-accent-900">
              결제 준비 중이에요. 아직 토스·서버가 연결되지 않아 실제 결제는 진행되지
              않아요.
            </p>
          </Card>
        )}

        <p className="mt-4 text-center text-xs text-foreground-400">
          결제 완료·KEY 지급은 서버 검증 이후에만 처리돼요.
        </p>
      </div>
    </MobileLayout>
  );
}