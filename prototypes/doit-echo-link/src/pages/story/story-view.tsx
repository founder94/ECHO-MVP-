import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { echoAppUrl } from "@shared/echo-app";
import { pageUrl, publicUrl } from "@shared/paths";
import { clearDraft, loadDraft, saveDraft, splitSentences } from "@shared/story-draft";

import { storyCopy as c } from "./content";

/**
 * 이야기 쓰기 — ECHO 서비스의 실제 첫 단계(로컬 체험).
 *
 *   write  내 이야기 쓰기(입력이 화면의 주인공 · 키보드가 떠도 버튼이 보임 · 이 기기에만 임시 저장)
 *   check  내가 쓴 내용 확인 · 문장별로 고치거나 빼기(원문은 그대로 보관) · AI 해석은 연결 안 됨이라고 표시
 *   next   다음 단계 안내: 추천 → 내 선택 → 상대의 선택 → 서로 선택했을 때 연결(시안에서는 실행 안 됨)
 *
 * 단계는 주소의 ?step= 으로 남겨, 휴대폰 뒤로가기가 check → write → ECHO 도입 → 홈페이지 순서로 돈다.
 * 서버·AI 호출 0, 외부 전송 0.
 */

type Step = "write" | "check" | "next";
const STEPS: Step[] = ["write", "check", "next"];

const readStep = (): Step => {
  const s = new URLSearchParams(window.location.search).get("step");
  return STEPS.includes(s as Step) ? (s as Step) : "write";
};

