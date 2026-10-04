import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import KeyIcon from '@/doit/components/feature/KeyIcon';
import { visibleInRelease } from '@/doit/lib/releaseScope';
import {
  GUIDE_CONTACT, GUIDE_OPEN_EVENT, GUIDE_SECTIONS, GUIDE_TITLE, INSTALL_ANDROID, INSTALL_CONTINUE_WEB, INSTALL_IPHONE, INSTALL_STEPS,
  KEY_PENDING_TEXT, KEY_READY_TEXT, currentInstallContext, installNeedsPicker, type GuideSection, type GuideTopic,
} from '@/lib/guide/guideContent';
import './usage-guide.css';

// 이용 안내 오버레이(2026-10-04): 홈페이지(brand)와 앱(app)이 같은 내용·같은 동작을 쓰고 겉모습만 역할별로 다르다.
// 복귀 불변조건:
// - 아래 화면을 지우지 않는 포털 오버레이라 입력 중인 글·스크롤·선택이 그대로 남는다.
// - 열기·닫기·Escape·휴대폰 Back·Tab/Shift+Tab 가둠·닫은 뒤 초점 복귀.
// - 이력 소유권: 안내가 쌓은 기록 한 칸(ugOpen)은 닫기·Escape 로 닫을 때만 history.back() 으로 걷고, Back 으로 닫히면 걷지 않는다.
//   메뉴가 쌓은 칸과는 따로 센다(메뉴 링크가 먼저 자기 칸을 풀고 나서 안내를 연다).
// - 열려 있는 동안 아래 화면은 inert + 움직임 멈춤(html[data-guide-open]), 닫으면 스크롤 위치를 되돌린다.
// 안내는 서버 상태·성공 효과·KEY 값을 만들지 않는다(문장뿐).

interface Props {
  variant: 'brand' | 'app';
  /** 홈페이지: 주 행동(모바일 시작하기) 주소. 앱: 없음 → 「웹으로 계속 이용하기」는 안내를 닫는다 */
  startHref?: string;
  startLabel?: string;
}

const FOCUSABLE = 'a[href],button:not([disabled]),summary,input,select,textarea,[tabindex]:not([tabindex="-1"])';

