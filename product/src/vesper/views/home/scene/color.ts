import * as THREE from "three";

/**
 * Convert an sRGB hex string to a **linear** RGB vector.
 *
 * The renderer runs with `outputColorSpace = SRGBColorSpace`, so the final pass
 * encodes linear → sRGB on the way to the screen. Shader colours must therefore
 * be linear. Uploading raw hex bytes (as the source scenes did, on a
 * `WebGL1Renderer` with no output encoding) makes everything get encoded twice:
 * `#170a2b` — a near-black violet — comes out as washed lavender.
 *
 * `THREE.Color` performs the sRGB → linear conversion on construction while
 * `THREE.ColorManagement` is enabled, which it is by default.
 */
export const hexToLinearVec3 = (hex: string): THREE.Vector3 => {
  const color = new THREE.Color(hex);
  return new THREE.Vector3(color.r, color.g, color.b);
};

/**
 * Write an sRGB hex string into an existing linear-RGB vector, in place.
 *
 * The allocation-free counterpart to {@link hexToLinearVec3}, for refreshing a
 * uniform's colour when the live palette changes without churning garbage on the
 * render thread.
 */
export const setLinearVec3 = (target: THREE.Vector3, hex: string): void => {
  const color = new THREE.Color(hex);
  target.set(color.r, color.g, color.b);
};