/** 휴대폰 키보드가 올라온 높이 — 아래 고정 버튼 줄을 그만큼 올린다(visualViewport). */
const useKeyboardInset = () => {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty("--kb", `${Math.round(inset)}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.documentElement.style.removeProperty("--kb");
    };
  }, []);
};

const Header = ({ step }: { step: Step }) => (
  <header className="story-header">
    <a className="story-back" href={step === "write" ? pageUrl("echo", { from: "home" }) : "#"} onClick={(e) => {
      if (step === "write") return;
      e.preventDefault();
      history.back();
    }}>
      <span aria-hidden="true">←</span> {step === "write" ? c.backToIntro : c.back}
    </a>
    <span className="story-brand">
      <span className="story-wordmark">ECHO</span>
      <span className="story-operator">
        <img src={publicUrl("brand/doit-symbol.png")} alt="" aria-hidden="true" />
        by DOIT COMPANY
      </span>
    </span>
  </header>
);

const Progress = ({ step }: { step: Step }) => (
  <ol className="story-progress" aria-label={c.progressLabel}>
    {c.steps.map((s, i) => {
      const at = STEPS.indexOf(step);
      const state = i < at ? "done" : i === at ? "now" : "later";
      return (
        <li key={s} data-state={state} aria-current={state === "now" ? "step" : undefined}>
          <span className="story-progress-dot" aria-hidden="true" />
          {s}
        </li>
      );
    })}
  </ol>
);

const LocalNotice = () => <p className="story-notice">{c.localNotice}</p>;

export const StoryView = () => {
  const [step, setStep] = useState<Step>(readStep);
  const initial = useMemo(loadDraft, []);
  const [text, setText] = useState(initial?.text ?? "");
  const [lines, setLines] = useState<string[] | null>(initial?.lines ?? null);
  // 문장 수정이 어느 원문에서 나왔는지 — 원문이 바뀌면 수정 목록을 새 원문 기준으로 다시 만든다.
  const [linesFor, setLinesFor] = useState(initial?.lines ? initial.text : "");
  const [editing, setEditing] = useState<number | null>(null);
  const [saved, setSaved] = useState(Boolean(initial?.text));
  const fieldId = useId();
  const area = useRef<HTMLTextAreaElement>(null);
  useKeyboardInset();

  // 주소의 단계와 화면을 맞춘다(뒤로가기·앞으로가기).
  useEffect(() => {
    const onPop = () => setStep(readStep());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // 쓰는 동안 계속 임시 저장(잠깐 멈춘 뒤 한 번).
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (text.trim()) {
        saveDraft({ text, lines: lines ?? undefined });
        setSaved(true);
      } else {
        // 글을 모두 지우면 저장된 임시 글도 지운다 — 다시 열었을 때 지운 글이 되살아나지 않게(Codex 검수 P2).
        // (입력할 때마다 saved 는 false 가 되므로 그 값으로 가르지 않는다.)
        clearDraft();
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [text, lines]);

  // 실제 ECHO 로 가져가려면 사용자가 직접 복사해 붙여 넣는다(자동 전송 0 · 2026-10-10).
  const [copyState, setCopyState] = useState<"ok" | "fail" | null>(null);
  const copyText = useCallback(() => {
    const body = (lines && lines.length ? lines.join(" ") : text).trim();
    if (!navigator.clipboard) { setCopyState("fail"); return; }
    navigator.clipboard.writeText(body).then(() => setCopyState("ok"), () => setCopyState("fail"));
  }, [lines, text]);

  // 단계가 바뀌면 맨 위로 — 새 화면의 제목부터 읽히도록.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const go = useCallback((next: Step) => {
    const url = new URL(window.location.href);
    if (next === "write") url.searchParams.delete("step");
    else url.searchParams.set("step", next);
    history.pushState({ step: next }, "", url);
    setStep(next);
  }, []);

  const sentences = useMemo(() => lines ?? splitSentences(text), [lines, text]);

  const toCheck = () => {
    if (!text.trim()) {
      area.current?.focus();
      return;
    }
    // 원문이 바뀌었으면 문장 목록을 원문 기준으로 다시 만든다(예전 수정은 원문이 같을 때만 유지).
    const keep = lines !== null && linesFor === text;
    if (!keep) setLines(null);
    saveDraft({ text, lines: keep ? (lines ?? undefined) : undefined });
    go("check");
  };

  const editLine = (i: number, value: string) => {
    setLinesFor(text);
    setLines((prev) => {
      const base = prev ?? splitSentences(text);
      return base.map((l, j) => (j === i ? value : l));
    });
  };
  const dropLine = (i: number) => {
    setLinesFor(text);
    setLines((prev) => (prev ?? splitSentences(text)).filter((_, j) => j !== i));
  };

  const wipe = () => {
    clearDraft();
    setText("");
    setLines(null);
    setLinesFor("");
    setSaved(false);
    area.current?.focus();
  };

  return (
    <div className="story-shell">
      <Header step={step} />
      <Progress step={step} />

      {step === "write" && (
        <main className="story-main">
          <h1 className="story-title">{c.write.title}</h1>
          <p className="story-lead">{c.write.lead}</p>
          <label htmlFor={fieldId} className="story-label">
            {c.write.label}
          </label>
          <textarea
            id={fieldId}
            ref={area}
            className="story-field"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSaved(false);
            }}
            placeholder={c.write.placeholder}
            rows={8}
            maxLength={4000}
            enterKeyHint="enter"
            autoComplete="off"
          />
          <p className="story-hint">{c.write.unsure}</p>
          <div className="story-meta">
            <span aria-live="polite">{text.trim() ? (saved ? c.write.saved : c.write.saving) : c.write.empty}</span>
            {text ? (
              <button type="button" className="story-text-button" onClick={wipe}>
                {c.write.clear}
              </button>
            ) : null}
          </div>
          <LocalNotice />
          <div className="story-actions">
            <button type="button" className="story-primary" onClick={toCheck} aria-disabled={!text.trim()}>
              {c.write.next}
            </button>
          </div>
        </main>
      )}

      {step === "check" && (
        <main className="story-main">
          <h1 className="story-title">{c.check.title}</h1>
          <p className="story-lead">{c.check.lead}</p>

          <section className="story-card" aria-labelledby="mine">
            <h2 id="mine" className="story-card-title">
              {c.check.mineTitle}
            </h2>
            <p className="story-card-note">{c.check.mineNote}</p>
            <ol className="story-lines">
              {sentences.map((line, i) => (
                <li key={`${i}-${line.slice(0, 8)}`} className="story-line">
                  {editing === i ? (
                    <textarea
                      className="story-line-field"
                      value={line}
                      autoFocus
                      rows={2}
                      onChange={(e) => editLine(i, e.target.value)}
                      onBlur={() => setEditing(null)}
                      aria-label={`${i + 1}${c.check.lineEditLabel}`}
                    />
                  ) : (
                    <p className="story-line-text">{line}</p>
                  )}
                  <div className="story-line-actions">
                    <button type="button" className="story-chip" onClick={() => setEditing(editing === i ? null : i)}>
                      {editing === i ? c.check.done : c.check.edit}
                    </button>
                    <button type="button" className="story-chip story-chip-quiet" onClick={() => dropLine(i)}>
                      {c.check.drop}
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            {sentences.length === 0 ? <p className="story-card-note">{c.check.allDropped}</p> : null}
          </section>

          <section className="story-card story-card-pending" aria-labelledby="ai">
            <h2 id="ai" className="story-card-title">
              {c.check.aiTitle}
            </h2>
            <p className="story-pending-badge">{c.notRun}</p>
            <p className="story-card-note">{c.check.aiNote}</p>
          </section>

          <LocalNotice />
          <div className="story-actions story-actions-split">
            <button type="button" className="story-secondary" onClick={() => go("write")}>
              {c.check.rewrite}
            </button>
            <button type="button" className="story-primary" onClick={() => go("next")}>
              {c.check.confirm}
            </button>
          </div>
        </main>
      )}

      {step === "next" && (
        <main className="story-main">
          <h1 className="story-title">{c.next.title}</h1>
          <p className="story-lead">{c.next.lead}</p>
          <ol className="story-flow">
            {c.next.flow.map((f, i) => (
              <li key={f.name} className="story-flow-item">
                <span className="story-flow-index">{String(i + 1).padStart(2, "0")}</span>
                <div className="story-flow-body">
                  <p className="story-flow-name">{f.name}</p>
                  <p className="story-flow-desc">{f.desc}</p>
                </div>
                <span className="story-pending-badge">{c.inApp}</span>
              </li>
            ))}
          </ol>
          <p className="story-card-note">{c.next.rule}</p>
          {/* 서로 선택이 확인된 뒤의 첫 대화 진입 장면 — 시안 미리보기(서버 연결 없음, 실제 연결 아님). */}
          <a className="story-text-button" href={pageUrl("connected", { preview: "mutual" })}>
            {c.next.connectedPreview}
          </a>
          <LocalNotice />
          <p className="story-card-note" style={{ whiteSpace: "pre-line" }}>{c.next.handoffNote}</p>
          {copyState ? <p className="story-hint" role="status">{copyState === "ok" ? c.next.copied : c.next.copyFailed}</p> : null}
          <div className="story-actions story-actions-stack">
            <a className="story-primary" href={echoAppUrl("/doit/start-journey")}>
              {c.next.toApp}
            </a>
            {text.trim() ? (
              <button type="button" className="story-secondary" onClick={copyText}>
                {c.next.copy}
              </button>
            ) : null}
            <button type="button" className="story-secondary" onClick={() => go("write")}>
              {c.next.edit}
            </button>
            <a className="story-secondary" href={pageUrl("echo", { from: "home" })}>
              {c.next.toIntro}
            </a>
            <a className="story-secondary" href={pageUrl("home")}>
              {c.next.toHome}
            </a>
          </div>
        </main>
      )}
    </div>
  );
};