export default function UsageGuideHost({ variant, startHref, startLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<GuideTopic | undefined>(undefined);
  const opener = useRef<HTMLElement | null>(null);
  const ownsHistory = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ topic?: GuideTopic }>).detail;
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setTopic(detail?.topic);
      setOpen(true);
    };
    window.addEventListener(GUIDE_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(GUIDE_OPEN_EVENT, onOpen);
  }, []);

  const finish = useCallback(() => {
    setOpen(false);
    const target = opener.current;
    requestAnimationFrame(() => { if (target && document.contains(target)) target.focus(); });
  }, []);

  // 닫기·Escape: 내가 쌓은 기록 한 칸이 있으면 걷고(popstate 가 finish), 없으면 바로 닫는다.
  const requestClose = useCallback(() => {
    if (ownsHistory.current && (window.history.state as { ugOpen?: boolean } | null)?.ugOpen) window.history.back();
    else { ownsHistory.current = false; finish(); }
  }, [finish]);

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const scrollY = window.scrollY;
    const prevOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
    html.setAttribute('data-guide-open', '');
    // 아래 화면(포털 밖 형제)을 읽기·초점에서 뺀다. 원래 inert 였던 것은 건드리지 않는다.
    const siblings = Array.from(document.body.children).filter((el) => el !== rootRef.current && !el.hasAttribute('inert'));
    siblings.forEach((el) => el.setAttribute('inert', ''));

    window.history.pushState({ ...((window.history.state ?? {}) as Record<string, unknown>), ugOpen: true }, '');
    ownsHistory.current = true;
    const onPop = () => { ownsHistory.current = false; finish(); };
    window.addEventListener('popstate', onPop);
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); requestClose(); return; }
      if (event.key !== 'Tab' || !rootRef.current) return;
      const items = Array.from(rootRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !rootRef.current.contains(active))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (active === last || !rootRef.current.contains(active))) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey);
      siblings.forEach((el) => el.removeAttribute('inert'));
      html.removeAttribute('data-guide-open');
      html.style.overflow = prevOverflow;
      window.scrollTo(0, scrollY);
      // 이력 칸이 남아 있는 채(안내가 사라질 때)는 걷지 않고 일반 기록으로 바꿔 둔다 — 걷으면 다른 이동을 되돌릴 수 있다.
      if (ownsHistory.current) {
        ownsHistory.current = false;
        const kept: Record<string, unknown> = { ...((window.history.state ?? {}) as Record<string, unknown>) };
        delete kept.ugOpen;
        window.history.replaceState(kept, '');
      }
    };
  }, [open, finish, requestClose]);

  if (!open) return null;
  const keyReady = visibleInRelease('/doit/key');
  return createPortal(
    <div className={`ug-root ug-root--${variant}`} ref={rootRef}>
      <div className="ug-backdrop" onClick={requestClose} aria-hidden="true" />
      <section className="ug-panel" role="dialog" aria-modal="true" aria-labelledby="ug-title">
        <header className="ug-head">
          <h2 id="ug-title">{GUIDE_TITLE}</h2>
          <button ref={closeRef} type="button" className="ug-close" onClick={requestClose}>닫기</button>
        </header>
        <div className="ug-body">
          {GUIDE_SECTIONS.map((section) => (
            <SectionView key={section.id} section={section} open={topic === section.id || (topic === undefined && section.id === 'start')} keyReady={keyReady} />
          ))}
        </div>
        <footer className="ug-foot">
          {startHref
            ? <a className="ug-primary" href={startHref}>{startLabel ?? '모바일 시작하기'}</a>
            : <button type="button" className="ug-primary" onClick={requestClose}>{INSTALL_CONTINUE_WEB}</button>}
          <a className="ug-mail" href={'mailto:' + GUIDE_CONTACT}>문의 · {GUIDE_CONTACT}</a>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function SectionView({ section, open, keyReady }: { section: GuideSection; open: boolean; keyReady: boolean }) {
  return (
    <details className="ug-item" name="ug-accordion" open={open} data-topic={section.id}>
      <summary>{section.kind === 'key' && <KeyIcon size={22} />}<span>{section.title}</span></summary>
      <div className="ug-item-body">
        {section.intro && <p className="ug-intro">{section.intro}</p>}
        {section.points && <ol className="ug-points">{section.points.map((p) => <li key={p}>{p}</li>)}</ol>}
        {section.kind === 'key' && <p className="ug-note" data-state={keyReady ? 'ready' : 'pending'}>{keyReady ? KEY_READY_TEXT : KEY_PENDING_TEXT}</p>}
        {section.kind === 'install' && <InstallBody />}
        {section.note && <p className="ug-note">{section.note}</p>}
      </div>
    </details>
  );
}

// 설치 항목: 기기를 알 수 있으면 그 기기 방법만, 컴퓨터처럼 알 수 없으면 사용자가 iPhone/Android 를 고른다. 스토어 배지·링크 0.
function InstallBody() {
  const [ctx] = useState(currentInstallContext);
  const [pick, setPick] = useState<'ios' | 'android' | null>(null);
  const picker = installNeedsPicker(ctx);
  return (
    <>
      <p className="ug-intro">{INSTALL_STEPS[ctx]}</p>
      {picker && (
        <div className="ug-pick" role="group" aria-label="기기 고르기">
          <button type="button" aria-pressed={pick === 'ios'} onClick={() => setPick('ios')}>iPhone</button>
          <button type="button" aria-pressed={pick === 'android'} onClick={() => setPick('android')}>Android</button>
        </div>
      )}
      {picker && pick && <p className="ug-note" role="status">{pick === 'ios' ? INSTALL_IPHONE : INSTALL_ANDROID}</p>}
      <p className="ug-note">설치하지 않아도 웹으로 계속 이용할 수 있어요. 설치 여부는 이 기기에서 확인할 수 없을 때가 있어요.</p>
    </>
  );
}
