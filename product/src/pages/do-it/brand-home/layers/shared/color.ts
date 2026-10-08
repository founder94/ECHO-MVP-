// sRGB hex → 선형 RGB 벡터(원본 scene/color.ts). 렌더러가 sRGB 로 내보내므로 셰이더 색은 선형이어야 두 번 밝아지지 않는다.
import * as THREE from 'three';

export const hexToLinearVec3 = (hex: string): THREE.Vector3 => {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
};
