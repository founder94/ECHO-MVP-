import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
} from "motion/react";
import {
  Check,
  Shield,
} from "lucide-react";
import DoItSymbol from "@/components/DoItSymbol";
import { colors, serif , surfaces } from "../theme";
import { PrimaryButton } from "../components/PrimaryButton";
import type { ActivePurpose } from "@/doit/lib/purposes";

// Purpose 정본 = 운영 DB public.purposes 의 is_active=true 행.
// 2026-09-20 대표 확정: 이 화면은 목적 목록을 스스로 갖지 않는다.
// 목록은 호출하는 쪽(start-journey)이 DB에서 읽어 purposeState 로 넘긴다.
// 예전 하드코딩 12종은 삭제하지 않고 legacyPurposeCandidates.ts 에 보존했다(향후 축 후보).

// 조회 중 / 조회 실패 / 조회 성공을 서로 다른 상태로 구분한다.
// "조회 실패"와 "목적 0건"은 같은 화면으로 합치지 않는다.
export type PurposeListState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; purposes: ActivePurpose[] };

interface Props {
  purposeState: PurposeListState;
  onRetry: () => void;
  onNext: (selection: { id: string; label: string }) => void;
  initialId?: string | null;
  // 저장된 목적이 현재 활성 목록에 없을 때 true. 기존 값은 지우지 않고 재선택만 안내한다.
  needsReselection?: boolean;
  saving?: boolean;
  saveError?: string | null;
}

export function PurposeSelect({
  purposeState,
  onRetry,
  onNext,
  initialId,
  needsReselection,
  saving,
  saveError,
}: Props) {
  const [selected, setSelected] =
    useState<string | null>(null);

  // 목록이 아직 없을 때 initialId 를 먼저 선택 상태로 두면,
  // 목록에 없는 legacy 값이 선택된 것처럼 보인다. 목록이 도착한 뒤 한 번만 맞춘다.
  const syncedRef = useRef(false);
  useEffect(() => {
    if (purposeState.kind !== "ready") return;
    if (syncedRef.current) return;
    syncedRef.current = true;
    if (!initialId) return;
    // 활성 목록에 있는 값만 선택 상태로 복원한다. 없으면 선택하지 않는다(자동 매핑 금지).
    const exists = purposeState.purposes.some(
      (p) => p.id === initialId,
    );
    if (exists) setSelected(initialId);
  }, [purposeState, initialId]);

  function toggle(id: string) {
    setSelected((previous) =>
      previous === id ? null : id,
    );
  }

  const purposes =
    purposeState.kind === "ready"
      ? purposeState.purposes
      : [];

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{
        backgroundColor: surfaces.page,
      }}
    >
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-8 pb-4">
          <div className="flex items-center gap-3 mb-6" style={{color: surfaces.onPage, fontSize: 10, letterSpacing: "0.18em"}}><DoItSymbol decorative />DO IT COMPANY</div>
          <motion.div
            initial={{
              opacity: 0,
              y: 12,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.5,
            }}
          >
            <p
              style={{
                color: surfaces.onPageFaint,
                fontSize: 11,
                letterSpacing: "0.2em",
                marginBottom: 10,
              }}
            >
