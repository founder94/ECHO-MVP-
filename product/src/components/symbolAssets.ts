// 공식 심볼 그림의 두 가지 판. 형태·질감·그림자는 같고, 파일 크기만 다르다.
//
// 화면에서 심볼은 아무리 커도 220px(온보딩), 보통 40px(머리말·대기 화면)로 쓴다.
// 그런데 모든 자리가 1536×1536 · 180KB 원본을 받아 오고 있었고, 이 그림이 늦게 오면
// 온보딩에서 심볼이 통째로 사라졌다(별·숫자만 남음). 그래서 표시용 작은 판을 따로 둔다.
//
// 공식 원본 파일은 지우지 않고 그대로 남아 있다. 작은 판을 못 읽는 환경에서는 원본으로 되돌아간다.
// 작은 판은 배경을 투명으로 빼 두었다(공식 원본은 '거의 검정' 배경 위에 심볼이 얹힌 그림이다).
export const SYMBOL_DISPLAY_SRC = '/brand/doit-symbol-intro.webp';
export const SYMBOL_ORIGINAL_SRC = '/brand/doit-symbol-original.png';

/** 작은 판을 못 읽었을 때 공식 원본으로 한 번만 되돌린다(끝없이 다시 시도하지 않는다). */
export function fallbackToOriginal(el: HTMLImageElement): void {
  if (el.dataset.symbolFallback === '1') return;
  el.dataset.symbolFallback = '1';
  el.src = SYMBOL_ORIGINAL_SRC;
  // 공식 원본은 검은 배경이 함께 들어 있다. 어두운 화면 위에서 네모가 비치지 않도록 합성 방식을 되돌린다.
  el.style.mixBlendMode = 'screen';
}
