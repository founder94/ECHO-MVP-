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
  const siteRolePlugin = {
    name: "doit-site-role",
    // 앱 빌드에만 PWA(홈 화면 설치) 태그를 넣는다. 브랜드 사이트는 설치 대상이 아니다.
    transformIndexHtml(html: string) {
      if (siteRole !== "app") return html;
      // 2026-09-25 대표 지정 ECHO 앱 아이콘: 앱 빌드만 파비콘을 바꾼다(브랜드 do-it.company 파비콘은 그대로).
      const favicon = '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />';
      if (!html.includes(favicon)) throw new Error("app favicon link not found in index.html");
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
