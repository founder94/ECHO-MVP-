import { useMemo, useState } from "react";
import { ELEMENT_KO, ELEMENT_ORDER, STEMS_KO, BRANCHES_KO, SajuError, calculateSaju, elementOfBranch, elementOfStem, type Pillar, type SajuInput, type TenGod } from "@/doit/lib/saju/engine";
import { currentFlow, groupFlow, sajuSeedKey, summaryLines, topics } from "@/doit/lib/saju/explain";
import "./saju.css";

// 무료 사주 결과(2026-09-26 대표 「SAJU / TAROT FINAL LOCK」): 입력 → 계산 엔진 → 명식 · 오행 · 현재 흐름 · 10년 흐름 · 연도별 흐름 · 주제별 해설 · 정리.
// - 명식·오행·흐름은 engine.ts 계산값만, 해설은 explain.ts 규칙 문장만(AI 0 · 가짜 예시 0).
// - 계산이 안 되면 결과를 만들지 않고 이유와 다시 입력만 보인다.
// - 저장 0: 입력·결과·[비슷해요/조금 달라요]는 이 화면에만 있고 서버·나의 이해·매칭으로 가지 않는다.
// - 사주/타로 콘텐츠 화면은 대표가 허락한 어두운 콘텐츠 테마(Content Dark Exception) — 앱 본 화면(파스텔)과 구분한다.

const EL_COLOR: Record<string, string> = { wood: "#7fbf86", fire: "#e0826c", earth: "#d4b574", metal: "#d9d6cc", water: "#7fa6d6" };

function PillarBox({ label, pillar, gods }: { label: string; pillar: Pillar | null; gods: [TenGod | null, TenGod] | null }) {
  if (!pillar) return <div className="saju-pillar is-empty"><p className="saju-cap">{label}</p><div className="saju-pillar-body"><span>모름</span></div><p className="saju-cap">시간 없음</p></div>;
  const se = elementOfStem(pillar.stem), be = elementOfBranch(pillar.branch);
  return <div className="saju-pillar">
    <p className="saju-cap">{label}</p>
    <div className="saju-pillar-body">
      <div className="saju-char" style={{ borderColor: EL_COLOR[se] }}><b>{pillar.hanja[0]}</b><small>{STEMS_KO[pillar.stem]} · {ELEMENT_KO[se]}</small></div>
      <div className="saju-char" style={{ borderColor: EL_COLOR[be] }}><b>{pillar.hanja[1]}</b><small>{BRANCHES_KO[pillar.branch]} · {ELEMENT_KO[be]}</small></div>
    </div>
    <p className="saju-cap">{gods ? `${gods[0] ?? "나"} · ${gods[1]}` : ""}</p>
  </div>;
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

    <section className="saju-card" aria-label="기본 명식">
      <h2 className="saju-h2">기본 명식</h2>
      <div className="saju-pillars">
        <PillarBox label="시주" pillar={f.hour} gods={t.hour} />
        <PillarBox label="일주" pillar={f.day} gods={t.day} />
        <PillarBox label="월주" pillar={f.month} gods={t.month} />
        <PillarBox label="년주" pillar={f.year} gods={t.year} />
      </div>
      <p className="saju-cap">일주의 윗글자({STEMS_KO[r.day_master.stem]})가 나를 뜻해요. 아래 작은 글씨는 나와의 관계(십신)예요.</p>
    </section>

    <section className="saju-card" aria-label="오행">
      <h2 className="saju-h2">오행</h2>
      <div className="saju-elements">{ELEMENT_ORDER.map((k) => <div key={k} className="saju-element"><span className="saju-dot" style={{ background: EL_COLOR[k] }}>{r.five_elements[k]}</span><span>{ELEMENT_KO[k]}</span></div>)}</div>
      <p className="saju-cap">명식 {f.hour ? 8 : 6}글자의 오행 개수예요(점수가 아니에요).</p>
    </section>

    <section className="saju-card" aria-label="현재 흐름">
      <h2 className="saju-h2">지금 흐름</h2>
      {cf.lines.length ? cf.lines.map((l, i) => <p key={i} className="saju-body">{l}</p>) : <p className="saju-body">성별을 고르지 않아 10년 흐름은 계산하지 않았어요.</p>}
    </section>

    <section className="saju-card" aria-label="10년 흐름">
      <h2 className="saju-h2">10년 흐름</h2>
      {r.major_cycles ? <>
        <p className="saju-cap">{r.major_cycles.startAgeText}부터 10년마다 바뀌어요 · {r.major_cycles.direction === "forward" ? "순행" : "역행"}</p>
        <ol className="saju-cycles">{r.major_cycles.cycles.map((c) => <li key={c.order} className={cf.cycle?.order === c.order ? "is-now" : ""}><b>{c.pillar.hanja}</b><span>{c.startAge}세~</span><small>{c.tenGod}</small></li>)}</ol>
      </> : <p className="saju-body">성별을 고르지 않아 계산하지 않았어요. 다시 입력에서 고를 수 있어요.</p>}
    </section>

    <section className="saju-card" aria-label="연도별 흐름">
      <h2 className="saju-h2">연도별 흐름</h2>
      <div className="saju-years" role="group" aria-label="연도 고르기">{r.annual_flow.map((a) => <button key={a.year} type="button" aria-pressed={a.year === picked.year} onClick={() => setPickedYear(a.year)}><b>{a.year}</b><small>{a.pillar.hanja}</small></button>)}</div>
      <p className="saju-body">{picked.year}년 {picked.pillar.hangul}({picked.pillar.hanja})은 나에게 {picked.tenGod} 자리예요. {groupFlow(picked.tenGod)}</p>
      <p className="saju-cap">이 시기를 돌아보는 참고로만 봐 주세요. 정해진 일을 알려 주는 건 아니에요.</p>
    </section>

    <section className="saju-card" aria-label="주제별 해설">
      <h2 className="saju-h2">주제별로 보기</h2>
      {topics(r).map((tp) => <div key={tp.id} className="saju-topic">
        <button type="button" aria-expanded={openTopic === tp.id} onClick={() => setOpenTopic(openTopic === tp.id ? null : tp.id)}>{tp.title}<span aria-hidden="true">{openTopic === tp.id ? "▴" : "▾"}</span></button>
        {openTopic === tp.id && tp.lines.map((l, i) => <p key={i} className="saju-body">{l}</p>)}
      </div>)}
    </section>

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

    <div className="saju-actions">
      <button type="button" className="saju-secondary" onClick={onEdit}>다시 입력할게요</button>
      <button type="button" className="saju-text" onClick={onExit}>여기까지 볼게요</button>
    </div>
  </div></div>;
}
