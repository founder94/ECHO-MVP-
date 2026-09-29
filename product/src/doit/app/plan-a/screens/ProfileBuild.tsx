import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Camera,
  ImageOff,
  ScanFace,
  ServerCog,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { colors, serif , surfaces } from "../theme";
import { PrimaryButton } from "../components/PrimaryButton";
import { UnderstandingError } from "@/doit/lib/understandingApi";
import { INTRO_MAX } from "@/doit/lib/introDraft";

// 프로필 입력 초안. 화면 사이에서 전달되며,
// 소개 저장은 부모에서 실제 서버 응답을 확인한다. 본인·얼굴 검증과 구분한다.
export interface ProfileDraft {
  nickname: string;
  intro: string;
  region: string;
  lifeRhythm: string;
}

interface Props {
  onNext: (draft: ProfileDraft) => void;
  initialDraft?: ProfileDraft | null;
  saving?: boolean;
  saveError?: string | null;
  // 2026-09-23 대표 "AI가 대신 작성하기": 다섯 가지 답으로 쓴 소개 초안을 받아 온다. 없으면 버튼을 그리지 않는다.
  onDraftIntro?: () => Promise<string>;
  // 답이 아직 모자랄 때 질문 화면으로 보내는 빠져나갈 문.
  onGoAnswer?: () => void;
}

type DraftState =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "filled" }                       // 빈 소개란에 바로 넣었다
  | { kind: "preview"; text: string }        // 이미 적은 글이 있어 덮어쓰기 전에 보여 준다
  | { kind: "error"; message: string; needAnswers: boolean };

const DRAFT_TIMEOUT_MESSAGE = "생각보다 오래 걸려요. 잠시 뒤 다시 눌러 주세요.";
const DRAFT_FAIL_MESSAGE = "지금은 소개를 쓰지 못했어요. 잠시 뒤 다시 눌러 주세요.";

const LIFE_RHYTHMS = [
  "아침형",
  "저녁형",
  "주말 활동",
  "평일 저녁",
  "불규칙",
];

const TRUST_POINTS = [
  {
    icon: Camera,
    text: "지금 촬영하거나, 최근 2개월 안에 찍은 사진을 골라요.",
  },
  {
    icon: ScanFace,
    text: "등록한 사진은 내 프로필에서 확인하고 바꿀 수 있어요.",
  },
  {
    icon: ImageOff,
    text: "다른 사람이나 AI로 만든 얼굴 대신, 지금의 내 사진을 올려주세요.",
  },
  {
    icon: UserCheck,
    text: "직접 적은 소개와 본인 확인 여부는 구분해 보여드려요.",
  },
];

const STATUS = [
  {
    label: "사용자 직접 작성",
    tone: "self",
  },
  {
    label: "AI가 대화에서 정리",
    tone: "ai",
  },
  {
    label: "확인 필요",
    tone: "pending",
  },
];

function statusColor(tone: string) {
  if (tone === "verified") {
    return colors.accent;
  }

  if (tone === "pending") {
    return colors.danger;
  }

  return colors.textMuted;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  backgroundColor: surfaces.field,
  border: `1px solid ${colors.borderStrong}`,
  borderRadius: 12,
  color: colors.text,
  fontSize: 14,
  padding: "12px 14px",
  outline: "none",
  lineHeight: 1.5,
};

const labelStyle: React.CSSProperties = {
  color: colors.textFaint,
  fontSize: 12,
  marginBottom: 6,
  display: "block",
};

