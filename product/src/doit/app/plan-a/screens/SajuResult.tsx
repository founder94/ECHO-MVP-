import { useMemo, useState } from "react";
import { ELEMENT_ORDER, STEMS_KO, BRANCHES_KO, SajuError, calculateSaju, elementOfBranch, elementOfStem, type SajuInput } from "@/doit/lib/saju/engine";
import { currentFlow, groupFlow, sajuSeedKey, summaryLines, topics } from "@/doit/lib/saju/explain";
import { sajuStoryFacts } from "@/doit/lib/saju/storyFacts";
import { generateSajuStory, type SajuStory } from "@/doit/lib/openai";
import "./saju.css";
import { OPEN_PERIOD } from "@/doit/lib/openPeriod";

// 「ECHO가 들려주는 이야기」(2026-10-06 대표 「사람냄새나게」): 규칙 해설 아래, 누를 때만 AI 가 말하듯 풀어 준다.
// 2026-10-06 운영 openai-chat v7(saju_reading) 배포 · 대표 「사주말투 좋고 … ai와 대화시작으로 플로우 이어가게」 → 기본으로 켠다.
// 끄려면 빌드 스위치 VITE_SAJU_STORY_ENABLED=false. 서버가 없거나 실패하면 규칙 해설은 그대로 두고 「지금은 이야기를 만들지 못했어요」만 보인다.
const SAJU_STORY_ENABLED = import.meta.env.VITE_SAJU_STORY_ENABLED !== "false";
type StoryState = { kind: "idle" } | { kind: "loading" } | { kind: "done"; story: SajuStory } | { kind: "error" };

function SajuStoryCard({ facts, onTalk }: { facts: ReturnType<typeof sajuStoryFacts>; onTalk: () => void }) {
  const [state, setState] = useState<StoryState>({ kind: "idle" });
  const ask = () => {
    if (state.kind === "loading") return;
    setState({ kind: "loading" });
    generateSajuStory(facts).then((story) => setState({ kind: "done", story })).catch(() => setState({ kind: "error" }));
  };
  return <section className="saju-card saju-story" aria-label="ECHO가 들려주는 이야기" aria-busy={state.kind === "loading"}>
    <p className="saju-step">8 · 이야기로 듣기</p>
    <h2 className="saju-h2">ECHO가 들려주는 이야기</h2>
    {state.kind === "done" ? <>
      <p className="saju-body saju-story-text">{state.story.story}</p>
      <p className="saju-body saju-story-closing">{state.story.closing}</p>
      <p className="saju-cap">재미로 보는 참고 이야기예요. 정해진 일을 알려 주지 않아요.</p>
      {/* 이야기 다음 걸음: 더 알고 싶으면 ECHO 대화로 이어 간다(아래 「ECHO랑 이야기해볼래요」와 같은 길 · 사주 결과는 대화에 사실로 쓰지 않음). */}
      <p className="saju-body saju-story-next">좀 더 알고 싶으시면, ECHO와 이야기를 이어 가 봐요.</p>
      <div className="saju-actions"><button type="button" className="saju-primary" onClick={onTalk}>ECHO와 대화 시작하기</button></div>
    </> : <>
      <p className="saju-body">위 해설을 바탕으로, 당신에게 말하듯 천천히 풀어 볼게요.</p>
      {state.kind === "error" && <p className="saju-body" role="alert">지금은 이야기를 만들지 못했어요. 위 해설은 그대로 볼 수 있어요.</p>}
      <div className="saju-actions">
        <button type="button" className="saju-primary" disabled={state.kind === "loading"} onClick={ask}>
          {state.kind === "loading" ? "천천히 읽어 보고 있어요…" : state.kind === "error" ? "다시 들어 볼래요" : "이야기로 들어 볼래요"}
        </button>
      </div>
      <p className="saju-cap">누르면 생일·시간이 아니라, 계산된 결과 두 가지만 ECHO에게 보내요. 저장하지 않아요.</p>
    </>}
  </section>;
}

// 무료 사주 결과(2026-09-26 대표 「SAJU / TAROT FINAL LOCK」): 입력 → 계산 엔진 → 명식 · 오행 · 현재 흐름 · 10년 흐름 · 연도별 흐름 · 주제별 해설 · 정리.
// - 명식·오행·흐름은 engine.ts 계산값만, 해설은 explain.ts 규칙 문장만(AI 0 · 가짜 예시 0).
// - 계산이 안 되면 결과를 만들지 않고 이유와 다시 입력만 보인다.
// - 저장 0: 입력·결과·[비슷해요/조금 달라요]는 이 화면에만 있고 서버·나의 이해·매칭으로 가지 않는다.
// - 사주/타로 콘텐츠 화면은 대표가 허락한 어두운 콘텐츠 테마(Content Dark Exception) — 앱 본 화면(파스텔)과 구분한다.

