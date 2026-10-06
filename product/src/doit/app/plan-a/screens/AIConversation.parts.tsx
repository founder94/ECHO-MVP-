/* eslint-disable react-refresh/only-export-components -- 화면 보조 조각(상수+컴포넌트) 한 파일 유지. 동작 영향 없음 */
import { motion, AnimatePresence } from "motion/react";
import { Pencil } from "lucide-react";
import { colors, serif } from "../theme";
import type { Reaction } from "@/doit/hooks/useOpenAIConversation";

// AI 대화 화면의 보조 조각(반응 버튼 라벨·직접 설명 입력 상자). 파일 길이 제한(레디 20,000자)으로 AIConversation.tsx 에서 분리했다. 내용 동일.
export const REACTIONS: {
  key: Reaction;
  label: string;
}[] = [
  {
    key: "agree",
    label: "맞아요",
  },
  {
    key: "little",
    label: "조금 달라요",
  },
  {
    key: "no",
    label: "그게 아니에요",
  },
  {
    key: "explain",
    label: "직접 설명할게요",
  },
  {
    key: "unsure",
    label: "모르겠어요",
  },
];

interface ExplainBoxProps {
  open: boolean;
  draft: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

// "직접 설명할게요 / 그게 아니에요" 뒤에 열리는 입력 상자. AIConversation 에서 분리 — 동작 동일.
export function ExplainBox({ open, draft, onChange, onSave }: ExplainBoxProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{
            opacity: 0,
            height: 0,
          }}
          animate={{
            opacity: 1,
            height: "auto",
          }}
          exit={{
            opacity: 0,
            height: 0,
          }}
          transition={{
            duration: 0.25,
          }}
          style={{
            overflow: "hidden",
          }}
        >
          <div className="mt-4">
            <textarea
              value={draft}
              onChange={(event) =>
                onChange(
                  event.target
                    .value,
                )
              }
              placeholder="내 생각을 편하게 적어주세요"
              rows={3}
              className="w-full resize-none rounded-2xl px-4 py-3 outline-none"
              style={{
                backgroundColor:
                  colors.surface,
                border: `1px solid ${colors.border}`,
                color: colors.text,
                fontSize: 14,
                lineHeight: 1.5,
                fontFamily: serif,
              }}
            />

            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={onSave}
                className="rounded-full px-4 flex items-center gap-1.5"
                style={{
                  height: 38,
                  fontSize: 13,
                  color: colors.text,
                  border: `1px solid ${colors.borderStrong}`,
                }}
              >
                <Pencil size={13} />
                이 설명으로 반영
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}