export function ProfileBuild({
  onNext,
  initialDraft,
  saving,
  saveError,
  onDraftIntro,
  onGoAnswer,
}: Props) {
  // 기존 프로필(재로그인 후 읽어온 값)이 있으면 그 값으로 시작해,
  // 저장된 내용을 빈값으로 덮어쓰지 않는다.
  const [nickname, setNickname] = useState(
    initialDraft?.nickname ?? "",
  );
  const [intro, setIntro] = useState(
    initialDraft?.intro ?? "",
  );
  const [region, setRegion] = useState(
    initialDraft?.region ?? "",
  );
  const [lifeRhythm, setLifeRhythm] = useState(
    initialDraft?.lifeRhythm ?? "",
  );

  const [draftState, setDraftState] = useState<DraftState>({ kind: "idle" });
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  async function requestDraft() {
    if (!onDraftIntro || draftState.kind === "busy") return;
    setDraftState({ kind: "busy" });
    try {
      const text = (await onDraftIntro()).slice(0, INTRO_MAX);
      if (!alive.current) return;
      if (!text.trim()) { setDraftState({ kind: "error", message: DRAFT_FAIL_MESSAGE, needAnswers: false }); return; }
      if (intro.trim()) { setDraftState({ kind: "preview", text }); return; }
      setIntro(text);
      setDraftState({ kind: "filled" });
    } catch (e) {
      if (!alive.current) return;
      const needAnswers = e instanceof UnderstandingError && e.code === "NOT_ENOUGH";
      const message = e instanceof Error && e.name === "TimeoutError" ? DRAFT_TIMEOUT_MESSAGE
        : e instanceof UnderstandingError && e.message ? e.message : DRAFT_FAIL_MESSAGE;
      setDraftState({ kind: "error", message, needAnswers });
    }
  }

  const canNext = nickname.trim().length > 0;

  function handleNext() {
    if (saving) return;
    onNext({
      nickname: nickname.trim(),
      intro: intro.trim(),
      region: region.trim(),
      lifeRhythm,
    });
  }

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{
        backgroundColor: surfaces.page,
      }}
    >
      <div className="flex-1 overflow-y-auto px-6 pt-12 pb-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <p
            style={{
              color: surfaces.onPageFaint,
              fontSize: 11,
              letterSpacing: "0.2em",
              marginBottom: 10,
            }}
          >
            프로필 만들기
          </p>

          <h1
            style={{
              fontFamily: serif,
              fontSize: 26,
              lineHeight: 1.3,
              color: colors.text,
              marginBottom: 12,
            }}
          >
            이제, 실제 나를 보여줄
            <br />
            프로필을 만들어요
          </h1>

          <p
            style={{
              color: surfaces.onPage,
              fontSize: 14,
              lineHeight: 1.65,
            }}
          >
            직접 작성한 정보는 다음 화면에서 확인하고,
            "직접 작성"으로 표시돼요.
          </p>
        </motion.div>

        {/* 실제 입력 폼 — 목적에 필요한 정보를 직접 받는다 */}
        <div
          className="rounded-3xl p-5 mb-5"
          style={{
            backgroundColor: surfaces.card,
            border: `1px solid ${colors.borderStrong}`,
          }}
        >
          <p
            style={{
              fontFamily: serif,
              fontSize: 16,
              color: colors.text,
              marginBottom: 14,
            }}
          >
            나를 소개할 정보를 입력해요
          </p>

          <div className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="profile-nickname"
                style={labelStyle}
              >
                닉네임 *
              </label>
              <input
                id="profile-nickname"
                value={nickname}
                onChange={(e) =>
                  setNickname(e.target.value)
                }
                maxLength={20}
                placeholder="사람들에게 보일 이름"
                style={inputStyle}
              />
            </div>

            <div>
              <label
                htmlFor="profile-intro"
                style={labelStyle}
              >
                소개
              </label>
              <textarea
                id="profile-intro"
                value={intro}
                onChange={(e) =>
                  setIntro(e.target.value)
                }
                maxLength={INTRO_MAX}
                rows={5}
                placeholder="나를 한 문장으로 소개해 보세요."
                style={{
                  ...inputStyle,
                  resize: "none",
                }}
              />
              <p
                style={{
                  color: colors.textFaint,
                  fontSize: 11,
                  textAlign: "right",
                  marginTop: 4,
                }}
              >
                {intro.length}/{INTRO_MAX}
              </p>

              {onDraftIntro && (
                <div className="mt-2 flex flex-col gap-2" aria-live="polite">
                  <button
                    type="button"
                    onClick={() => void requestDraft()}
                    disabled={draftState.kind === "busy" || saving}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl min-h-12 px-4 py-3 disabled:opacity-60"
                    style={{
                      background: "linear-gradient(115deg,#f0f2f4,#bbc4d0)",
                      color: "#141820",
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    <Sparkles size={16} aria-hidden="true" />
                    {draftState.kind === "busy"
                      ? "내 답을 읽고 쓰는 중이에요…"
                      : draftState.kind === "filled"
                        ? "AI로 다시 쓰기"
                        : "AI가 대신 작성하기"}
                  </button>
                  {draftState.kind === "filled" && (
                    <p style={{ color: colors.textMuted, fontSize: 12, lineHeight: 1.6 }}>
                      다섯 가지 질문에 한 내 답으로 쓴 초안이에요. 마음대로 고친 뒤 저장하면 돼요.
                    </p>
                  )}
                  {draftState.kind === "preview" && (
                    <div className="rounded-2xl p-4" style={{ backgroundColor: surfaces.field, border: `1px solid ${colors.borderStrong}` }}>
                      <p style={{ color: colors.textFaint, fontSize: 11, marginBottom: 6 }}>AI가 내 답으로 쓴 초안</p>
                      <p style={{ color: colors.text, fontSize: 14, lineHeight: 1.65, wordBreak: "keep-all" }}>{draftState.text}</p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setIntro(draftState.text); setDraftState({ kind: "filled" }); }}
                          className="flex-1 rounded-xl min-h-11 px-3"
                          style={{ backgroundColor: colors.accent, color: colors.onAccent, fontSize: 13, fontWeight: 700 }}
                        >
                          이 글로 바꾸기
                        </button>
                        <button
                          type="button"
                          onClick={() => setDraftState({ kind: "idle" })}
                          className="flex-1 rounded-xl min-h-11 px-3"
                          style={{ border: `1px solid ${colors.borderStrong}`, color: colors.textMuted, fontSize: 13 }}
                        >
                          지금 글 그대로 두기
                        </button>
                      </div>
                    </div>
                  )}
                  {draftState.kind === "error" && (
                    <div role="alert" style={{ color: colors.danger, fontSize: 12.5, lineHeight: 1.6 }}>
                      <p>{draftState.message}</p>
                      {draftState.needAnswers && onGoAnswer && (
                        <button
                          type="button"
                          onClick={onGoAnswer}
                          className="mt-1 min-h-11 underline"
                          style={{ color: colors.text, fontSize: 13 }}
                        >
                          질문에 답하러 가기
                        </button>
                      )}
                    </div>
                  )}
                  {draftState.kind !== "error" && draftState.kind !== "filled" && (
                    <p style={{ color: colors.textFaint, fontSize: 11, lineHeight: 1.6 }}>
                      내가 한 답과 맞다고 한 말로만 써요. 저장하기 전에 고칠 수 있어요.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="profile-region"
                style={labelStyle}
              >
                활동 지역
              </label>
              <input
                id="profile-region"
                value={region}
                onChange={(e) =>
                  setRegion(e.target.value)
                }
                maxLength={30}
                placeholder="예: 서울 · 강남"
                style={inputStyle}
              />
            </div>

            <div>
              <span style={labelStyle}>
                생활 리듬
              </span>
              <div className="flex flex-wrap gap-2">
                {LIFE_RHYTHMS.map((rhythm) => {
                  const active =
                    lifeRhythm === rhythm;
                  return (
                    <button
                      key={rhythm}
                      type="button"
                      onClick={() =>
                        setLifeRhythm(
                          active ? "" : rhythm,
                        )
                      }
                      aria-pressed={active}
                      className="rounded-full px-3.5 py-2 whitespace-nowrap"
                      style={{
                        fontSize: 13,
                        color: active
                          ? colors.onAccent
                          : colors.textMuted,
                        backgroundColor: active
                          ? colors.accent
                          : surfaces.field,
                        border: `1px solid ${
                          active
                            ? colors.accent
                            : colors.borderStrong
                        }`,
                        transition:
                          "all 0.15s ease",
                      }}
                    >
                      {rhythm}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 사진·본인확인 안내(서버 연동 필요) */}
        <div
          className="rounded-3xl p-5 mb-5"
          style={{
            backgroundColor: surfaces.card,
            border: `1px solid ${colors.borderStrong}`,
          }}
        >
          <p
            style={{
              fontFamily: serif,
              fontSize: 16,
              color: colors.text,
              marginBottom: 16,
            }}
          >
            사진으로 내 모습을 더해요
          </p>

          <div className="flex flex-col gap-3">
            {TRUST_POINTS.map((point) => {
              const Icon = point.icon;

              return (
                <div
                  key={point.text}
                  className="flex items-start gap-2.5"
                >
                  <Icon
                    size={15}
                    color={colors.accent}
                    className="mt-0.5 shrink-0"
                  />

                  <span
                    style={{
                      color: colors.text,
                      fontSize: 13.5,
                      lineHeight: 1.55,
                    }}
                  >
                    {point.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <p
          style={{
            color: colors.textFaint,
            fontSize: 11,
            letterSpacing: "0.1em",
            marginBottom: 10,
          }}
        >
            소개에 붙는 표시의 뜻
        </p>

        <div className="flex flex-wrap gap-2 mb-5">
          {STATUS.map((status) => (
            <span
              key={status.label}
              className="rounded-full px-3 py-1.5 whitespace-nowrap"
              style={{
                fontSize: 12,
                color: statusColor(status.tone),
                border: `1px solid ${statusColor(
                  status.tone,
                )}33`,
                backgroundColor: surfaces.card,
              }}
            >
              {status.label}
            </span>
          ))}
        </div>

        <div
          className="rounded-2xl p-4 flex items-start gap-2.5"
          style={{
            backgroundColor: surfaces.card,
            border: `1px solid ${colors.border}`,
          }}
        >
          <ServerCog
            size={14}
            color={colors.textFaint}
            className="mt-0.5 shrink-0"
          />

          <p
            style={{
              color: colors.textFaint,
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            소개를 저장한 뒤 사진을 한 장씩 등록할 수 있어요.
            사진 등록만으로 본인확인이 완료되지는 않아요.
            실제 본인확인·얼굴 비교는 아직 제공하지 않아요.
          </p>
        </div>
      </div>

      <div
        className="px-6 py-6"
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
          onClick={handleNext}
          disabled={!canNext || saving}
        >
          {saving ? "저장 중…" : "소개 저장하고 사진 등록하기"}
        </PrimaryButton>
      </div>
    </div>
  );
}