// 2026-10-06 대표 「일반 사용자는 이미지로 보여 줘야 이해한다」: 글자 칸을 기운 색 타일로 · 다섯 기운은 그림 바퀴로 · 각 장마다 한 줄 안내.
// 색은 전통 오행 색(나무=초록 · 불=빨강 · 흙=노랑 · 쇠=흰빛 · 물=검정)만 쓴다(다른 서비스 화면을 옮기지 않음).
const EL_TILE: Record<string, { bg: string; fg: string; icon: string; name: string }> = {
  wood: { bg: "#3f8f6b", fg: "#fff", icon: "🌳", name: "나무" },
  fire: { bg: "#e2574c", fg: "#fff", icon: "🔥", name: "불" },
  earth: { bg: "#e8b545", fg: "#2b2310", icon: "⛰️", name: "흙" },
  metal: { bg: "#eef0f2", fg: "#20242a", icon: "💎", name: "쇠" },
  water: { bg: "#23262b", fg: "#fff", icon: "💧", name: "물" },
};
// 나를 뜻하는 글자(일간)를 한 장면으로 — 처음 보는 사람도 「아, 나는 이런 결이구나」 하고 들어오게.
const DAY_IMAGE = ["큰 나무", "풀꽃", "한낮의 해", "촛불", "큰 산", "너른 들", "단단한 바위", "반짝이는 보석", "넓은 바다", "보슬비"];
const DAY_ICON = ["🌳", "🌿", "☀️", "🕯️", "⛰️", "🌾", "🪨", "💎", "🌊", "🌧️"];

function Tile({ ch, ko, el, sub, me }: { ch: string; ko: string; el: string; sub?: string | null; me?: boolean }) {
  const t = EL_TILE[el];
  return <div className={`saju-tile${me ? " is-me" : ""}`} style={{ background: t.bg, color: t.fg }}>
    <b>{ch}</b><i>{ko}</i>{sub && <small>{sub}</small>}
  </div>;
}

// 다섯 기운 바퀴: 오각형 자리에 기운 그림 · 많을수록 큰 원 · 둘레 화살표 = 서로 살려 주는 순서(목→화→토→금→수).
function ElementWheel({ counts }: { counts: Record<string, number> }) {
  const pos = [[100, 34], [176, 88], [148, 172], [52, 172], [24, 88]];
  return <svg className="saju-wheel" viewBox="0 0 200 222" role="img" aria-label={ELEMENT_ORDER.map((k) => `${EL_TILE[k].name} ${counts[k]}개`).join(", ")}>
    <circle cx="100" cy="112" r="76" fill="none" stroke="rgb(255 255 255/.45)" strokeWidth="1.5" strokeDasharray="3 5" />
    {ELEMENT_ORDER.map((k, i) => {
      const [x, y] = pos[i]; const n = counts[k]; const r = 14 + Math.min(n, 4) * 3.5;
      return <g key={k}>
        <circle cx={x} cy={y} r={r} fill={EL_TILE[k].bg} stroke="#fff" strokeWidth="1.5" opacity={n ? 1 : 0.35} />
        <text x={x} y={y + 5} textAnchor="middle" fontSize={r * 0.9}>{EL_TILE[k].icon}</text>
        <text x={x} y={y + r + 13} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{EL_TILE[k].name} {n}</text>
      </g>;
    })}
  </svg>;
}

interface Props { input: SajuInput; onEdit: () => void; onExit: () => void; onTalk: (seedKey: ReturnType<typeof sajuSeedKey>) => void }

