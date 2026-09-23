import { useNavigate } from "react-router-dom";
import Card from "@/doit/components/base/Card";
import Button from "@/doit/components/base/Button";

const gradeColors: Record<string, string> = {
  red: "bg-[#C4453C] text-white",
  gold: "bg-[#C9A24B] text-white",
  silver: "bg-[#A8B0B8] text-white",
  perfume: "bg-[#D9A7A0] text-white",
  platinum: "bg-[#6E7A84] text-white",
  black: "bg-[#1A1A1A] text-white",
};

interface ConnectionCardProps {
  id: string;
  name: string;
  purpose: string;
  room: string;
  openedAt: string;
  status: string;
  grade: string;
  message: string;
}

export default function ConnectionCard({
  name,
  purpose,
  room,
  openedAt,
  status,
  grade,
  message,
}: ConnectionCardProps) {
  const navigate = useNavigate();
  const isNew = status === "new";

  return (
    <Card padding="md" className="animate-fade-up relative overflow-hidden">
      {isNew && (
        <div className="absolute right-3 top-3">
          <span className="inline-flex h-2 w-2 rounded-full bg-primary-500" />
        </div>
      )}

      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-700">
          <i className="ri-user-heart-line text-xl" />
        </span>
        <div>
          <h3 className="font-heading text-base font-semibold text-foreground-950">
            {name}님
          </h3>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                gradeColors[grade] || gradeColors.silver
              }`}
            >
              {grade.toUpperCase()}
            </span>
            <span className="text-xs text-foreground-500">
              {purpose} · {room}
            </span>
          </div>
        </div>
      </div>

      <p className="mb-3 text-sm text-foreground-600">{message}</p>

      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground-400">{openedAt}</span>
        <Button size="sm" variant="secondary" onClick={() => navigate("/doit/room")}>
          대화하기
        </Button>
      </div>
    </Card>
  );
}