연결 목적 선택
            </p>

            <h1
              style={{
                fontFamily: serif,
                fontSize: 28,
                lineHeight: 1.25,
                color: colors.text,
                marginBottom: 12,
              }}
            >
              이번에는 어떤 관계를
              <br />
              만나고 싶나요?
            </h1>

            <p
              style={{
                color: surfaces.onPage,
                fontSize: 14,
                lineHeight: 1.65,
              }}
            >
              지금 원하는 관계 하나를 골라주세요.
              선택한 목적은 프로필에 반영돼요. 같은 만남을 고른 사람끼리만 연결돼요.
            </p>
          </motion.div>
        </div>

        {/* 예전에 고른 목적이 지금 목록에 없을 때 — 기존 값은 그대로 두고 재선택만 안내한다. */}
        {needsReselection && (
          <div
            className="mx-6 mb-4 rounded-2xl p-4"
            style={{
              backgroundColor: surfaces.card,
              border: `1px solid ${colors.border}`,
            }}
          >
            <p
              style={{
                color: colors.text,
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              예전에 고른 목적은 그대로 보관돼 있어요. 지금
              목록에는 없어서, 아래에서 하나를 다시 골라
              주세요.
            </p>
          </div>
        )}

        {purposeState.kind === "loading" && (
          <div className="px-6 pb-4">
            <p
              style={{
                color: colors.textMuted,
                fontSize: 14,
              }}
            >
              목적을 불러오는 중…
            </p>
          </div>
        )}

        {purposeState.kind === "error" && (
          <div
            className="mx-6 mb-4 rounded-2xl p-4"
            style={{
              backgroundColor: surfaces.card,
              border: `1px solid ${colors.border}`,
            }}
          >
            <p
              style={{
                color: colors.text,
                fontSize: 13.5,
                lineHeight: 1.6,
              }}
            >
              목적을 불러오지 못했어요. 잘못된 목록을 대신
              보여주지 않으려고 멈췄어요.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-full px-5 py-2.5 whitespace-nowrap"
              style={{
                fontSize: 13,
                color: colors.onAccent,
                backgroundColor: colors.accent,
                cursor: "pointer",
              }}
            >
              다시 시도
            </button>
          </div>
        )}

        {purposeState.kind === "ready" &&
          purposes.length === 0 && (
            <div
              className="mx-6 mb-4 rounded-2xl p-4"
              style={{
                backgroundColor: surfaces.card,
                border: `1px solid ${colors.border}`,
              }}
            >
              <p
                style={{
                  color: colors.text,
                  fontSize: 13.5,
                  lineHeight: 1.6,
                }}
              >
                지금 고를 수 있는 목적이 없어요. 잠시 뒤에
                다시 확인해 주세요.
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 rounded-full px-5 py-2.5 whitespace-nowrap"
                style={{
                  fontSize: 13,
                  color: colors.onAccent,
                  backgroundColor: colors.accent,
                  cursor: "pointer",
                }}
              >
                다시 확인
              </button>
            </div>
          )}

        <div className="px-6 pb-4 flex flex-col gap-2.5">
          {purposes.map(
            (purpose, index) => {
              const selectedPurpose =
                selected === purpose.id;

              return (
                <motion.div
                  key={purpose.id}
                  initial={{
                    opacity: 0,
                    y: 10,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    delay:
                      index * 0.04,
                    duration: 0.35,
                  }}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    backgroundColor:
                      selectedPurpose
                        ? colors.accentSoft
                        : surfaces.card,
                    border: `1px solid ${
                      selectedPurpose
                        ? colors.accent
                        : colors.border
                    }`,
                    transition:
                      "background-color 0.15s ease, border-color 0.15s ease",
                  }}
                >
                  <button
                    onClick={() =>
                      toggle(
                        purpose.id,
                      )
                    }
                    className="w-full text-left px-4 py-4 flex items-center gap-3"
                  >
                    <div
                      className="shrink-0 rounded-full flex items-center justify-center"
                      style={{
                        width: 22,
                        height: 22,
                        backgroundColor:
                          selectedPurpose
                            ? colors.accent
                            : "transparent",
                        border: `1.5px solid ${
                          selectedPurpose
                            ? colors.accent
                            : colors.borderStrong
                        }`,
                        transition:
                          "all 0.15s ease",
                      }}
                    >
                      {selectedPurpose && (
                        <Check
                          size={13}
                          color={
                            colors.onAccent
                          }
                          strokeWidth={3}
                        />
                      )}
                    </div>

                    <div className="flex-1">
                      <span
                        style={{
                          fontSize: 15,
                          color: colors.text,
                          fontFamily: serif,
                          lineHeight: 1.45,
                        }}
                      >
                        {purpose.label}
                      </span>
                    </div>
                  </button>

                  <AnimatePresence
                    initial={false}
                  >
                    {selectedPurpose &&
                      purpose.description && (
                      <motion.div
                        initial={{
                          height: 0,
                          opacity: 0,
                        }}
                        animate={{
                          height: "auto",
                          opacity: 1,
                        }}
                        exit={{
                          height: 0,
                          opacity: 0,
                        }}
                        transition={{
                          duration: 0.24,
                          ease: [
                            0.16,
                            1,
                            0.3,
                            1,
                          ],
                        }}
                        style={{
                          overflow:
                            "hidden",
                        }}
                      >
                        <p
                          className="px-4 pb-4"
                          style={{
                            color:
                              colors.text,
                            fontSize: 13,
                            lineHeight: 1.6,
                            paddingLeft: 49,
                          }}
                        >
                          {purpose.description}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            },
          )}
        </div>

        <motion.div
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            delay: 0.5,
          }}
          className="mx-6 mb-6 rounded-2xl p-4 flex items-start gap-2.5"
          style={{
            backgroundColor:
              surfaces.card,
            border: `1px solid ${colors.border}`,
          }}
        >
          <Shield
            size={14}
            color={colors.textFaint}
            className="mt-0.5 shrink-0"
          />

          <p
            style={{
              color: colors.textFaint,
              fontSize: 12,
              lineHeight: 1.55,
            }}
          >
            아직 사람 추천을 시작하지 않아요.
            먼저 내 마음에 맞는 목적과 프로필을 준비해 주세요.
          </p>
        </motion.div>
      </div>

      <div
        className="px-6 py-6 shrink-0"
        style={{
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        {saveError && (
          <p
            style={{
              color: colors.danger,
              fontSize: 12.5,
              lineHeight: 1.5,
              marginBottom: 10,
            }}
          >
            {saveError}
          </p>
        )}

        <PrimaryButton
          onClick={() => {
            if (saving) return;
            // 목록에 실제로 있는 행만 통과시킨다. label 을 화면에서 새로 만들지 않는다.
            const found = purposes.find(
              (p) => p.id === selected,
            );
            if (found) {
              onNext({
                id: found.id,
                label: found.label,
              });
            }
          }}
          disabled={!selected || saving}
        >
          {saving ? "저장 중…" : "이 목적으로 계속하기"}
        </PrimaryButton>
      </div>
    </div>
  );
}
