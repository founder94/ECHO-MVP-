/**
 * @fileoverview Configuration file for Spring animation components
 *
 * Global configuration for all Spring components.
 * Controls behavior and features across the entire application.
 *
 * disableOnMobile: Controls which spring animations are disabled on mobile devices
 * - hover: Disable hover animations on mobile (default: true since no hover on mobile)
 * - inview: Disable in-view animations on mobile
 * - spring: Disable basic spring animations on mobile
 * - springtrigger: Disable scroll-triggered animations on mobile
 */
import type { SpringConfig } from "@react-spring/web";

interface SpringsConfig {
  mobileWidth: number;
  disableOnMobile: {
    hover: boolean;
    inview: boolean;
    spring: boolean;
    springtrigger: boolean;
  };
}

/**
 * The house spring for UI chrome — menus, toggles, accordions.
 *
 * Quick enough to feel like a response rather than an animation, and damped hard
 * enough not to ring. Use it wherever a component would otherwise reach for a CSS
 * transition (which this project does not have).
 */
export const SPRING_SOFT: SpringConfig = { tension: 280, friction: 34 };

/**
 * The mobile menu's curtain and its links — slower than chrome, because it
 * covers the whole screen and should read as a move, not a cut. Critically
 * damped: nothing overshoots the edge of the screen.
 */
export const SPRING_CURTAIN: SpringConfig = { tension: 70, friction: 17 };

/** The menu's links rising into place behind the curtain — quicker than it. */
export const SPRING_MENU_ITEM: SpringConfig = { tension: 190, friction: 26 };

/** The same curtain closing — the exit is the entrance reversed, and quicker. */
export const SPRING_CURTAIN_EXIT: SpringConfig = { tension: 340, friction: 37 };

export const springsConfig: SpringsConfig = {
  mobileWidth: 768,
  disableOnMobile: {
    hover: true,
    inview: false,
    spring: false,
    springtrigger: false,
  },
} as const;

/**
 * @param value - whether the animation opts into mobile-disabling
 * @param viewportWidth - optional explicit width (px); pass a React-tracked
 *   value here so callers re-evaluate on resize. Falls back to `window.innerWidth`.
 */
export const isMobileDisabled = (value: boolean, viewportWidth?: number) => {
  if (typeof window === "undefined") return false;
  if (!value) return false;
  const width =
    viewportWidth && viewportWidth > 0 ? viewportWidth : window.innerWidth;
  return width <= springsConfig.mobileWidth;
};
