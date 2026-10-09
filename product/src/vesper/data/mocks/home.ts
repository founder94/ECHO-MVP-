/**
 * 홈 화면 문구(원본 Vesper 의 자리 문구를 ECHO 승인 문구로). 컴포넌트는 props 로 받는다.
 */
import { BRAND_HOME_COPY, STORIES } from "@/pages/do-it/brand-home/copy";
import { appUrl } from "@/lib/siteRole";
import { INSTALL_PATH } from "@/pages/do-it/landing/components/BrandSections";

export interface MetricCard { label: string; value: string; detail: string }
export interface MetaRow { label: string; value: string }
export interface SectionCopy { eyebrow: string; title: string[]; body: string[]; tag: string; cards?: MetricCard[]; meta?: MetaRow[] }
export interface BrandCopy { name: string; suffix: string }
export interface StatusCopy { label: string; detail: string; scrollHint: string }
export interface LoaderCopy { brand: string; brandDetail: string; bootLabel: string; bootState: string; initializing: string; loading: string; coordinates: string; version: string }

export const homeBrand: BrandCopy = { name: "DO IT", suffix: "/ ECHO" };

export const homeSections: SectionCopy[] = [
  { eyebrow: "01 — 당신의 하루", title: [...STORIES[0].title], body: [...STORIES[0].body], tag: "ECHO / 시작" },
  { eyebrow: "02 — AI의 이해", title: [...STORIES[1].title], body: [...STORIES[1].body], tag: "기억 / 열림" },
  { eyebrow: "03 — 연결의 시작", title: [...STORIES[2].title], body: [...STORIES[2].body], tag: "연결 / 준비" },
];

export const homeStatus: StatusCopy = { label: "ECHO · ONLINE SERENDIPITY", detail: "· JUST TRY.", scrollHint: "내려서 이어 보기" };

export interface OutroCopy { eyebrow: string; title: string; body: string[]; points: { label: string; value: string }[]; cta: { label: string; href: string } }
export interface FaqCopy { eyebrow: string; title: string; items: { question: string; answer: string }[] }
export interface FooterCopy { wordmark: string; tagline: string; columns: { heading: string; links: { label: string; href: string }[] }[]; legal?: string }

export const homeOutro: OutroCopy = {
  eyebrow: "04 — 메아리의 답",
  title: STORIES[3].title.join(" "),
  body: [...STORIES[3].body],
  points: [],
  cta: { label: BRAND_HOME_COPY.start, href: "/" },
};

export const homeFooter: FooterCopy = {
  wordmark: "DO IT",
  tagline: `${BRAND_HOME_COPY.heroTitle.join(" ")} ${BRAND_HOME_COPY.heroLine[0]}`,
  columns: [
    // 2026-10-09 대표: 설치 카드·이야기 카드·제작 영상 삭제 → 설치는 앱 주소로(이용 안내 설치 항목과 같은 곳).
    { heading: "ECHO", links: [
      { label: "감정의 이유", href: "/#solaris" },
      { label: BRAND_HOME_COPY.install, href: appUrl(INSTALL_PATH) },
    ] },
    { heading: "회사", links: [
      { label: "이용약관", href: "/legal/terms" },
      { label: "개인정보처리방침", href: "/legal/privacy" },
      { label: "문의", href: "mailto:0423doit@gmail.com" },
    ] },
  ],
};

export const homeLoader: LoaderCopy = {
  brand: "DO IT",
  brandDetail: "ECHO / ONLINE SERENDIPITY",
  bootLabel: "시작 준비",
  bootState: "● 준비",
  initializing: "ECHO 를 깨우는 중",
  loading: "장면 불러오는 중",
  coordinates: "37.6°N / 127.2°E",
  version: "2026 — DO IT COMPANY",
};
