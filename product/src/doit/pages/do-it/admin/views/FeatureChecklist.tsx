import { PanelTitle } from "../components/ui";

// 대표 2026-09-25 「초보 대표가 이해하기 쉽게 확인 체크」: 기능마다 지금 되는지 한 줄로.
// 이 표는 2026-09-25 에 실제 운영(서버 함수 목록·DB 표·화면 코드)을 확인한 결과다. 기능 상태가 바뀌면 이 목록을 함께 고친다.
// 숫자는 지어내지 않는다 — 실제로 센 값(동의 수)만 넣고, 나머지는 상태 문장만 둔다.

type State = "ok" | "wait" | "off" | "decide";

const STATE_LABEL: Record<State, string> = {
  ok: "작동 중",
  wait: "준비 중",
  off: "꺼 둠",
  decide: "대표 결정 필요",
};

const STATE_CLASS: Record<State, string> = {
  // 뜻으로 고른 색: 초록 = 된다 · 노랑 = 대표가 정할 것 · 회색 = 아직/꺼 둠(브랜드 색과 따로).
  ok: "border-[#2f8a57] bg-[#eaf6ef] text-[#1f6b41]",
  wait: "border-background-300 text-foreground-600",
  off: "border-background-300 text-foreground-600",
  decide: "border-[#c98a12] bg-[#fdf3dc] text-[#7a5200]",
};

interface Row { name: string; state: State; what: string }

const FEATURE_ROWS: Row[] = [
  { name: "이메일 · Google 로그인", state: "ok", what: "가입과 로그인이 돼요." },
  { name: "얼굴 · 지문 로그인", state: "off", what: "서버 쪽 준비가 안 돼서 화면에서 뺐어요. 준비되면 다시 켜요." },
  { name: "AI 대화(다섯 가지 질문)", state: "ok", what: "지금 운영 중이에요. 답을 놓치던 문제를 고친 개선판(v1.9)은 대표 승인 뒤 올려요." },
  { name: "AI 소개 초안", state: "ok", what: "대화를 마치면 AI가 소개 2~4문장을 써 주고, 사용자가 확인해야 저장돼요." },
  { name: "사진 올리기", state: "ok", what: "프로필 사진을 올리고 바꿀 수 있어요." },
  { name: "AI 사진 확인", state: "decide", what: "사진을 OpenAI로 보내 확인해요. 개인정보 문구는 고쳤지만, 기존 회원에게 다시 동의를 받을지 법무 확인이 필요해요." },
  { name: "음성으로 말하기", state: "ok", what: "글 적는 칸의 마이크 버튼. 말한 대로 글자가 채워져요. 목소리는 저장하지 않아요." },
  { name: "전화 인증", state: "wait", what: "문자 발송 업체가 연결되지 않았어요. 연결 전까지는 누구도 연결 자격을 갖추지 못해요." },
  { name: "사람 연결(연결 승인)", state: "wait", what: "화면과 서버는 있지만 전화 인증이 없어 아직 연결 0건이에요." },
  { name: "결제(토스 4,900원)", state: "off", what: "테스트 키만 연결돼 있어 실제 결제는 꺼져 있어요. 결제 0건." },
  { name: "신고 · 차단", state: "wait", what: "연결된 상대를 「차단하고 신고」할 수 있게 만들어 뒀어요. 아직 연결이 없어 0건이에요." },
  { name: "회원 탈퇴", state: "ok", what: "설정에서 탈퇴하면 서버가 계정을 지워요." },
  { name: "KEY", state: "decide", what: "보유 기록은 있지만 관리자가 볼 권한이 없어요. 볼 수 있게 할지 정해 주세요." },
  { name: "공간(방) · 협동 활동", state: "wait", what: "아직 만들지 않은 기능이에요. 방 화면의 신고 버튼은 연습용(데모)이라 실제로 접수되지 않아요." },
];

export default function FeatureChecklist({ consents }: { consents: number | null }) {
  const count = (s: State) => FEATURE_ROWS.filter((r) => r.state === s).length;
  return (
    <section aria-labelledby="feature-checklist-title">
      <PanelTitle>
        <span id="feature-checklist-title">한눈에 점검표</span>
      </PanelTitle>
      <p className="mt-1 text-xs text-foreground-500">
        2026-09-25 실제 운영을 확인한 결과예요. 작동 중 {count("ok")} · 준비 중 {count("wait")} · 꺼 둠 {count("off")} · 대표 결정 필요 {count("decide")}
        {consents != null ? ` · 약관 동의 ${consents}명` : ""}
      </p>
      <ul className="mt-3 flex flex-col divide-y divide-background-200 rounded-lg border border-background-200 bg-background-50">
        {FEATURE_ROWS.map((row) => (
          <li key={row.name} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
            <span className={`inline-flex w-fit shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold sm:w-28 sm:justify-center ${STATE_CLASS[row.state]}`}>
              {STATE_LABEL[row.state]}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground-950">{row.name}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-foreground-600">{row.what}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