export function SajuResult({ input, onEdit, onExit, onTalk }: Props) {
  const calc = useMemo(() => {
    try { return { ok: true as const, r: calculateSaju(input) }; }
    catch (e) { return { ok: false as const, message: e instanceof SajuError ? e.message : "지금 계산하지 못했어요. 입력한 정보를 확인하고 다시 시도해 주세요." }; }
  }, [input]);
  const [openTopic, setOpenTopic] = useState<string | null>("me");
  const [pickedYear, setPickedYear] = useState<number>(new Date().getFullYear());
  const [fit, setFit] = useState<null | "similar" | "different">(null);

  if (!calc.ok) return <div className="saju-page"><div className="saju-inner">
    <p className="saju-kicker">무료 사주</p>
    <h1 className="saju-title">지금 계산하지 못했어요</h1>
    <p className="saju-body" role="alert">{calc.message}</p>
    <div className="saju-actions"><button type="button" className="saju-primary" onClick={onEdit}>다시 입력할게요</button><button type="button" className="saju-text" onClick={onExit}>나가기</button></div>
  </div></div>;

  const r = calc.r; const f = r.four_pillars; const t = r.ten_gods;
  const cf = currentFlow(r); const picked = r.annual_flow.find((a) => a.year === pickedYear) ?? r.annual_flow[1];

  return <div className="saju-page"><div className="saju-inner">
    <p className="saju-kicker">무료 사주</p>
    <h1 className="saju-title">내 사주 명식</h1>
    <p className="saju-body">{input.date} · {input.time ?? "시간 모름"} · 양력</p>

    <section className="saju-card saju-hero" aria-label="나를 뜻하는 글자">
      <p className="saju-hero-icon" aria-hidden="true">{DAY_ICON[r.day_master.stem]}</p>
      <p className="saju-step">1 · 나</p>
      <h2 className="saju-h2">나를 뜻하는 글자는 「{STEMS_KO[r.day_master.stem]}」, {DAY_IMAGE[r.day_master.stem]} 같은 결이에요.</h2>
      <p className="saju-cap">사주는 태어난 순간의 하늘과 땅을 여덟 글자로 적은 거예요. 그중 한 글자가 「나」예요. 아래로 내려가면 나머지 글자가 나를 어떻게 둘러싸는지 볼 수 있어요.</p>
      <p className="saju-next" aria-hidden="true">↓ 나를 둘러싼 여덟 글자</p>
    </section>

    <section className="saju-card" aria-label="기본 명식">
      <p className="saju-step">2 · 여덟 글자</p>
      <h2 className="saju-h2">기본 명식</h2>
      <div className="saju-pillars">
        {([["시", f.hour, t.hour], ["일", f.day, t.day], ["월", f.month, t.month], ["년", f.year, t.year]] as const).map(([label, pl, g]) => <div key={label} className="saju-col">
          <p className="saju-cap">{label}</p>
          {pl ? <>
            <Tile ch={pl.hanja[0]} ko={STEMS_KO[pl.stem]} el={elementOfStem(pl.stem)} sub={label === "일" ? "나" : g?.[0] ?? null} me={label === "일"} />
            <Tile ch={pl.hanja[1]} ko={BRANCHES_KO[pl.branch]} el={elementOfBranch(pl.branch)} sub={g?.[1] ?? null} />
          </> : <div className="saju-tile is-empty">모름</div>}
        </div>)}
      </div>
      <p className="saju-cap">테두리가 있는 칸({STEMS_KO[r.day_master.stem]})이 나예요. 칸 색은 기운(나무·불·흙·쇠·물), 작은 글씨는 나와의 관계예요.</p>
      <p className="saju-next" aria-hidden="true">↓ 이 색들을 모아 보면</p>
    </section>

    <section className="saju-card" aria-label="오행">
      <p className="saju-step">3 · 다섯 기운</p>
      <h2 className="saju-h2">내 안의 다섯 가지 기운</h2>
      <ElementWheel counts={r.five_elements as Record<string, number>} />
      <p className="saju-cap">명식 {f.hour ? 8 : 6}글자의 오행 개수예요(점수가 아니에요). 많은 기운은 내가 자주 쓰는 결, 적은 기운은 덜 익숙한 결이에요.</p>
      <p className="saju-next" aria-hidden="true">↓ 그럼 지금은 어떤 때일까요</p>
    </section>

    <section className="saju-card" aria-label="현재 흐름">
      <p className="saju-step">4 · 지금</p>
      <h2 className="saju-h2">지금 흐름</h2>
      {cf.lines.length ? cf.lines.map((l, i) => <p key={i} className="saju-body">{l}</p>) : <p className="saju-body">성별을 고르지 않아 10년 흐름은 계산하지 않았어요.</p>}
    </section>

    <section className="saju-card" aria-label="10년 흐름">
      <p className="saju-step">5 · 큰 흐름</p>
      <h2 className="saju-h2">10년 흐름</h2>
      {r.major_cycles ? <>
        <p className="saju-cap">{r.major_cycles.startAgeText}부터 10년마다 바뀌어요 · {r.major_cycles.direction === "forward" ? "순행" : "역행"}</p>
        <ol className="saju-cycles">{r.major_cycles.cycles.map((c) => <li key={c.order} className={cf.cycle?.order === c.order ? "is-now" : ""}><span>{c.startAge}세~</span><Tile ch={c.pillar.hanja[0]} ko={STEMS_KO[c.pillar.stem]} el={elementOfStem(c.pillar.stem)} /><Tile ch={c.pillar.hanja[1]} ko={BRANCHES_KO[c.pillar.branch]} el={elementOfBranch(c.pillar.branch)} /><small>{c.tenGod}</small></li>)}</ol>
      </> : <p className="saju-body">성별을 고르지 않아 계산하지 않았어요. 다시 입력에서 고를 수 있어요.</p>}
    </section>

    <section className="saju-card" aria-label="연도별 흐름">
      <p className="saju-step">6 · 올해와 다음 해</p>
      <h2 className="saju-h2">연도별 흐름</h2>
      <p className="saju-cap">궁금한 해를 눌러 보세요.</p>
      <div className="saju-years" role="group" aria-label="연도 고르기">{r.annual_flow.map((a) => <button key={a.year} type="button" aria-pressed={a.year === picked.year} onClick={() => setPickedYear(a.year)}><b>{a.year}</b><small>{a.pillar.hanja}</small></button>)}</div>
      <p className="saju-body">{picked.year}년 {picked.pillar.hangul}({picked.pillar.hanja})은 나에게 {picked.tenGod} 자리예요. {groupFlow(picked.tenGod)}</p>
      <p className="saju-cap">이 시기를 돌아보는 참고로만 봐 주세요. 정해진 일을 알려 주는 건 아니에요.</p>
    </section>

    <section className="saju-card" aria-label="주제별 해설">
      <p className="saju-step">7 · 궁금한 것만</p>
      <h2 className="saju-h2">주제별로 보기</h2>
      {topics(r).map((tp) => <div key={tp.id} className="saju-topic">
        <button type="button" aria-expanded={openTopic === tp.id} onClick={() => setOpenTopic(openTopic === tp.id ? null : tp.id)}>{tp.title}<span aria-hidden="true">{openTopic === tp.id ? "▴" : "▾"}</span></button>
        {openTopic === tp.id && tp.lines.map((l, i) => <p key={i} className="saju-body">{l}</p>)}
      </div>)}
    </section>

    {SAJU_STORY_ENABLED && <SajuStoryCard facts={sajuStoryFacts(r)} onTalk={() => onTalk(sajuSeedKey(r))} />}

    <section className="saju-card" aria-label="정리">
      <h2 className="saju-h2">정리</h2>
      {summaryLines(r).map((l, i) => <p key={i} className="saju-body">{l}</p>)}
      <p className="saju-body saju-ask">이 결과, 실제 나랑 좀 비슷했어요?</p>
      <div className="saju-actions saju-actions--row">
        <button type="button" className="saju-secondary" aria-pressed={fit === "similar"} onClick={() => setFit("similar")}>좀 비슷해요</button>
        <button type="button" className="saju-secondary" aria-pressed={fit === "different"} onClick={() => setFit("different")}>조금 달라요</button>
      </div>
      <div className="saju-actions"><button type="button" className="saju-primary" onClick={() => onTalk(sajuSeedKey(r))}>ECHO랑 이야기해볼래요</button></div>
      <p className="saju-cap">결과는 이야기 거리일 뿐이에요. 실제로 어떤지는 대화에서 내가 직접 말한 것만 기억해요.</p>
      {fit && <p className="saju-cap">고른 답은 이 화면에만 있어요. 나의 이해나 사람 연결에는 쓰지 않아요.</p>}
    </section>

    {r.calculation_meta.notes.length > 0 && <section className="saju-note" aria-label="계산 참고">{r.calculation_meta.notes.map((n, i) => <p key={i} className="saju-cap">{n}</p>)}</section>}
    <p className="saju-cap">계산 기준: 양력 · 한국 시간 · 절기 기준 월 · 밤 11시 반부터 다음 날. 입력한 생일·시간은 이 휴대폰에서 계산에만 쓰고 저장하지 않아요.</p>

    {OPEN_PERIOD.active && <p className="saju-cap">{OPEN_PERIOD.result}</p>}

    <div className="saju-actions">
      <button type="button" className="saju-secondary" onClick={onEdit}>다시 입력할게요</button>
      <button type="button" className="saju-text" onClick={onExit}>여기까지 볼게요</button>
    </div>
  </div></div>;
}
