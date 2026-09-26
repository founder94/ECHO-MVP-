import { Link } from "react-router-dom";
import { PanelTitle } from "../components/ui";
import { LEGAL_EFFECTIVE_DATE, LEGAL_UPDATED_DATE, LEGAL_VERSION } from "@/lib/legal/documents";

// 대표 2026-09-25 「초보 대표가 이해하기 쉽게 확인 체크」 → 2026-09-26 ADMIN OPERATIONS FINAL: 「작동 중」 한 칸으로 끝내지 않고
// 화면 · 서버 · 저장(DB) · 외부 서비스 · 실기기 · 출시 준비 여섯 칸으로 나눠 거짓 PASS 를 막는다.
// 이 표는 2026-09-26 에 코드·서버 함수 목록·실제 AI 검사로 확인한 결과다(운영 데이터 쓰기 0). 기능 상태가 바뀌면 이 목록을 함께 고친다.
// 숫자는 지어내지 않는다 — 실제로 센 값(동의 수)만 넣고, 나머지는 상태 문장만 둔다. 실기기는 대표가 직접 확인한 것만 PASS.

type State = "ok" | "wait" | "off" | "decide";
type Axis = "PASS" | "PARTIAL" | "FAIL" | "NOT_CONNECTED" | "STOP" | "UNKNOWN" | "NA";

const STATE_LABEL: Record<State, string> = {
  ok: "작동 중",
  wait: "준비 중",
  off: "꺼 둠",
  decide: "대표 결정 필요",
};

const STATE_CLASS: Record<State, string> = {
  // 뜻으로 고른 색: 초록 = 된다 · 노랑 = 대표가 정할 것 · 회색 = 아직/꺼 둠(브랜드 색과 따로). 색만으로 뜻을 전하지 않는다(글자 함께).
  ok: "border-[#2f8a57] bg-[#eaf6ef] text-[#1f6b41]",
  wait: "border-background-300 text-foreground-600",
  off: "border-background-300 text-foreground-600",
  decide: "border-[#c98a12] bg-[#fdf3dc] text-[#7a5200]",
};

const AXIS_TEXT: Record<Axis, string> = { PASS: "PASS 됨", PARTIAL: "PARTIAL 부분", FAIL: "FAIL 안 됨", NOT_CONNECTED: "미연결", STOP: "STOP 승인 필요", UNKNOWN: "확인 불가", NA: "해당 없음" };
const AXIS_CLASS: Record<Axis, string> = {
  PASS: "text-[#1f6b41]", PARTIAL: "text-[#7a5200]", FAIL: "text-[#8c1d18]", NOT_CONNECTED: "text-foreground-600", STOP: "text-[#7a5200]", UNKNOWN: "text-foreground-600", NA: "text-foreground-500",
};
const AXES = [["ui", "화면"], ["server", "서버"], ["db", "저장"], ["ext", "외부 서비스"], ["device", "실기기"], ["ready", "출시 준비"]] as const;
type AxisKey = (typeof AXES)[number][0];

interface Row { name: string; state: State; what: string; axes: Record<AxisKey, Axis> }

