/**
 * 쪽 사이 주소와 공개 파일 주소.
 *
 * 이 시안은 세 쪽(/, /echo/, /echo/story/)으로 나뉜 정적 사이트다. 쪽마다 <meta name="site-root">에
 * 사이트 맨 위까지의 상대 경로(".", "..", "../..")를 적어 두고, 모든 주소를 그 기준으로 만든다.
 * 그래서 실제 경로(https://…/echo/)로 올려도, 파일 이름이 그대로 보이는 미리보기(…/echo/index.html)로
 * 열어도 같은 코드로 이동한다.
 */
export type PageId = "home" | "echo" | "story";

const PAGE_DIR: Record<PageId, string> = { home: "", echo: "echo/", story: "echo/story/" };

const siteRoot = (): string => {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="site-root"]');
  const root = meta?.content?.trim() || ".";
  return new URL(`${root}/`, window.location.href).href;
};

/** 주소창에 `index.html`이 보이는 미리보기(정적 파일 호스팅)에서는 쪽 주소에도 붙인다. */
const fileMode = (): boolean => window.location.pathname.endsWith(".html");

/** 공개 폴더(public/)의 파일 — 예: publicUrl("assets/model.glb"). */
export const publicUrl = (path: string): string => new URL(path.replace(/^\//, ""), siteRoot()).href;

/** 다른 쪽의 주소. `query`는 쪽을 열 때 함께 넘길 표시(예: from=home). */
export const pageUrl = (page: PageId, query?: Record<string, string>): string => {
  const url = new URL(PAGE_DIR[page] + (fileMode() ? "index.html" : ""), siteRoot());
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return url.href;
};
