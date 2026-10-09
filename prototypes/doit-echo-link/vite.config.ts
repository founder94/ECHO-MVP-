import { resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * Flora 엔진은 three 0.186(별칭 three-flora), Clarix 엔진은 three 0.184(three). three-flora 안의 예제 모듈
 * (EffectComposer·UnrealBloomPass 등)은 `import … from "three"` 로 쓰여 있어, 그대로 두면 Flora 의
 * 후처리가 Clarix 의 0.184 를 끌어와 두 버전 객체가 섞인다. three-flora 폴더 안에서 부르는 "three"·"three/…" 는
 * three-flora 로 돌린다(두 엔진을 독립 모듈로 유지 · 대표 지시 §8).
 */
const threeFloraSelfImports = (): Plugin => ({
  name: "three-flora-self-imports",
  enforce: "pre",
  async resolveId(source, importer, options) {
    if (!importer || !/[\\/]node_modules[\\/]three-flora[\\/]/.test(importer)) return null;
    if (source !== "three" && !source.startsWith("three/")) return null;
    return this.resolve(source.replace(/^three/, "three-flora"), importer, { ...options, skipSelf: true });
  },
});

/**
 * 세 쪽짜리 연결 시안(MPA).
 *   /            DOIT COMPANY 홈페이지 — Clarix 엔진(three 0.184.0 · lenis 1.3.23)
 *   /echo/       ECHO 도입 — Flora 엔진(three 0.186.0 · lenis 1.3.26, 별칭 three-flora · lenis-flora)
 *   /echo/story/ 이야기 쓰기 → 확인·수정 → 다음 단계 안내(로컬 체험)
 * 쪽마다 따로 불러오므로 두 디자인의 CSS·글꼴·WebGL 이 서로 섞이지 않고, 쪽을 떠나면 브라우저가 자원을 정리한다.
 */
export default defineConfig({
  plugins: [threeFloraSelfImports(), react(), tailwindcss()],
  // 개발 서버의 사전 묶음(esbuild)은 위 규칙을 거치지 않으므로 three-flora 는 묶지 않는다.
  optimizeDeps: { exclude: ["three-flora"] },
  resolve: {
    alias: {
      "@clarix": resolve(__dirname, "src/clarix"),
      "@flora": resolve(__dirname, "src/flora"),
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      input: {
        home: resolve(__dirname, "index.html"),
        echo: resolve(__dirname, "echo/index.html"),
        story: resolve(__dirname, "echo/story/index.html"),
      },
    },
  },
});