const FEATURE_ROWS: Row[] = [
  { name: "이메일 · Google 로그인", state: "ok", what: "가입과 로그인이 돼요.",
    axes: { ui: "PASS", server: "PASS", db: "PASS", ext: "PASS", device: "PASS", ready: "PASS" } },
  { name: "얼굴 · 지문 로그인", state: "off", what: "서버 쪽 준비가 안 돼서 화면에서 뺐어요. 준비되면 다시 켜요.",
    axes: { ui: "NA", server: "NOT_CONNECTED", db: "NA", ext: "NOT_CONNECTED", device: "NA", ready: "FAIL" } },
  { name: "AI 대화(다섯 가지 질문)", state: "ok", what: "운영 서버는 v2.2 예요(2026-09-26 대표 승인 배포 · 서버 버전 7 · 실제 AI 검사 run 19 통과). 서버가 항의·피로·도움 요청을 가려내 답으로 저장하지 않아요. 같은 질문 반복(검사 6회)은 아직 목표 미달이에요.",
    axes: { ui: "PASS", server: "PASS", db: "PASS", ext: "PASS", device: "PASS", ready: "PARTIAL" } },
  { name: "AI 소개 초안", state: "ok", what: "대화를 마치면 AI가 소개 2~4문장을 써 주고, 사용자가 확인해야 저장돼요. 대표 실기기에서 확인했어요(서버 기록 대조는 아직).",
    axes: { ui: "PASS", server: "PASS", db: "PASS", ext: "PASS", device: "PASS", ready: "PASS" } },
  { name: "사진 올리기", state: "ok", what: "프로필 사진을 올리고 바꿀 수 있어요. 「최근 2개월 사진」 확인을 저장할 칸은 없어요.",
    axes: { ui: "PASS", server: "PASS", db: "PASS", ext: "NA", device: "UNKNOWN", ready: "PARTIAL" } },
  { name: "AI 사진 확인", state: "off", what: "2026-09-26 MVP FINAL PATCH: MVP에서 꺼 두었어요(DEFERRED_MVP). 사진 화면이 서버 함수를 부르지 않고 사진을 OpenAI로 보내지 않아요(PHOTO_AI_CHECK_ENABLED=false). 서버 함수는 그대로 남아 있어요.",
    axes: { ui: "NA", server: "NA", db: "NA", ext: "NOT_CONNECTED", device: "NA", ready: "STOP" } },
  { name: "말로 대화하기", state: "off", what: "2026-09-26 MVP FINAL PATCH: 독립 음성 대화가 완성되기 전이라 화면에서 숨겼어요(DEFERRED_MVP · VOICE_CONVERSATION_ENABLED=false). 시작 버튼은 「대화 시작하기」 하나예요. 키보드 받아쓰기를 음성 기능이라고 안내하는 문구 0.",
    axes: { ui: "NA", server: "NA", db: "NA", ext: "NOT_CONNECTED", device: "NA", ready: "STOP" } },
  { name: "ECHO가 이해한 나(확인·정정)", state: "decide", what: "다섯 문답 뒤 AI 초안을 보여 주고 [맞아요]·[조금 달라요](한 칸만 고침)·[다시 말할게요]. 고친 말은 대화 서버(v2.2) 정정 턴으로 들어가 옛 뜻을 거둬요. [맞아요] 기록은 이 기기에만 있어요(서버 기록은 서버 변경 승인 뒤).",
    axes: { ui: "PASS", server: "PARTIAL", db: "PARTIAL", ext: "PASS", device: "UNKNOWN", ready: "PARTIAL" } },
  { name: "DO IT MUSIC 순간", state: "decide", what: "첫 화면 음악 플레이어를 내리고, [맞아요] 뒤 작은 카드에서 누를 때만 원음 1을 들려줘요. 대표 가사 원문이 저장소에 없어 가사 줄은 비어 있어요(MISSING). 대표 음악·구간 지정 필요.",
    axes: { ui: "PASS", server: "NA", db: "NA", ext: "UNKNOWN", device: "UNKNOWN", ready: "PARTIAL" } },
  { name: "약관 · AI 고지", state: "decide", what: `약관·개인정보 ${LEGAL_VERSION} · 시행일 ${LEGAL_EFFECTIVE_DATE} · 최종 변경 ${LEGAL_UPDATED_DATE} · 초안(법무 확인 전). 대화 시작 전 「이 대화는 AI가 함께합니다」, 프로필 초안 「ECHO가 대화를 바탕으로 작성한 초안이에요」 표시.`,
    axes: { ui: "PASS", server: "NA", db: "PASS", ext: "NA", device: "UNKNOWN", ready: "STOP" } },
  { name: "전화 인증", state: "wait", what: "문자 발송 업체가 연결되지 않았어요. 연결 전까지는 누구도 연결 자격을 갖추지 못해요.",
    axes: { ui: "PARTIAL", server: "PARTIAL", db: "PASS", ext: "NOT_CONNECTED", device: "FAIL", ready: "STOP" } },
  { name: "사람 연결(연결 승인)", state: "wait", what: "화면과 서버는 있지만 전화 인증이 없고, 연결 서버가 대화로 만든 매칭 프로필을 아직 읽지 않아 연결 0건이에요.",
    axes: { ui: "PASS", server: "PARTIAL", db: "PASS", ext: "NA", device: "UNKNOWN", ready: "FAIL" } },
  { name: "결제(토스 4,900원)", state: "off", what: "테스트 키만 연결돼 있어 실제 결제는 꺼져 있어요. 결제 0건.",
    axes: { ui: "PASS", server: "PARTIAL", db: "PASS", ext: "NOT_CONNECTED", device: "UNKNOWN", ready: "STOP" } },
  { name: "신고 · 차단", state: "wait", what: "연결된 상대를 「차단하고 신고」하면 서버가 접수해요. 아직 연결이 없어 0건이고, 운영자 처리 흐름은 확인 전이에요.",
    axes: { ui: "PASS", server: "PASS", db: "PASS", ext: "NA", device: "UNKNOWN", ready: "PARTIAL" } },
  { name: "회원 탈퇴", state: "ok", what: "설정에서 탈퇴하면 서버가 계정을 지워요. 실제 계정 삭제 검사는 대표 승인 범위에서만 해요.",
    axes: { ui: "PASS", server: "PASS", db: "PASS", ext: "NA", device: "UNKNOWN", ready: "PARTIAL" } },
  { name: "KEY", state: "decide", what: "보유 기록은 있지만 관리자가 볼 권한이 없어요. 볼 수 있게 할지 정해 주세요.",
    axes: { ui: "PARTIAL", server: "UNKNOWN", db: "PASS", ext: "NA", device: "UNKNOWN", ready: "STOP" } },
  { name: "공간(방) · 협동 활동", state: "wait", what: "아직 만들지 않은 기능이에요. 방 화면의 신고 버튼은 연습용(데모)이라 실제로 접수되지 않아요.",
    axes: { ui: "PARTIAL", server: "NOT_CONNECTED", db: "UNKNOWN", ext: "NA", device: "NA", ready: "FAIL" } },
];

