import { useMemo, useState } from "react";

import type { ErlPlay } from "@fx/erl/erl-engine";
import { pageUrl, publicUrl } from "@shared/paths";

import { type ConnectionStatus, introAlreadyPlayed, markIntroPlayed, readConnectionState, resetIntroPlayed } from "./connection-state";
import { connectedCopy as c } from "./content";
import { LatticeStage } from "./lattice-stage";

/** 확인되지 않은 상태(완료 문구 없음). mutual_confirmed 는 위 갈래에서 이미 걸러진다. */
const pending = (s: ConnectionStatus): Exclude<ConnectionStatus, "mutual_confirmed"> => (s === "mutual_confirmed" ? "unknown" : s);

/**
 * 첫 대화 진입 — 서로 선택이 서버에서 확인된 뒤, 첫 대화로 들어가는 장면(대표 「추가 효과 배치」 §2).
 *   위: 후킹·설명   가운데: 효과(밝은 수평선)   아래: 「첫 대화 시작하기」 — 세 층을 나눠 겹치지 않는다.
 * 효과를 보기 위한 기다림은 없다: 글과 버튼은 처음부터 보이고 바로 누를 수 있다.
 */
export const ConnectedView = () => {
  const state = useMemo(readConnectionState, []);
  const [notice, setNotice] = useState(false);

  // 재생 방식: 이 연결의 첫 진입만 'live'. 다시 들어오면·움직임 줄이기면 'still'. 처음 그릴 때 한 번 정한다.
  const play = useMemo<ErlPlay>(() => {
    if (state.status !== "mutual_confirmed" || !state.connectionId) return "still";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const first = !introAlreadyPlayed(state.connectionId);
    markIntroPlayed(state.connectionId); // 이번 진입으로 '봤음' — 새로고침·뒤로가기로 다시 와도 반복하지 않는다
    return first && !reduced ? "live" : "still";
  }, [state]);

  const confirmed = state.status === "mutual_confirmed";

  return (
    <div className="cn-page">
      <header className="cn-header">
        <span className="cn-brand">
          {c.brand}
          <span className="cn-operator">
            <img src={publicUrl("brand/doit-symbol.png")} alt="" aria-hidden="true" />
            {c.operator}
          </span>
        </span>
        <a className="cn-back" href={pageUrl("echo", { from: "home" })}>
          {c.back}
        </a>
      </header>

      {state.preview ? (
        <aside className="cn-preview" aria-label={c.preview.badge}>
          <p className="cn-preview-badge">{c.preview.badge}</p>
          <nav className="cn-preview-states" aria-label={c.preview.label}>
            {c.preview.options.map((o) => (
              <a key={o.key} href={`?preview=${o.key}`} aria-current={new URLSearchParams(window.location.search).get("preview") === o.key ? "page" : undefined}>
                {o.label}
              </a>
            ))}
          </nav>
          {confirmed && state.connectionId ? (
            <p className="cn-preview-note">
              {play === "live" ? c.preview.first : c.preview.played}{" "}
              <button
                type="button"
                onClick={() => {
                  if (state.connectionId) resetIntroPlayed(state.connectionId);
                  window.location.reload();
                }}
              >
                {c.preview.reset}
              </button>
            </p>
          ) : null}
        </aside>
      ) : null}

      {confirmed ? (
        <main className="cn-main">
          <section className="cn-top" aria-labelledby="cn-hook">
            <h1 id="cn-hook" className="cn-hook">
              {c.hook.map((l) => (
                <span key={l} className="cn-line">
                  {l}
                </span>
              ))}
            </h1>
            <p className="cn-desc">{c.desc}</p>
          </section>
          <LatticeStage play={play} />
          <section className="cn-bottom">
            <button type="button" className="cn-start" onClick={() => setNotice(true)}>
              {c.start}
            </button>
            {notice ? (
              <p className="cn-notice" role="status">
                {c.notRun}
              </p>
            ) : null}
          </section>
        </main>
      ) : (
        <main className="cn-main cn-main-plain">
          <section className="cn-status" role="status">
            <h1 className="cn-status-title">{c.states[pending(state.status)].title}</h1>
            <p className="cn-desc">{c.states[pending(state.status)].body}</p>
          </section>
        </main>
      )}
    </div>
  );
};
