import { useMemo, useState } from "react";
import {
  AnimatePresence,
  motion,
} from "motion/react";
import {
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  Sparkles,
} from "lucide-react";
import { colors, serif } from "../theme";
import { PrimaryButton } from "../components/PrimaryButton";
import type { SajuInput as SajuCalcInput } from "@/doit/lib/saju/engine";

interface Props {
  // 2026-09-26: 확인한 입력을 계산 화면으로 넘긴다(저장 0 · 이 화면 → 계산 엔진).
  onNext: (input: SajuCalcInput) => void;
  onSwitchToTaro?: () => void;
  // 2026-09-26 대표 §14: 결과에서 「다시 입력」으로 돌아오면 방금 넣은 값을 그대로 보여 준다(이 화면 상태에서만 · 저장 0).
  initial?: SajuCalcInput | null;
}

type Calendar = "solar" | "lunar" | "leap";

const fieldStyle = {
  backgroundColor: colors.surface,
  border: `1px solid ${colors.borderStrong}`,
  color: colors.text,
};

export function SajuInput({
  onNext,
  onSwitchToTaro,
  initial = null,
}: Props) {
  const [calendar, setCalendar] =
    useState<Calendar>(initial?.calendar ?? "solar");
  const [date, setDate] = useState(initial?.date ?? "");
  const [time, setTime] = useState(initial?.time ?? "");
  const [unknown, setUnknown] = useState(!!initial && initial.time === null);
  const [alias, setAlias] = useState("");
  const [birthplace, setBirthplace] = useState("");
  const [gender, setGender] = useState<string>(initial?.gender ?? "");
  const [review, setReview] = useState(false);

  const valid = useMemo(
    () =>
      Boolean(
        date &&
          gender &&
          (unknown || time),
      ),
    [date, gender, unknown, time],
  );

  const confirm = () => {
    if (valid) {
      setReview(true);
    }
  };

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{
        backgroundColor: colors.bg,
      }}
    >
      <div className="flex-1 px-6 pb-5 pt-10">
        <motion.header
          initial={{
            opacity: 0,
            y: 12,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
        >
          <p
            className="mb-2 text-[11px] tracking-[.2em]"
            style={{
              color: colors.textFaint,
            }}
          >
            FREE · 기본 사주
          </p>

          <h1
            style={{
              fontFamily: serif,
              fontSize: 28,
              lineHeight: 1.28,
              color: colors.text,
            }}
          >
            태어난 날의 네 기둥을
            <br />
            차분히 확인해볼게요
          </h1>

          <p
            className="mt-3 text-sm leading-6"
            style={{
              color: colors.textMuted,
            }}
          >
            입력한 걸 한 번 보여 드리고,
            맞다고 하면 바로 계산해요.
          </p>
        </motion.header>

        <div className="mt-7 space-y-5">
          <label className="block">
            <span
              className="mb-2 block text-xs"
              style={{
                color: colors.textMuted,
              }}
            >
              이름 또는 별명{" "}
              <b
                className="font-normal"
                style={{
                  color: colors.textFaint,
                }}
              >
                선택
              </b>
            </span>

            <input
              value={alias}
              onChange={(event) =>
                setAlias(event.target.value)
              }
              placeholder="불리고 싶은 이름"
              className="h-[52px] w-full rounded-2xl px-4 outline-none"
              style={fieldStyle}
            />
          </label>

          <div>
            <span
              className="mb-2 block text-xs"
              style={{
                color: colors.textMuted,
              }}
            >
              전통 계산 구분
            </span>

            <div className="grid grid-cols-3 gap-2">
              {[
                ["female", "여성"],
                ["male", "남성"],
                ["unspecified", "선택 안 함"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setGender(value)
                  }
                  className="h-12 rounded-2xl text-[13px]"
                  style={{
                    ...fieldStyle,
                    borderColor:
                      gender === value
                        ? "#c7aa69"
                        : colors.borderStrong,
                    color:
                      gender === value
                        ? "#efd99f"
                        : colors.textMuted,
                    background:
                      gender === value
                        ? "rgba(199,170,105,.12)"
                        : colors.surface,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <p
              className="mt-2 text-[11px] leading-4"
              style={{
                color: colors.textFaint,
              }}
            >
              10년 흐름(대운)의 방향을 정하는 데만 써요.
              「선택 안 함」이면 10년 흐름은 빼고 보여 드려요.
            </p>
          </div>

          <div>
            <span
              className="mb-2 block text-xs"
              style={{
                color: colors.textMuted,
              }}
            >
              달력
            </span>

            <div className="grid grid-cols-3 gap-2">
              {[
                ["solar", "양력"],
                ["lunar", "음력"],
                ["leap", "음력 윤달"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  // 2026-09-26: 음력 → 양력 변환표가 아직 없어 음력은 고를 수 없다(가짜 변환 0). 양력만 계산한다.
                  disabled={value !== "solar"}
                  aria-disabled={value !== "solar"}
                  onClick={() =>
                    setCalendar(
                      value as Calendar,
                    )
                  }
                  className="h-12 rounded-2xl text-[13px]"
                  style={{
                    ...fieldStyle,
                    borderColor:
                      calendar === value
                        ? "#c7aa69"
                        : colors.borderStrong,
                    color:
                      calendar === value
                        ? "#efd99f"
                        : colors.textMuted,
                  }}
                >
                  {calendar === value && (
                    <Check
                      size={12}
                      className="mr-1 inline"
                    />
                  )}
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px] leading-5" style={{ color: colors.textSoft }}>
              음력 생일은 아직 계산하지 못해요. 양력 생일로 입력해 주세요.
            </p>
          </div>

          <label className="block">
            <span
              className="mb-2 flex items-center gap-2 text-xs"
              style={{
                color: colors.textMuted,
              }}
            >
              <CalendarDays size={14} />
              태어난 날짜
            </span>

            <input
              type="date"
              value={date}
              onChange={(event) =>
                setDate(event.target.value)
              }
              className="h-[52px] w-full rounded-2xl px-4 outline-none [color-scheme:dark]"
              style={fieldStyle}
            />
          </label>

          <div>
            <label className="block">
              <span
                className="mb-2 flex items-center gap-2 text-xs"
                style={{
                  color: colors.textMuted,
                }}
              >
                <Clock3 size={14} />
                태어난 시간
              </span>

              <input
                type="time"
                value={time}
                disabled={unknown}
                onChange={(event) =>
                  setTime(event.target.value)
                }
                className="h-[52px] w-full rounded-2xl px-4 outline-none disabled:opacity-35 [color-scheme:dark]"
                style={fieldStyle}
              />
            </label>

            <button
              type="button"
              onClick={() => {
                setUnknown(!unknown);

                if (!unknown) {
                  setTime("");
                }
              }}
              className="mt-2 flex items-center gap-2 text-xs"
              style={{
                color: unknown
                  ? "#e4cb8f"
                  : colors.textMuted,
              }}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-md border"
                style={{
                  borderColor: unknown
                    ? "#c7aa69"
                    : colors.borderStrong,
                  background: unknown
                    ? "rgba(199,170,105,.16)"
                    : "transparent",
                }}
              >
                {unknown && <Check size={12} />}
              </span>
              태어난 시간을 몰라요
            </button>

            <p
              className="mt-2 text-[11px] leading-4"
              style={{
                color: colors.textFaint,
              }}
            >
              시간을 몰라도 괜찮아요. 그럴 땐 시주는 비워 두고
              나머지 세 기둥으로 볼게요.
            </p>
          </div>

          <label className="block">
            <span
              className="mb-2 flex items-center gap-2 text-xs"
              style={{
                color: colors.textMuted,
              }}
            >
              <MapPin size={14} />
              출생 지역{" "}
              <b
                className="font-normal"
                style={{
                  color: colors.textFaint,
                }}
              >
                선택
              </b>
            </span>

            <input
              value={birthplace}
              onChange={(event) =>
                setBirthplace(
                  event.target.value,
                )
              }
              placeholder="예: 서울 (지금은 계산에 쓰지 않아요)"
              className="h-[52px] w-full rounded-2xl px-4 outline-none"
              style={fieldStyle}
            />

            <p
              className="mt-2 text-[11px]"
              style={{
                color: colors.textFaint,
              }}
            >
              지역 보정 방식은 실제 사주 엔진 연동 후
              적용합니다.
            </p>
          </label>
        </div>

        <AnimatePresence>
          {review && (
            <motion.div
              initial={{
                opacity: 0,
                y: 8,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              className="mt-6 rounded-3xl p-5"
              style={{
                background:
                  "linear-gradient(145deg,rgba(205,174,117,.13),rgba(255,255,255,.025))",
                border:
                  "1px solid rgba(205,174,117,.35)",
              }}
            >
              <p
                className="text-sm"
                style={{
                  fontFamily: serif,
                  color: colors.text,
                }}
              >
                이 정보로 볼까요?
              </p>

              <dl className="mt-3 grid grid-cols-[88px_1fr] gap-y-2 text-xs">
                <dt
                  style={{
                    color: colors.textFaint,
                  }}
                >
                  이름
                </dt>
                <dd
                  style={{
                    color: colors.text,
                  }}
                >
                  {alias || "입력하지 않음"}
                </dd>

                <dt
                  style={{
                    color: colors.textFaint,
                  }}
                >
                  생년월일
                </dt>
                <dd
                  style={{
                    color: colors.text,
                  }}
                >
                  {date} ·{" "}
                  {calendar === "solar"
                    ? "양력"
                    : calendar === "lunar"
                      ? "음력"
                      : "음력 윤달"}
                </dd>

                <dt
                  style={{
                    color: colors.textFaint,
                  }}
                >
                  출생시간
                </dt>
                <dd
                  style={{
                    color: colors.text,
                  }}
                >
                  {unknown ? "모름" : time}
                </dd>

                <dt
                  style={{
                    color: colors.textFaint,
                  }}
                >
                  출생지역
                </dt>
                <dd
                  style={{
                    color: colors.text,
                  }}
                >
                  {birthplace ||
                    "입력하지 않음"}
                </dd>
              </dl>

              <button
                type="button"
                onClick={() =>
                  setReview(false)
                }
                className="mt-4 text-xs underline underline-offset-4"
                style={{
                  color: colors.textMuted,
                }}
              >
                수정할게요
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className="mt-6 rounded-2xl p-4 text-[11.5px] leading-5"
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            color: colors.textFaint,
          }}
        >
          입력한 생일·시간은 이 휴대폰에서 계산에만 쓰고
          저장하지 않아요. 서버로도 보내지 않아요.
        </div>
      </div>

      <div
        className="flex flex-col gap-3 px-6 py-6"
        style={{
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        {review ? (
          <PrimaryButton onClick={() => onNext({ date, time: unknown ? null : time, gender: gender as SajuCalcInput["gender"], calendar })}>
            맞아요
          </PrimaryButton>
        ) : (
          <PrimaryButton
            onClick={confirm}
            disabled={!valid}
          >
            입력 내용 확인하기
          </PrimaryButton>
        )}

        {onSwitchToTaro && (
          <button
            type="button"
            onClick={onSwitchToTaro}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm"
            style={{
              color: colors.textMuted,
              border: `1px solid ${colors.border}`,
            }}
          >
            <Sparkles size={14} />
            타로로 시작할래요
          </button>
        )}
      </div>
    </div>
  );
}