// 출시 관문(2026-09-26 RELEASE GATE). 기능 PASS 와 서비스 출시 PASS 는 다르다 — 화면·파일만 있으면 PASS 가 아니고, 실제 동작 증거가 있어야 PASS.
// 일반 사용자에게 사람 연결을 열려면 여섯 관문이 모두 PASS 여야 한다. 하나라도 아니면 「출시 준비 됨」을 표시하지 않는다.
type Gate = "PASS" | "PARTIAL" | "FAIL" | "BLOCKED" | "UNKNOWN";
const GATE_TEXT: Record<Gate, string> = { PASS: "PASS 됨", PARTIAL: "PARTIAL 부분", FAIL: "FAIL 안 됨", BLOCKED: "BLOCKED 막힘", UNKNOWN: "UNKNOWN 확인 불가" };
const GATE_CLASS: Record<Gate, string> = { PASS: "text-[#1f6b41]", PARTIAL: "text-[#7a5200]", FAIL: "text-[#8c1d18]", BLOCKED: "text-[#8c1d18]", UNKNOWN: "text-foreground-600" };
const RELEASE_GATES: { id: string; name: string; state: Gate; why: string }[] = [
  { id: "A", name: "대화", state: "PARTIAL", why: "운영 v2.2(서버 버전 7): 질문 5개 상한·항의/피로/도움 가드·정정·거절 차단이 됨. 같은 질문 반복(실제 AI 검사 6회)·뜻 단위 거절 식별은 아직 목표 미달." },
  { id: "B", name: "프로필", state: "PARTIAL", why: "AI 소개 생성·사용자 확인·고치기는 대표 실기기에서 됨. 정보 출처 추적(계보)은 v2.2 배포 뒤 대화부터 쌓이고(예전 대화는 출처 칸 없음), 실기기 확인 전." },
  { id: "C", name: "신뢰", state: "BLOCKED", why: "전화 인증이 실제로 안 됨(문자 발송 업체 미연결 · STOP). 사진은 올릴 수 있음." },
  { id: "D", name: "안전", state: "PARTIAL", why: "「차단하고 신고」 서버 접수·관리자 신고 화면은 있음. 실제 접수 0건, 운영자 처리 흐름은 확인 전." },
  { id: "E", name: "매칭", state: "BLOCKED", why: "서버 후보 결정 계약(자격·차단·목적·근거 검증)은 코드와 검사만 있음. 연결 서버가 아직 쓰지 않아 실제 후보 0(가짜 후보 0)." },
  { id: "F", name: "운영", state: "PARTIAL", why: "관리자 파이프라인·실패/성공 후보·판 추적·되돌리기 순서(v1.8)는 있음. 실제 관리자 계정 데이터로는 확인 전, 실패 턴·판 기록은 v2.2 배포(2026-09-26) 뒤부터." },
];

