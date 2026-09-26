import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import AutoImport from "unplugin-auto-import/vite";
// import { readdyJsxRuntimeProxyPlugin } from "./vite.jsx-runtime-proxy";

const base = process.env.BASE_PATH || "/";
const isPreview = process.env.IS_PREVIEW ? true : false;
//const proxyPlugins = isPreview ? [readdyJsxRuntimeProxyPlugin()] : [];
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");
  const supabaseUrl = process.env.VITE_PUBLIC_SUPABASE_URL || env.VITE_PUBLIC_SUPABASE_URL;
  const supabasePublicKey = process.env.VITE_PUBLIC_SUPABASE_ANON_KEY || env.VITE_PUBLIC_SUPABASE_ANON_KEY;

  // 드래그 배포 ZIP은 Netlify가 다시 빌드하지 않는다. 필수 공개 설정이 빠진 채
  // 검은 화면이 만들어지는 일을 production build 단계에서 즉시 막는다.
  if (mode === "production" && (!supabaseUrl || !supabasePublicKey)) {
    throw new Error("Production build blocked: VITE_PUBLIC_SUPABASE_URL and VITE_PUBLIC_SUPABASE_ANON_KEY are required.");
  }

  // 사이트 역할(대표 확정 2026-09-21): brand = do-it.company / app = app.do-it.company / 없음 = 통합.
  const siteRole = process.env.VITE_SITE_ROLE || env.VITE_SITE_ROLE || "";
  const appOrigin = (process.env.VITE_APP_ORIGIN || env.VITE_APP_ORIGIN || "https://app.do-it.company").replace(/\/$/, "");
  // 앱 첫 바탕색 = 파스텔 줄기 첫 색(src/doit/components/feature/pastel-bg.css --pastel-underlay 0%). manifest·theme-color 와 같은 값.
  const APP_START_COLOR = "#3fdcb3";
  const siteRolePlugin = {
    name: "doit-site-role",
    // 앱 빌드에만 PWA(홈 화면 설치) 태그를 넣는다. 브랜드 사이트는 설치 대상이 아니다.
    // order: pre — Vite 가 index.html 의 <style> 을 따로 떼어 내기 전에 바꿔야 첫 body 바탕색까지 바뀐다.
    transformIndexHtml: {
      order: "pre" as const,
      handler(html: string) {
        if (siteRole !== "app") return html;
        // 2026-09-25 대표 지정 ECHO 앱 아이콘: 앱 빌드만 파비콘을 바꾼다(브랜드 do-it.company 파비콘은 그대로).
        const favicon = '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />';
        if (!html.includes(favicon)) throw new Error("app favicon link not found in index.html");
        // 2026-09-26 대표 PRE-DEPLOY FIX #1: 앱 주소를 공유하면 회사 홈페이지가 아니라 ECHO 앱으로 보이게(주소·이름·그림 모두 앱 기준).
        // 이름·설명은 새로 짓지 않고 앱 설치 설정(manifest)에 이미 승인돼 있는 값을 그대로 쓴다.
        // FIX #2: 앱의 첫 바탕·상단 막대 색은 검정(#08070c) 대신 파스텔 줄기 첫 색(pastel-bg.css --pastel-underlay 0% = APP_START_COLOR).
        const swap = (from: string, to: string) => {
          if (!html.includes(from)) throw new Error(`app head: not found: ${from.slice(0, 60)}`);
          html = html.replace(from, to);
        };
        const appName = "DO IT · ECHO";
        const appDesc = "당신이 잠든 사이에. 내 말로 시작하는 만남.";
        const appImage = `${appOrigin}/pwa/echo-icon-512.png?v=20260925b`;
        swap('<meta name="theme-color" content="#08070c" />', `<meta name="theme-color" content="${APP_START_COLOR}" />`);
        // 전역 index.css 의 body 바탕(검정)이 뒤에 와서 덮으므로, 앱 첫 화면만 html 표시(echo-app-pastel-root)로 더 세게 잡는다.
        // 표시는 ThemeColorSync 가 파스텔 앱 경로(/doit)에서만 남기고, 히어로(/)·관리자에서는 뗀다 — 전역 body 규칙 자체는 바꾸지 않는다.
        swap('<html lang="ko">', '<html lang="ko" class="echo-app-pastel-root">');
        swap("body { background: #08070c; }", `html.echo-app-pastel-root body { background: ${APP_START_COLOR}; }`);
        swap("<title>DO IT COMPANY | JUST TRY.</title>", `<title>${appName}</title>`);
        swap('<meta name="description" content="사람은 프로필보다, 함께한 행동에서 더 많이 보이니까. DO IT COMPANY · ECHO" />', `<meta name="description" content="${appDesc}" />\n    <link rel="canonical" href="${appOrigin}/" />`);
        swap('<meta property="og:title" content="DO IT COMPANY | JUST TRY." />', `<meta property="og:type" content="website" />\n    <meta property="og:site_name" content="${appName}" />\n    <meta property="og:title" content="${appName}" />`);
        swap('<meta property="og:description" content="사람은 프로필보다, 함께한 행동에서 더 많이 보이니까." />', `<meta property="og:description" content="${appDesc}" />`);
        swap('<meta property="og:image" content="https://do-it.company/brand/doit-earth-original.png" />', `<meta property="og:image" content="${appImage}" />\n    <meta property="og:image:width" content="512" />\n    <meta property="og:image:height" content="512" />\n    <meta name="twitter:card" content="summary" />\n    <meta name="twitter:title" content="${appName}" />\n    <meta name="twitter:description" content="${appDesc}" />\n    <meta name="twitter:image" content="${appImage}" />`);
        swap('<meta property="og:url" content="https://do-it.company/" />', `<meta property="og:url" content="${appOrigin}/" />`);
        return html.replace(favicon, [
          '<link rel="icon" type="image/png" sizes="32x32" href="/pwa/echo-icon-32.png?v=20260925b" />',
          '    <link rel="icon" type="image/png" sizes="16x16" href="/pwa/echo-icon-16.png?v=20260925b" />',
          '    <link rel="icon" type="image/png" sizes="48x48" href="/pwa/echo-icon-48.png?v=20260925b" />',
        ].join("\n")).replace(
          "</head>",
          [
            '    <link rel="manifest" href="/manifest.webmanifest" />',
            '    <link rel="apple-touch-icon" sizes="180x180" href="/pwa/echo-icon-180.png?v=20260925b" />',
            '    <meta name="apple-mobile-web-app-capable" content="yes" />',
            '    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
            '    <meta name="apple-mobile-web-app-title" content="DO IT" />',
            '    <meta name="mobile-web-app-capable" content="yes" />',
            "  </head>",
          ].join("\n"),
        );
      },
    },
    // 브랜드 빌드의 _redirects: 제품 경로는 서버에서 바로 앱 주소로 보낸다(화면 로드 전).
    writeBundle(options: { dir?: string }) {
      if (siteRole !== "brand" || !options.dir) return;
      const rules = [
        "/doit/*", "/login", "/signup", "/auth/*", "/legal/consent", "/start", "/home",
        "/weather", "/weather-check", "/story-start", "/step/*", "/understanding-check", "/white-door",
        "/payment/*", "/payment", "/report", "/locker", "/next-journey", "/admin/*", "/admin",
        "/do-it/fortune", "/do-it/photo", "/do-it/grade",
      ].map((p) => `${p}  ${appOrigin}${p.replace("*", ":splat")}  302`);
      writeFileSync(resolve(options.dir, "_redirects"), [...rules, "/*    /index.html   200", ""].join("\n"));
    },
  };

  return {
  define: {
    __BASE_PATH__: JSON.stringify(base),
    __IS_PREVIEW__: JSON.stringify(isPreview),
    __READDY_PROJECT_ID__: JSON.stringify(process.env.PROJECT_ID || ""),
    __READDY_VERSION_ID__: JSON.stringify(process.env.VERSION_ID || ""),
    __READDY_AI_DOMAIN__: JSON.stringify(process.env.READDY_AI_DOMAIN || ""),
  },
  plugins: [
    // ...proxyPlugins,
    siteRolePlugin,
    react(),
    AutoImport({
      imports: [
        {
          react: [
            ["default", "React"],
            "useState",
            "useEffect",
            "useContext",
            "useReducer",
            "useCallback",
            "useMemo",
            "useRef",
            "useImperativeHandle",
            "useLayoutEffect",
            "useDebugValue",
            "useDeferredValue",
            "useId",
            "useInsertionEffect",
            "useSyncExternalStore",
            "useTransition",
            "startTransition",
            "lazy",
            "memo",
            "forwardRef",
            "createContext",
            "createElement",
            "cloneElement",
            "isValidElement",
          ],
        },
        {
          "react-router-dom": [
            "useNavigate",
            "useLocation",
            "useParams",
            "useSearchParams",
            "Link",
            "NavLink",
            "Navigate",
            "Outlet",
          ],
        },
        // React i18n
        {
          "react-i18next": ["useTranslation", "Trans"],
        },
      ],
      dts: true,
    }),
  ],
  base,
  build: {
    // 운영 드래그 배포물에 프론트 원문 소스맵을 공개하지 않는다.
    sourcemap: false,
    outDir: 'out',
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
  },
  };
});
