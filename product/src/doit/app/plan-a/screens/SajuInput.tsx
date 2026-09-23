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

interface Props {
  onNext: () => void;
  onSwitchToTaro?: () => void;
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
}: Props) {
  const [calendar, setCalendar] =
    useState<Calendar>("solar");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [unknown, setUnknown] = useState(false);
  const [alias, setAlias] = useState("");
  const [birthplace, setBirthplace] = useState("");
  const [gender, setGender] = useState("");
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
            입력값을 먼저 보여드리고, 확인한 뒤에만 기본
            리딩으로 넘어갑니다.
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
              전통 명식 계산에 쓰이는 입력 구분이며,
              서비스의 성별 정체성·관계 목적과 분리합니다.
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
              시간을 모르면 시주를 제외한 범위만 보여주고,
              결과에 제한을 명확히 표시합니다.
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
              placeholder="예: 서울 · 지역 시차 보정용"
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
                입력한 정보가 맞나요?
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
                다시 수정하기
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
          현재 화면은 입력·확인 시연입니다. 가입 전 서버에
          저장하지 않으며, 실제 명식 계산·지역 보정·동의
          이력은 서버 연동 필요입니다.
        </div>
      </div>

      <div
        className="flex flex-col gap-3 px-6 py-6"
        style={{
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        {review ? (
          <PrimaryButton onClick={onNext}>
            내 기본 사주 보기
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