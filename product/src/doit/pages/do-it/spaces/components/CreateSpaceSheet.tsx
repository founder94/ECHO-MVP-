import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BottomSheet, Modal } from "@/doit/components/base/Modal";
import Button from "@/doit/components/base/Button";
import Input from "@/doit/components/base/Input";
import { useKeyWallet } from "@/doit/hooks/useKeyWallet";

interface SpaceType {
  id: string;
  label: string;
  cost: number;
  purposeId: string;
  desc: string;
}

const SPACE_TYPES: SpaceType[] = [
  { id: "general", label: "일반 공간", cost: 0, purposeId: "friend", desc: "무료로 개설할 수 있어요" },
  { id: "protected", label: "보호 공간", cost: 50, purposeId: "safe", desc: "안전하게 지켜지는 공간 · 50 KEY" },
  { id: "creative", label: "Creative 공간", cost: 50, purposeId: "create", desc: "함께 창작하는 공간 · 50 KEY" },
  { id: "nonromantic", label: "비연애 공간", cost: 50, purposeId: "slow", desc: "연애 목적이 아닌 공간 · 50 KEY" },
];

export interface CreatedSpace {
  id: string;
  purposeId: string;
  name: string;
  members: number;
  maxMembers: number;
  status: string;
  description: string;
  lock: boolean;
  currentMission: string;
  progress: number;
}

interface CreateSpaceSheetProps {
  open: boolean;
  onClose: () => void;
  onCreate: (space: CreatedSpace) => void;
}

interface DoneResult {
  name: string;
  cost: number;
  fromReward: number;
  fromRevenue: number;
  remaining: number;
}

export default function CreateSpaceSheet({
  open,
  onClose,
  onCreate,
}: CreateSpaceSheetProps) {
  const navigate = useNavigate();
  const { deductKeys, total } = useKeyWallet();
  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState("general");
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<"form" | "insufficient" | "done">("form");
  const [result, setResult] = useState<DoneResult | null>(null);
  const requestIdRef = useRef(`req-${Date.now()}`);

  const type = SPACE_TYPES.find((t) => t.id === typeId) ?? SPACE_TYPES[0];

  const reset = () => {
    setName("");
    setTypeId("general");
    setProcessing(false);
    setStatus("form");
    setResult(null);
    requestIdRef.current = `req-${Date.now()}`;
  };

  const close = () => {
    onClose();
    setTimeout(reset, 200);
  };

  const buildSpace = (): CreatedSpace => ({
    id: `created-${Date.now()}`,
    purposeId: type.purposeId,
    name: name.trim(),
    members: 1,
    maxMembers: 6,
    status: "open",
    description:
      type.id === "protected"
        ? "안전하게 지켜지는 공간이에요."
        : "새로 열린 공간이에요. 함께 활동을 시작해요.",
    lock: false,
    currentMission: "첫 미션을 기다리고 있어요",
    progress: 0,
  });

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed || processing) return;
    setProcessing(true);

    if (type.cost > 0) {
      const res = deductKeys(requestIdRef.current, type.cost, `${type.label} 개설`);
      if (res.reason === "insufficient") {
        setStatus("insufficient");
        setProcessing(false);
        return;
      }
      if (res.reason === "duplicate") {
        setProcessing(false);
        return;
      }
      const space = buildSpace();
      onCreate(space);
      setResult({
        name: space.name,
        cost: type.cost,
        fromReward: res.deductedReward,
        fromRevenue: res.deductedRevenue,
        remaining: res.remaining,
      });
      setStatus("done");
    } else {
      const space = buildSpace();
      onCreate(space);
      setResult({ name: space.name, cost: 0, fromReward: 0, fromRevenue: 0, remaining: total });
      setStatus("done");
    }
  };

  if (status === "insufficient") {
    return (
      <Modal open={open} onClose={close} title="KEY가 부족해요">
        <p className="text-sm leading-relaxed text-foreground-600">
          보호·Creative·비연애 공간을 열려면 50 KEY가 필요해요.
          <br />
          현재 잔액은 {total} KEY예요.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Button full onClick={() => navigate("/doit/key")}>
            충전하러 가기
          </Button>
          <Button full variant="outline" onClick={close}>
            닫기
          </Button>
        </div>
      </Modal>
    );
  }

  if (status === "done" && result) {
    return (
      <Modal open={open} onClose={close} title="공간이 열렸어요">
        <p className="text-sm leading-relaxed text-foreground-600">
          '{result.name}' 공간이 개설됐어요. 참여자는 무료로 입장할 수 있어요.
        </p>
        {result.cost > 0 && (
          <div className="mt-3 rounded-xl border border-background-200 bg-background-100 p-3">
            <p className="text-sm font-semibold text-foreground-950">
              50 KEY 차감 (데모)
            </p>
            <p className="mt-1 text-xs text-foreground-500">
              Reward {result.fromReward} + Revenue {result.fromRevenue} · 남은 잔액{" "}
              {result.remaining} KEY
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-foreground-400">
              데모 차감이에요. 실제 서버 원장이 연결되기 전까지 KEY는 실제로 차감되지
              않아요.
            </p>
          </div>
        )}
        <Button full onClick={close} className="mt-4">
          확인
        </Button>
      </Modal>
    );
  }

  return (
    <BottomSheet open={open} onClose={close} title="공간 개설">
      <div className="mb-4">
        <Input
          label="공간 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          placeholder="공간 이름을 입력해 주세요"
        />
      </div>

      <p className="mb-2 text-xs font-semibold text-foreground-700">공간 종류</p>
      <div className="flex flex-col gap-2">
        {SPACE_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTypeId(t.id)}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
              typeId === t.id
                ? "border-primary-400 bg-primary-50"
                : "border-background-200 bg-background-50"
            }`}
          >
            <div>
              <p
                className={`text-sm font-medium ${
                  typeId === t.id ? "text-primary-800" : "text-foreground-800"
                }`}
              >
                {t.label}
              </p>
              <p className="text-xs text-foreground-500">{t.desc}</p>
            </div>
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                typeId === t.id
                  ? "border-primary-500 bg-primary-500 text-white"
                  : "border-background-300"
              }`}
            >
              {typeId === t.id && <i className="ri-check-line text-xs" />}
            </span>
          </button>
        ))}
      </div>

      {type.cost > 0 && (
        <p className="mt-3 rounded-xl border border-primary-200 bg-primary-50 p-3 text-xs leading-relaxed text-primary-800">
          개설하는 사용자만 {type.cost} KEY가 1회 차감돼요. 참여자는 무료예요. KEY로
          등급·신뢰가 올라가지는 않아요.
        </p>
      )}

      <div className="mt-4">
        <Button
          full
          onClick={handleCreate}
          disabled={!name.trim() || processing}
          loading={processing}
        >
          {type.cost > 0 ? `${type.cost} KEY로 개설하기` : "무료로 개설하기"}
        </Button>
      </div>
    </BottomSheet>
  );
}