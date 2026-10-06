import type { CSSProperties } from 'react';

// 기존 인트로 100% 심볼의 밝은 11칸. 새 로고 대신 같은 형태에 깊이만 더한다.
const PIXELS = [[0, 3], [0, 4], [1, 1], [1, 4], [2, 1], [2, 4], [3, 0], [3, 1], [3, 3], [3, 4], [4, 1]];

export default function BrandDepthSymbol() {
  return (
    <div className="doit-depth-symbol" aria-hidden="true">
      <div className="doit-depth-symbol__light" />
      <div className="doit-depth-symbol__float">
        <div className="doit-depth-symbol__mark">
          {PIXELS.map(([row, column]) => (
            <span className="doit-depth-pixel" key={`${row}-${column}`} style={{ '--row': row, '--column': column } as CSSProperties}>
              <i className="doit-depth-pixel__front" />
              <i className="doit-depth-pixel__back" />
              <i className="doit-depth-pixel__right" />
              <i className="doit-depth-pixel__left" />
              <i className="doit-depth-pixel__top" />
              <i className="doit-depth-pixel__bottom" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
