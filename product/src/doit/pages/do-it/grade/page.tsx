import MobileLayout from "@/doit/components/feature/MobileLayout";
import Card from "@/doit/components/base/Card";
import GradeBadge from "@/doit/components/feature/GradeBadge";
import { grades } from "@/doit/mocks/do-it";

export default function Grade() {
  return (
    <MobileLayout title="등급 가이드" back>
      <div className="animate-fade-up pt-4">
        <Card padding="md" className="mb-4">
          <p className="text-sm leading-relaxed text-foreground-600">
            등급은 함께한 활동으로 쌓인 <strong className="font-semibold">신뢰</strong>를
            보여주는 표시예요.
          </p>
        </Card>

        <div className="flex flex-col gap-3">
          {grades.map((g) => (
            <Card key={g.id} padding="md">
              <div className="flex items-center gap-3">
                <GradeBadge grade={g.id} />
                <p className="flex-1 text-xs text-foreground-500">{g.desc}</p>
              </div>
            </Card>
          ))}
        </div>

        <Card padding="md" className="mt-4 border-accent-200 bg-accent-50">
          <p className="text-xs leading-relaxed text-accent-900">
            등급 승급의 정확한 기준은 서버 정책이 결정해요. 블랙 등급은 돈으로 구매할 수
            없어요.
          </p>
        </Card>
      </div>
    </MobileLayout>
  );
}