// 지금 막힌 곳 TOP 3(2026-09-26 확인 · 대표 우선순위 P0/P1). 사용자별로 어디서 멈췄는지는 「대화 에이전트 → 어디서 막혔나」에 있다.
const BOTTLENECKS = [
  "전화 인증: 문자 발송 업체가 없어 연결 자격을 갖춘 사람이 0명이에요(업체·비밀키·저장 변경은 대표 승인 필요).",
  "사람 연결: 연결 서버가 대화로 만든 매칭 프로필을 아직 읽지 않아 후보가 0명이에요(가짜 후보는 만들지 않아요).",
  "AI 대화(v2.2 운영 중): 같은 질문 반복(실제 AI 검사 6회) 줄이기가 남음 · 문제 시 v1.8 로 코드만 되돌림.",
];

export default function FeatureChecklist({ consents }: { consents: number | null }) {
  const count = (s: State) => FEATURE_ROWS.filter((r) => r.state === s).length;
  return (
    <section aria-labelledby="feature-checklist-title">
      <PanelTitle>
        <span id="feature-checklist-title">한눈에 점검표</span>
      </PanelTitle>
      <p className="mt-1 text-xs text-foreground-500">
        2026-09-26 코드·서버·실제 AI 검사로 확인한 결과예요. 작동 중 {count("ok")} · 준비 중 {count("wait")} · 꺼 둠 {count("off")} · 대표 결정 필요 {count("decide")}
        {consents != null ? ` · 약관 동의 ${consents}명` : ""}
      </p>
      <div className="mt-3 rounded-lg border border-background-300 bg-background-50 px-4 py-3 text-xs" aria-labelledby="release-readiness-title">
        <p id="release-readiness-title" className="text-sm font-semibold text-foreground-950">출시 준비(RELEASE READINESS)</p>
        <p className="mt-0.5 font-semibold text-[#8c1d18]">
          {RELEASE_GATES.every((g) => g.state === "PASS") ? "일반 사용자에게 사람 연결을 열 수 있어요." : `일반 사용자에게 사람 연결을 아직 열 수 없어요 — 막힌 관문: ${RELEASE_GATES.filter((g) => g.state !== "PASS").map((g) => `${g.id} ${g.name}`).join(", ")}`}
        </p>
        <ul className="mt-2 flex flex-col gap-1">
          {RELEASE_GATES.map((g) => (
            <li key={g.id} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <span className="shrink-0 font-semibold text-foreground-950 sm:w-20">{g.id} {g.name}</span>
              <span className={`shrink-0 font-semibold sm:w-36 ${GATE_CLASS[g.state]}`}>{GATE_TEXT[g.state]}</span>
              <span className="text-foreground-600">{g.why}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 rounded-lg border border-[#c98a12] bg-[#fdf3dc] px-4 py-3 text-xs text-[#7a5200]">
        <p className="font-semibold">지금 막힌 곳 TOP 3</p>
        <ol className="mt-1 flex list-decimal flex-col gap-0.5 pl-4">{BOTTLENECKS.map((b) => <li key={b}>{b}</li>)}</ol>
        <Link to="/doit/admin/mobile?menu=agent" className="mt-2 inline-block font-semibold underline">사용자별로 어디서 멈췄는지 보기</Link>
      </div>
      <ul className="mt-3 flex flex-col divide-y divide-background-200 rounded-lg border border-background-200 bg-background-50">
        {FEATURE_ROWS.map((row) => (
          <li key={row.name} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
            <span className={`inline-flex w-fit shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold sm:w-28 sm:justify-center ${STATE_CLASS[row.state]}`}>
              {STATE_LABEL[row.state]}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground-950">{row.name}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-foreground-600">{row.what}</p>
              <dl className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                {AXES.map(([key, label]) => (
                  <div key={key} className="flex gap-1"><dt className="text-foreground-500">{label}</dt><dd className={`font-semibold ${AXIS_CLASS[row.axes[key]]}`}>{AXIS_TEXT[row.axes[key]]}</dd></div>
                ))}
              </dl>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
