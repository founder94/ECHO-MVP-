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
/**
 * 정적 미리보기 빌드(`npm run build:preview`): 폴더 주소를 index.html 로 내주지 않는 곳에서도 쪽 사이를 오가도록
 * 각 쪽에 `<meta name="link-mode" content="file">` 를 넣는다(src/shared/paths.ts 가 읽는다).
 */
const previewLinkMode = (): Plugin => ({
  name: "preview-link-mode",
  transformIndexHtml(html) {
    if (process.env.VITE_MODEL_INLINE !== "1") return html;
    return html.replace('<meta name="site-root"', '<meta name="link-mode" content="file" />\n    <meta name="site-root"');
  },
});

export default defineConfig({
  plugins: [threeFloraSelfImports(), previewLinkMode(), react(), tailwindcss()],
  // 개발 서버의 사전 묶음(esbuild)은 위 규칙을 거치지 않으므로 three-flora 는 묶지 않는다.
  optimizeDeps: { exclude: ["three-flora"] },
  resolve: {
    alias: {
      "@clarix": resolve(__dirname, "src/clarix"),
      "@flora": resolve(__dirname, "src/flora"),
      "@shared": resolve(__dirname, "src/shared"),
      // 미리보기 빌드(VITE_MODEL_INLINE=1)가 모델을 스크립트에 담을 때만 쓴다.
      "@public-assets": resolve(__dirname, "public/assets"),
    },
  },
  // 3D 모델(.glb)을 자산으로 인식(미리보기 빌드의 ?inline 가져오기용).
  assetsInclude: ["**/*.glb"],
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
