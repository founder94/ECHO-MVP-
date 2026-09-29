import { Link } from "react-router-dom";
import MobileLayout from "@/doit/components/feature/MobileLayout";
import Card from "@/doit/components/base/Card";
import Badge from "@/doit/components/base/Badge";
import { useKeyWallet } from "@/doit/hooks/useKeyWallet";
import {
  keyPackages,
  keyPolicy,
  keyPurchaseHistory,
} from "@/doit/mocks/do-it";

export default function Key() {
  const { isDemo, revenueKey, rewardKey, total, history } = useKeyWallet();

  return (
    <MobileLayout title="KEY" back>
      <div className="animate-fade-up pt-4">
        {isDemo && (
          <Card padding="md" className="mb-4 border-secondary-200 bg-secondary-50">
            <div className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center text-secondary-900">
                <i className="ri-information-line text-sm" />
              </span>
              <p className="text-xs leading-relaxed text-foreground-600">
                <span className="font-semibold text-secondary-900">데모 잔액이에요 · </span>
                아래 숫자는 서버 원장이 아니라 화면 데모용 예시 값이에요. 실제 KEY
                잔액·내역은 서버 연결 후에만 표시돼요.
              </p>
            </div>
          </Card>
        )}
        {/* Balance */}
        <Card padding="lg" className="mb-4 border-primary-200 bg-primary-50 text-center">
          <p className="text-xs text-primary-700">내 KEY 잔액 (데모)</p>
          <p className="mt-1 font-heading text-3xl font-semibold text-foreground-950">
            {total}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Badge tone="secondary">Reward {rewardKey}</Badge>
            <Badge tone="neutral">Revenue {revenueKey}</Badge>
          </div>
          <p className="mt-2 text-xs text-foreground-500">
            사용 시 Reward KEY부터 먼저 차감돼요.
          </p>
        </Card>

        {/* Charging products */}
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground-800">KEY 충전</h3>
          <span className="text-[11px] text-foreground-400">개별 충전 · 자동결제 없음</span>
        </div>
        <div className="mb-3 grid grid-cols-3 gap-3">
          {keyPackages.map((p) => (
            <Link
              key={p.id}
              to={`/doit/key/order/${p.packageId}`}
              className="flex flex-col items-center rounded-2xl border border-background-200 bg-background-50 p-4 text-center transition-colors hover:bg-background-100"
            >
              <p className="font-heading text-xl font-semibold text-foreground-950">
                {p.amount}
              </p>
              <p className="text-xs text-foreground-500">KEY</p>
              <p className="mt-2 text-xs font-medium text-foreground-500">
                가격 준비 중
              </p>
            </Link>
          ))}
        </div>

        {/* Validity notice */}
        <Card padding="md" className="mb-4 border-accent-200 bg-accent-50">
          <div className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center text-accent-700">
              <i className="ri-time-line text-sm" />
            </span>
            <p className="text-xs leading-relaxed text-foreground-600">
              <span className="font-semibold text-accent-900">유효기간 안내 · </span>
              {keyPolicy.validityLabel}. 자동결제·정기결제가 아닌 일회성 충전 상품이에요.
            </p>
          </div>
        </Card>

        {/* Purchase history */}
        <h3 className="mb-2 text-sm font-semibold text-foreground-800">구매내역</h3>
        <Card padding="sm" className="mb-4">
          {keyPurchaseHistory.length === 0 && (
            <p className="py-3 text-center text-xs text-foreground-400">아직 구매내역이 없어요.</p>
          )}
          {keyPurchaseHistory.map((o, i) => (
            <div
              key={o.id}
              className={`flex items-center justify-between py-3 ${
                i > 0 ? "border-t border-background-200" : ""
              }`}
            >
              <div>
                <p className="text-sm text-foreground-800">{o.name}</p>
                <p className="text-xs text-foreground-400">
                  {o.purchasedAt} · {o.keyAmount} KEY
                </p>
              </div>
              <Badge tone="accent">{o.status}</Badge>
            </div>
          ))}
        </Card>

        {/* Usage history */}
        <h3 className="mb-2 text-sm font-semibold text-foreground-800">KEY 내역 (데모 예시)</h3>
        <Card padding="sm">
          {history.map((h, i) => (
            <div
              key={h.id}
              className={`flex items-center justify-between py-3 ${
                i > 0 ? "border-t border-background-200" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    h.type === "earn"
                      ? "bg-accent-100 text-accent-700"
                      : h.type === "spend"
                      ? "bg-primary-100 text-primary-700"
                      : "bg-secondary-100 text-secondary-900"
                  }`}
                >
                  <i
                    className={`${
                      h.type === "earn"
                        ? "ri-add-line"
                        : h.type === "spend"
                        ? "ri-subtract-line"
                        : "ri-bank-card-line"
                    } text-sm`}
                  />
                </span>
                <div>
                  <p className="text-sm text-foreground-800">{h.title}</p>
                  <p className="text-xs text-foreground-400">
                    {h.time} · {h.bucket} KEY
                  </p>
                </div>
              </div>
              <span
                className={`text-sm font-semibold ${
                  h.type === "spend" ? "text-foreground-600" : "text-foreground-950"
                }`}
              >
                {h.type === "spend" ? "-" : "+"}
                {h.amount}
              </span>
            </div>
          ))}
        </Card>

        <p className="mt-4 text-center text-xs text-foreground-400">
          KEY는 서비스 안에서 쓰는 화폐예요. 사람과의 연결을 돈으로 살 수는 없어요.
        </p>
      </div>
    </MobileLayout>
  );
}