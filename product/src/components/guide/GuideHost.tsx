import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { GUIDE_CONTACT, GUIDE_LEAD, GUIDE_SECTIONS, GUIDE_TITLE, type GuideSectionId } from '@/lib/guide/content';
import { GUIDE_OPEN_EVENT } from '@/lib/guide/bus';
import KeyIcon from '@/doit/components/feature/KeyIcon';
import './guide.css';

// 이용 안내 창(2026-10-04 대표 「이용 안내 통합」). 화면에 하나만 두고 openGuide() 로 연다.
// - 넓은 화면: 오른쪽에서 열리는 패널 · 휴대폰: 아래에서 올라오는 긴 설명창(항목별로 펼쳐 읽기).
// - 화면을 옮기지 않는다: 닫으면 적던 글·스크롤 위치·고른 것이 그대로다.
// - 폰 「뒤로」는 이 창만 닫는다(앱을 나가거나 입력을 지우지 않음) · Esc 로 닫기 · 열려 있는 동안 키보드 초점은 창 안에서만.
// - 읽는 동안 뒤 화면의 움직임(배경·전류·카드)은 멈춘다. 움직임 줄이기면 창도 그냥 나타난다.
// - theme: brand = 홈페이지(검정·흰색·은색) · app = 모바일(민트·청록·노랑·코랄 위 유리).
type Props = { theme: 'brand' | 'app'; extra?: Partial<Record<GuideSectionId, ReactNode>> };
type OpenState = { seq: number; section: GuideSectionId | null };

export default function GuideHost({ theme, extra }: Props) {
  const [state, setState] = useState<OpenState | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const pushedRef = useRef(false);
  const seqRef = useRef(0);

  const finish = useCallback(() => {
    setState(null);
    const opener = openerRef.current; openerRef.current = null;
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  }, []);

  // 닫기 버튼·Esc: 열 때 쌓은 기록 한 칸을 되돌리면(popstate) 그때 닫는다 → 「뒤로」와 같은 길.
  const close = useCallback(() => {
    if (pushedRef.current) { pushedRef.current = false; window.history.back(); }
    finish();
  }, [finish]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ section: GuideSectionId | null; opener?: HTMLElement | null }>).detail;
      const section = detail?.section ?? null;
      if (!openerRef.current) openerRef.current = detail?.opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      seqRef.current += 1;
      setState({ seq: seqRef.current, section });
      if (!pushedRef.current) {
        try { window.history.pushState({ ...(window.history.state ?? {}), echoGuide: true }, ''); pushedRef.current = true; } catch { pushedRef.current = false; }
      }
    };
    const onPop = () => { if (pushedRef.current) { pushedRef.current = false; finish(); } };
    window.addEventListener(GUIDE_OPEN_EVENT, onOpen);
    window.addEventListener('popstate', onPop);
    return () => { window.removeEventListener(GUIDE_OPEN_EVENT, onOpen); window.removeEventListener('popstate', onPop); };
  }, [finish]);

  const open = state !== null;
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.classList.add('echo-guide-open');
    const target = state?.section ? document.getElementById(`echo-guide-${state.section}`) : null;
    if (target) target.scrollIntoView({ block: 'start' }); else panelRef.current?.scrollTo?.({ top: 0 });
    panelRef.current?.querySelector<HTMLElement>('.echo-guide-close')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>('button, summary, a[href]')].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); root.classList.remove('echo-guide-open'); };
  }, [open, state?.seq, state?.section, close]);

  if (!state) return null;
  return createPortal(
    <div className="echo-guide" data-theme={theme}>
      <button type="button" className="echo-guide-scrim" aria-label="이용 안내 닫기" tabIndex={-1} onClick={close} />
      <div ref={panelRef} className="echo-guide-panel" role="dialog" aria-modal="true" aria-labelledby="echo-guide-title">
        <div className="echo-guide-head">
          <h2 id="echo-guide-title">{GUIDE_TITLE}</h2>
          <button type="button" className="echo-guide-close" aria-label="이용 안내 닫기" onClick={close}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>
        <p className="echo-guide-lead">{GUIDE_LEAD}</p>
        <div className="echo-guide-list" key={state.seq}>
          {GUIDE_SECTIONS.map((s) => (
            <details key={s.id} id={`echo-guide-${s.id}`} className="echo-guide-item" open={state.section === s.id || undefined}>
              <summary>
                {/* 열쇠 그림: 모바일(app)만 유리 열쇠 그림 · 홈페이지(brand)는 예전 아이콘 그대로(검정·은색 화면에 모바일 그림 0) */}
                {/* 2026-10-10 대표 「모바일웹 = Flora · 파스텔 그림 지움」: 앱도 유리 열쇠 그림 대신 열쇠 아이콘 */}
                {s.id === 'key' && <KeyIcon size={22} />}
                <span>{s.label}</span>
                {s.soon && <span className="echo-guide-soon">준비 중</span>}
              </summary>
              <div className="echo-guide-body">
                <h3>{s.title}</h3>
                <p>{s.body}</p>
                {s.points && (s.id === 'start'
                  ? <ol>{s.points.map((p) => <li key={p}>{p}</li>)}</ol>
                  : <ul>{s.points.map((p) => <li key={p}>{p.includes(GUIDE_CONTACT) ? <a href={`mailto:${GUIDE_CONTACT}`}>{p}</a> : p}</li>)}</ul>)}
                {extra?.[s.id]}
              </div>
            </details>
          ))}
        </div>
        <button type="button" className="echo-guide-done" onClick={close}>닫고 이어서 하기</button>
      </div>
    </div>,
    document.body,
  );
}
