import * as THREE from "three";

/**
 * The orb's viscous "oil" pointer disturbance.
 *
 * Ray-casts the cursor onto the orb's sphere to find a contact direction, lags
 * that point (viscosity), and accumulates an `energy` that builds with motion
 * and decays slowly, so the surface keeps flowing briefly then settles.
 *
 * All vectors are **centre-relative**: the orb drifts vertically late in the
 * timeline, and the shader normalises `uCursor` to get a surface direction.
 *
 * A plain factory rather than a hook — it is stepped from `useFrame`, and the
 * React Compiler must not see per-frame mutation of a hook's return value.
 */
export const createOilPointer = (radius: number) => {
  const smooth = new THREE.Vector3(0, 0, radius);
  const prev = new THREE.Vector3(0, 0, radius);
  const velocity = new THREE.Vector3();
  const rawVel = new THREE.Vector3();

  const ndc = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const originToCentre = new THREE.Vector3();
  const target = new THREE.Vector3();
  const radial = new THREE.Vector3();
  const pointer = new THREE.Vector2();

  const state = { energy: 0, idle: 0 };

  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, v));

  return {
    cursor: smooth,
    velocity,
    get energy() {
      return state.energy;
    },

    step(
      camera: THREE.Camera,
      pointerNdc: THREE.Vector2,
      centre: THREE.Vector3,
      enabled: boolean,
      delta: number,
    ) {
      // Frame-rate-independent easing: `base` is the fraction closed per 1/60 s,
      // so the feel is identical whether the scene runs at 60, 45, or 30 fps.
      const ease = (base: number) => 1 - Math.pow(1 - base, delta * 60);

      // The source lerped the raw mouse before projecting; keep that easing.
      pointer.lerp(pointerNdc, ease(0.11));

      target.copy(smooth);
      if (enabled) {
        ndc.set(pointer.x, pointer.y, 0.5).unproject(camera);
        dir.copy(ndc).sub(camera.position).normalize();
        originToCentre.copy(camera.position).sub(centre);

        const b = 2 * dir.dot(originToCentre);
        const c = originToCentre.lengthSq() - radius * radius;
        const disc = b * b - 4 * c;

        if (disc >= 0) {
          // Near hit on the front hemisphere.
          const t = (-b - Math.sqrt(disc)) / 2;
          target.copy(originToCentre).addScaledVector(dir, t);
        } else {
          // Miss: take the closest point on the ray, pushed onto the surface.
          const tc = Math.max(0, -dir.dot(originToCentre));
          target
            .copy(originToCentre)
            .addScaledVector(dir, tc)
            .normalize()
            .multiplyScalar(radius);
        }
      }

      prev.copy(smooth);
      // Viscous lag — more of it now, so the contact point glides and absorbs the
      // discontinuity where the cursor crosses the sphere's silhouette (the
      // ray-hit jumps to the far limb there, which used to snap the bulge).
      smooth.lerp(target, ease(0.1));

      // Tangential smear only — strip the radial component.
      rawVel.subVectors(smooth, prev).multiplyScalar(2.5);
      radial.copy(smooth).normalize();
      rawVel.addScaledVector(radial, -rawVel.dot(radial));
      if (rawVel.length() > 0.6) rawVel.setLength(0.6);
      // Low-pass the drag. The raw per-frame delta jitters in direction and
      // magnitude, and it displaces every point in range, so feeding it straight
      // to the shader made the whole bulge twitch. Easing it lets the smear flow.
      velocity.lerp(rawVel, ease(0.16));

      const speed = smooth.distanceTo(prev);
      // Energy eases toward the motion drive — a soft attack and a slow release —
      // so the surface bulge swells in and settles smoothly instead of snapping
      // to full the instant the cursor moves fast. The gain compensates for the
      // heavier viscosity above, which shortens each frame's contact step.
      const drive = clamp(speed * 8, 0, 1);
      if (drive > state.energy) {
        state.energy += (drive - state.energy) * ease(0.08);
      } else {
        state.energy *= Math.pow(0.97, delta * 60);
      }

      state.idle = speed < 0.0005 ? state.idle + delta : 0;
      if (!enabled || state.idle > 2.5) state.energy *= Math.pow(0.9, delta * 60);
    },
  };
};

export type OilPointer = ReturnType<typeof createOilPointer>;
