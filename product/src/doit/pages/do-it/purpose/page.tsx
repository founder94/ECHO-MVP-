import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/doit/components/feature/MobileLayout";
import Button from "@/doit/components/base/Button";
import Card from "@/doit/components/base/Card";
import { purposes } from "@/doit/mocks/do-it";
import { usePurpose } from "@/doit/hooks/usePurpose";

export default function Purpose() {
  const navigate = useNavigate();
  const { setPurposeId } = usePurpose();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <MobileLayout title="목적 선택" back>
      <div className="animate-fade-up pt-4">
        <h2 className="mb-1 font-heading text-xl font-semibold text-foreground-950">
          무엇을 하고 싶나요?
        </h2>
        <p className="mb-6 text-sm text-foreground-500">
          목적을 선택하면 그에 맞는 공간이 열려요.
          <br />
          사람을 고르는 대신, 하고 싶은 일부터 시작해요.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {purposes.map((p, i) => {
            const isSel = selected === p.id;
            return (
              <Card
                key={p.id}
                padding="sm"
                onClick={() => setSelected(p.id)}
                className={`transition-all ${
                  isSel
                    ? "border-primary-400 bg-primary-50"
                    : "border-background-200"
                }`}
              >
                <div className="flex flex-col items-start gap-2">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${p.color}15`, color: p.color }}
                  >
                    <i className={`${p.icon} text-lg`} />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground-950">
                      {p.label}
                    </h3>
                    <p className="mt-0.5 text-[11px] leading-snug text-foreground-500">
                      {p.desc}
                    </p>
                  </div>
                </div>
                {isSel && (
                  <div className="mt-2 flex items-center gap-1 text-xs font-medium text-primary-700">
                    <span className="flex h-4 w-4 items-center justify-center">
                      <i className="ri-check-line" />
                    </span>
                    선택됨
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <div className="mt-6">
          <Button
            full
            size="lg"
            disabled={!selected}
            onClick={() => {
              if (selected) setPurposeId(selected);
              navigate("/doit/photo");
            }}
          >
            {selected ? "선택하고 공간 열기" : "목적을 선택해주세요"}
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-foreground-400">
          나중에 언제든 목적을 변경하거나 추가할 수 있어요
        </p>
      </div>
    </MobileLayout>
  );
}