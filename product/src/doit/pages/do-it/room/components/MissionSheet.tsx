import { useState } from "react";
import { BottomSheet } from "@/doit/components/base/Modal";
import Button from "@/doit/components/base/Button";

interface MissionSheetProps {
  open: boolean;
  title: string;
  description: string;
  stepLabel: string;
  onClose: () => void;
  onSubmit: (answer: string) => void;
}

export default function MissionSheet({
  open,
  title,
  description,
  stepLabel,
  onClose,
  onSubmit,
}: MissionSheetProps) {
  const [answer, setAnswer] = useState("");

  const handleSubmit = () => {
    if (!answer.trim()) return;
    onSubmit(answer.trim());
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={stepLabel}>
      <p className="font-heading text-base font-semibold text-foreground-950">
        {title}
      </p>
      <p className="mt-1 text-sm text-foreground-500">{description}</p>

      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        maxLength={500}
        rows={4}
        placeholder="생각을 자유롭게 적어보세요"
        className="mt-4 w-full resize-none rounded-xl border border-background-300 bg-background-50 px-4 py-3 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
      />
      <div className="mt-1 flex justify-end">
        <span className="text-xs text-foreground-400">{answer.length} / 500</span>
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="outline" onClick={onClose} className="flex-1">
          취소
        </Button>
        <Button onClick={handleSubmit} disabled={!answer.trim()} className="flex-1">
          제출하기
        </Button>
      </div>
    </BottomSheet>
  );
}