import { pageUrl, publicUrl } from "@shared/paths";

import { howCopy as c } from "./content";
import { OnyxStage } from "./onyx-stage";

/**
 * 우리가 만드는 방식 — DOIT COMPANY 홈페이지의 소개 영역(대표 「추가 효과 배치」 §1).
 * 홈페이지 본편(Clarix 2800vh 스크롤)의 첫 후킹·D 심볼·마지막 CTA 와 스크롤 길이는 건드리지 않고,
 * 홈 메뉴에서 들어오는 별도 쪽으로 둔다 — Onyx 엔진도 이 쪽에서만 불러오므로 Clarix 장면과 동시에 돌지 않는다.
 *   PC: 왼쪽 설명 / 오른쪽 효과.   휴대폰: 설명 → 효과 → 서비스 링크.
 */
export const HowView = () => {
  const service = (
    <a className="how-cta" href={pageUrl("echo", { from: "home" })}>
      {c.service} <span aria-hidden="true">{c.serviceArrow}</span>
    </a>
  );
  return (
    <div className="how-page">
      <header className="how-header">
        <a className="how-brand" href={pageUrl("home")}>
          <img src={publicUrl("brand/doit-symbol.png")} alt="" aria-hidden="true" className="how-symbol" />
          {c.brand}
        </a>
        <a className="how-back" href={pageUrl("home")}>
          {c.backHome}
        </a>
      </header>
      <main className="how-main">
        <section className="how-text" aria-labelledby="how-hook">
          <p className="how-label">{c.label}</p>
          <h1 id="how-hook" className="how-hook">
            {c.hook.map((line) => (
              <span key={line} className="how-line">
                {line}
              </span>
            ))}
          </h1>
          <p className="how-desc">
            {c.desc.map((line) => (
              <span key={line} className="how-line">
                {line}
              </span>
            ))}
          </p>
          <div className="how-cta-wide">{service}</div>
        </section>
        <OnyxStage />
        <div className="how-cta-narrow">{service}</div>
      </main>
    </div>
  );
};
