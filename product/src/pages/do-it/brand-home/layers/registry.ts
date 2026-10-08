// 2026-10-08 대표 「홈페이지는 회사 얼굴 · 전문 제작물(GetLayers Full Stack)로 교체 · 3D·600KB 허용 · 모바일도 같은 계열 · 틀(Vite+React)은 유지 · 온보딩(인트로)은 그대로」
// 갈아끼우는 구조: 화면(섹션)마다 3D 그림층 자리(slot)가 있고, 어떤 장면을 꽂을지는 이 파일 한 곳에서 정한다.
// 고정층(승인 문구·시작 버튼·9장면·제작 영상·설치·법적 고지)은 page.tsx 에 그대로.
// 다른 GetLayers 장면으로 바꾸려면 ① layers/<이름>/ 폴더 ② 아래 loaders 에 한 줄 ③ 자리의 id 값. 끄려면 'none'.
import type { ComponentType, RefObject } from 'react';

export type SceneSlot = 'hero' | 'making';
export type SceneId = 'none' | 'vesper' | 'solaris' | 'lattice';

export interface SceneProps {
  /** 장면이 들어갈 칸(섹션 전체를 덮는 div). 포인터·보임 여부는 이 칸을 기준으로 잰다. */
  host: RefObject<HTMLDivElement | null>;
  slot: SceneSlot;
  /** 구체 자전(대표 결정 대기 · 기본 켬). */
  spin: boolean;
  /** WebGL 맥락 유실·초기화 실패 → 층을 내리고 원래 화면으로. */
  onFail: (reason: string) => void;
}

type Loader = () => Promise<{ default: ComponentType<SceneProps> }>;

/** 자리별 기본 장면 + 꽂을 수 있는 장면 목록(동적 import — page.tsx 는 three.js 를 모른다). */
export const SCENE_LAYERS: Record<SceneSlot, { id: SceneId; loaders: Partial<Record<Exclude<SceneId, 'none'>, Loader>> }> = {
  // 첫 화면: Vesper 입자 구체(기본) · Solaris 태양 구체(대안 · ?scene_hero=solaris 로 미리보기)
  hero: { id: 'vesper', loaders: { vesper: () => import('./vesper/VesperHero'), solaris: () => import('./solaris/SolarisHero') } },
  // 제작 과정: Einstein–Rosen 격자(연결의 다리) — 영상 뒤 배경
  making: { id: 'lattice', loaders: { lattice: () => import('./lattice/LatticeScene') } },
};

export const SCENE_OPTIONS = {
  /** 구체 자전(천천히). 2026-10-05 「화면 회전 0」 잠금은 대표가 10/8 다시 열었다 — 최종 확인은 대표(실기기). */
  spin: true,
  /** 미리보기 전환용 주소 인자(QA 비교용 · 운영에서도 동작하지만 링크를 알아야만): ?scene_hero=solaris · ?scene_making=none */
  previewParam: 'scene_',
} as const;

/** 자리에 꽂힌 장면 id. 주소 인자(?scene_hero=solaris)로 미리보기 전환 — 온보딩(인트로)을 거치며 주소가 바뀌어도 유지되게 이 탭(sessionStorage)에만 기억한다. 목록에 없는 값은 무시. */
export function resolveSceneId(slot: SceneSlot, search?: string): SceneId {
  const base = SCENE_LAYERS[slot];
  const key = SCENE_OPTIONS.previewParam + slot;
  const valid = (v: string | null): v is SceneId => v === 'none' || (!!v && v in base.loaders);
  try {
    const q = search ?? (typeof window !== 'undefined' ? window.location.search : '');
    const fromUrl = new URLSearchParams(q).get(key);
    if (fromUrl !== null) {
      if (fromUrl === '') { window.sessionStorage?.removeItem(key); return base.id; }
      if (valid(fromUrl)) { window.sessionStorage?.setItem(key, fromUrl); return fromUrl; }
    }
    const kept = typeof window !== 'undefined' ? window.sessionStorage?.getItem(key) : null;
    if (valid(kept)) return kept;
  } catch { /* 주소 인자·저장 없음(사생활 모드 등) */ }
  return base.id;
}
