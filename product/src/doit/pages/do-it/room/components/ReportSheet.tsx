import { useState } from "react";
import { BottomSheet, Modal } from "@/doit/components/base/Modal";
import Button from "@/doit/components/base/Button";
import { reportReasons } from "@/doit/mocks/do-it";

interface ReportSheetProps {
  open: boolean;
  mode: "report" | "block";
  target: string;
  onClose: () => void;
}

export default function ReportSheet({
  open,
  mode,
  target,
  onClose,
}: ReportSheetProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const close = () => {
    onClose();
    setTimeout(() => {
      setSelected(null);
      setDone(false);
    }, 200);
  };

  if (mode === "block") {
    return (
      <Modal open={open} onClose={close} title="차단하기">
        <p className="text-sm leading-relaxed text-foreground-600">
          {done
            ? `${target}님을 차단했어요. 더 이상 서로를 볼 수 없어요. (데모)`
            : `${target}님을 차단할까요? 차단하면 서로를 볼 수 없고, 함께한 공간에서도 분리돼요.`}
        </p>
        {done ? (
          <Button full onClick={close} className="mt-4">
            확인
          </Button>
        ) : (
          <div className="mt-4 flex gap-2">
            <Button variant="outline" full onClick={close}>
              취소
            </Button>
            <Button full onClick={() => setDone(true)}>
              차단하기
            </Button>
          </div>
        )}
      </Modal>
    );
  }

  if (done) {
    return (
      <Modal open={open} onClose={close} title="신고 접수 완료">
        <p className="text-sm leading-relaxed text-foreground-600">
          신고가 접수됐어요. 운영팀이 검토한 뒤 필요한 조치를 할게요. (데모)
        </p>
        <Button full onClick={close} className="mt-4">
          확인
        </Button>
      </Modal>
    );
  }

  return (
    <BottomSheet open={open} onClose={close} title="신고하기">
      <p className="mb-3 text-xs text-foreground-500">
        {target}님의 어떤 행동이 문제였나요?
      </p>
      <div className="mb-4 flex flex-col gap-2">
        {reportReasons.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelected(r.id)}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
              selected === r.id
                ? "border-primary-400 bg-primary-50 text-primary-800"
                : "border-background-200 bg-background-50 text-foreground-800"
            }`}
          >
            <span>{r.label}</span>
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                selected === r.id
                  ? "border-primary-500 bg-primary-500 text-white"
                  : "border-background-300"
              }`}
            >
              {selected === r.id && <i className="ri-check-line text-xs" />}
            </span>
          </button>
        ))}
      </div>
      <Button full onClick={() => setDone(true)} disabled={!selected}>
        신고 제출
      </Button>
    </BottomSheet>
  );
}