import Badge from "@/doit/components/base/Badge";
import Button from "@/doit/components/base/Button";
import Card from "@/doit/components/base/Card";

interface SpaceCardProps {
  id: string;
  name: string;
  purposeLabel: string;
  members: number;
  maxMembers: number;
  status: string;
  description: string;
  lock: boolean;
  currentMission: string;
  progress: number;
}

export default function SpaceCard({
  name,
  purposeLabel,
  members,
  maxMembers,
  status,
  description,
  lock,
  currentMission,
  progress,
}: SpaceCardProps) {
  const isFull = status === "full";
  const isLocked = lock || status === "locked";

  return (
    <Card
      padding="md"
      className={`${isLocked ? "opacity-70" : ""} animate-fade-up`}
    >
      <div className="mb-2 flex items-start justify-between">
        <div>
          <Badge tone="secondary" className="mb-1.5">
            {purposeLabel}
          </Badge>
          <h3 className="font-heading text-base font-semibold text-foreground-950">
            {name}
          </h3>
        </div>
        <div className="flex items-center gap-1 text-xs text-foreground-500">
          {isLocked ? (
            <span className="flex items-center gap-1">
              <span className="flex h-5 w-5 items-center justify-center">
                <i className="ri-lock-2-line text-sm" />
              </span>
              잠김
            </span>
          ) : (
            <>
              <span className="flex h-5 w-5 items-center justify-center">
                <i className="ri-user-3-line text-sm" />
              </span>
              {members}/{maxMembers}
              {isFull && (
                <span className="ml-1 text-primary-600">마감</span>
              )}
            </>
          )}
        </div>
      </div>

      <p className="mb-3 text-sm leading-relaxed text-foreground-600">
        {description}
      </p>

      {!isLocked && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-foreground-500">미션 진행</span>
            <span className="text-xs font-medium text-foreground-700">
              {progress}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-background-200">
            <div
              className="h-1.5 rounded-full bg-primary-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-foreground-500">{currentMission}</p>
        </div>
      )}

      {isLocked && (
        <div className="flex items-center gap-2 rounded-xl bg-background-100 px-3 py-2.5">
          <span className="flex h-5 w-5 items-center justify-center text-foreground-500">
            <i className="ri-lock-2-line text-sm" />
          </span>
          <span className="text-xs text-foreground-500">
            서로의 선택이 겹치면 이 공간이 열려요
          </span>
        </div>
      )}

      {!isLocked && !isFull && (
        <Button to="/doit/room" size="sm" full className="mt-1">
          들어가기
        </Button>
      )}

      {isFull && (
        <Button disabled size="sm" full variant="secondary" className="mt-1">
          인원 마감
        </Button>
      )}
    </Card>
  );
}