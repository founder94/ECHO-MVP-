// 2026-10-10 기기 호환: 휴대폰 글자판(키보드)과 입력칸.

// 입력줄 자동 높이. CSS field-sizing:content 를 아는 브라우저(최신 Chrome·Samsung Internet)는 CSS 가 맡고,
// 모르는 브라우저(iOS Safari·옛 Samsung Internet)만 글 높이에 맞춰 늘린다(최대 max px — CSS max-height 와 같은 값).
let fieldSizing: boolean | null = null;
export function supportsFieldSizing(): boolean {
  if (fieldSizing === null) {
    try { fieldSizing = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('field-sizing', 'content'); } catch { fieldSizing = false; }
  }
  return fieldSizing;
}
export function fitTextarea(el: HTMLTextAreaElement | null, max = 140): void {
  if (!el || supportsFieldSizing()) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, max)}px`;
}

// 입력칸을 누르면 화면 가운데로 올리고, 글자판이 다 뜬 뒤(visualViewport resize) 한 번 더 올린다.
// 글자판이 뜨지 않으면(외장 키보드·이미 떠 있음) 듣기는 1초 뒤·초점이 빠질 때 저절로 지워진다 — 늦게 불려 다른 칸이나 사라진 칸을 움직이지 않게.
export function keepInputVisible(el: HTMLElement): void {
  el.scrollIntoView({ block: 'center' });
  const viewport = typeof window !== 'undefined' ? window.visualViewport : null;
  if (!viewport) return;
  let timer = 0;
  const done = () => {
    viewport.removeEventListener('resize', onResize);
    el.removeEventListener('blur', done);
    window.clearTimeout(timer);
  };
  const onResize = () => {
    done();
    if (el.isConnected && document.activeElement === el) el.scrollIntoView({ block: 'center' });
  };
  viewport.addEventListener('resize', onResize);
  el.addEventListener('blur', done);
  timer = window.setTimeout(done, 1000);
}
