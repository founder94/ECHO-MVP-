import { useState } from "react";
import type { ReactNode } from "react";
import MobileLayout from "@/doit/components/feature/MobileLayout";
import Card from "@/doit/components/base/Card";
import Badge from "@/doit/components/base/Badge";
import Button from "@/doit/components/base/Button";
import { Modal } from "@/doit/components/base/Modal";

// Just Try — A구조 안의 미래 보상 생태계 자리(진입점 + UX)만 구현.
// 이번 빌드는 실제 Reward KEY 지급·원장·추천 추적·상품·결제를 전혀 만들지 않는다.
// 모든 미출시 기능은 "준비 중"으로 잠가두고, 가짜 숫자·가짜 성공 동작도 만들지 않는다.

function Section({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card padding="lg" className="mb-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <i className={`${icon} text-lg`} />
        </span>
        <h2 className="font-heading text-base font-semibold text-foreground-950">
          {title}
        </h2>
      </div>
      {children}
    </Card>
  );
}

export default function JustTry() {
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null);

  return (
    <MobileLayout title="Just Try" back>
      <div className="animate-fade-up pt-4">
        {/* 인트로 */}
        <Card padding="lg" className="mb-4">
          <Badge tone="accent">현재 준비 중입니다</Badge>
          <h1 className="mt-4 font-heading text-2xl font-semibold leading-tight text-foreground-950">
            작은 시도도
            <br />
            그냥 지나가지 않도록.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-foreground-600">
            ECHO에서의 의미 있는 활동은 앞으로 KEY로 보상받을 수 있어요.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-foreground-600">
            친구를 초대하고, 새로운 활동에 참여하고, 나만의 작은 나비효과를
            만들어보세요.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-foreground-600">
            모은 KEY는 다양한 경험과 혜택에 사용할 수 있도록 준비하고 있어요.
          </p>
        </Card>

        {/* ① 내 KEY */}
        <Section icon="ri-vip-crown-2-line" title="내 KEY">
          <p className="font-heading text-lg font-semibold text-foreground-950">
            아직 시작 전이에요
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground-600">
            Just Try 보상 시스템이 시작되면 내가 받은 KEY를 여기에서 확인할 수
            있어요.
          </p>
        </Section>

        {/* ② KEY를 받을 수 있는 TRY */}
        <Section icon="ri-lightbulb-flash-line" title="KEY를 받을 수 있는 TRY">
          <p className="text-sm leading-relaxed text-foreground-600">
            새로운 TRY를 준비하고 있어요
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground-600">
            ECHO에서의 의미 있는 시도가 KEY로 이어질 수 있도록 준비 중이에요.
          </p>
          <Button
            variant="secondary"
            full
            className="mt-4"
            onClick={() =>
              setNotice({
                title: "새로운 TRY",
                body: "조금만 기다려주세요.\n새로운 TRY를 준비하고 있어요.",
              })
            }
          >
            <i className="ri-lock-2-line text-base" />
            준비 중
          </Button>
        </Section>

        {/* ③ 나비효과 */}
        <Section icon="ri-links-line" title="나비효과">
          <p className="font-heading text-base font-semibold leading-relaxed text-foreground-950">
            내 작은 시도가
            <br />
            누군가의 새로운 시작으로 이어질 수 있어요.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-foreground-600">
            단순한 추천인 이벤트가 아니에요. 친구가 가입하고, 의미 있는 활동을
            하고, 서버 검증을 통과해야 앞으로 KEY로 이어질 수 있도록 준비하고
            있어요.
          </p>
          <Button
            variant="outline"
            full
            className="mt-4"
            onClick={() =>
              setNotice({
                title: "친구 초대",
                body: "친구 초대 기능을 준비하고 있어요.\n조금만 기다려주세요.",
              })
            }
          >
            <i className="ri-user-add-line text-base" />
            친구 초대 · 준비 중
          </Button>
        </Section>

        {/* ④ KEY 사용하기 */}
        <Section icon="ri-store-2-line" title="KEY 사용하기">
          <div className="mb-3">
            <Badge tone="neutral">
              <i className="ri-lock-2-line text-xs" />
              준비 중
            </Badge>
          </div>
          <p className="text-sm leading-relaxed text-foreground-600">
            모은 KEY로 새로운 경험과 혜택을 만날 수 있도록 준비하고 있어요.
          </p>
        </Section>

        <p className="pb-2 text-center text-xs leading-relaxed text-foreground-400">
          Just Try는 포인트 적립이 아니에요.
          <br />
          진짜로 시도한 의미 있는 행동을 인정하는 보상이 될 예정이에요.
        </p>
      </div>

      <Modal
        open={notice !== null}
        onClose={() => setNotice(null)}
        title={notice?.title}
      >
        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground-700">
          {notice?.body}
        </p>
        <Button full className="mt-4" onClick={() => setNotice(null)}>
          확인
        </Button>
      </Modal>
    </MobileLayout>
  );
}