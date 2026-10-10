import * as THREE from "three";

/**
 * Build the brain point cloud from the baked mesh (ADR-0028).
 *
 * The scene used to load a 4.67 MB GLB through `useGLTF`, flatten its scene
 * graph to a world-space triangle soup, sample it, and *then* recenter and scale
 * the result. All of that now happens once, offline, in `scripts/bake-brain.mjs`
 * — 4.5 MB of that GLB was texture images the shader never read, and the flatten
 * + normalise pass was repeated work. What ships is a 43 KB indexed mesh already
 * in the brain's own frame: centred on its surface centroid, scaled to a unit
 * bounding radius.
 *
 * What is left here is the part that genuinely has to run per device: sampling
 * `count` points across that surface, where `count` is the viewport tier's.
 */

/** Decoded triangle mesh — unit radius, centred on its surface centroid. */
export interface BrainMesh {
  positions: Float32Array;
  indices: Uint16Array;
}

/** `'VBRN'`, little-endian. */
const MAGIC = 0x4e524256;
const HEADER_BYTES = 16;
/** Positions are stored as signed 16-bit fractions of the unit radius. */
const QUANT = 32767;

/** Decode the baked container. See `scripts/bake-brain.mjs` for the layout. */
export const decodeBrainMesh = (buffer: ArrayBuffer): BrainMesh => {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== MAGIC) {
    throw new Error("brain mesh: bad magic — not a VBRN container");
  }
  const version = view.getUint32(4, true);
  if (version !== 1) {
    throw new Error(`brain mesh: unsupported version ${version}`);
  }

  const vertexCount = view.getUint32(8, true);
  const indexCount = view.getUint32(12, true);

  const quantised = new Int16Array(buffer, HEADER_BYTES, vertexCount * 3);
  const positions = new Float32Array(vertexCount * 3);
  for (let i = 0; i < positions.length; i++) positions[i] = quantised[i] / QUANT;

  const indexBase = HEADER_BYTES + vertexCount * 3 * 2;
  const indices = new Uint16Array(
    buffer.slice(indexBase, indexBase + indexCount * 2),
  );

  return { positions, indices };
};

/** Fetch and decode the baked mesh. */
export const loadBrainMesh = async (
  url: string,
  signal?: AbortSignal,
): Promise<BrainMesh> => {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`brain mesh: ${response.status} ${response.statusText}`);
  }
  return decodeBrainMesh(await response.arrayBuffer());
};

/**
 * Area-weighted surface sample with per-point geometric normals, scaled to
 * `radius`. The mesh arrives at unit radius, so `radius` stays a live constant
 * (`BRAIN_CONFIG.radius`) instead of being frozen into the asset.
 *
 * Every sample is independent, so this is the same distribution the old GLB path
 * produced — and a lower `count` on a weaker tier is a genuine subsample of the
 * same surface, not a coarser one.
 */
export const buildBrainGeometry = (
  mesh: BrainMesh,
  count: number,
  radius: number,
): THREE.BufferGeometry => {
  const { positions: verts, indices } = mesh;
  const triangleCount = indices.length / 3;

  // Cumulative area, so a uniform draw picks a triangle in proportion to the
  // surface it owns — otherwise dense clusters of tiny triangles get oversampled
  // and the cloud clumps.
  const cdf = new Float32Array(triangleCount);
  let total = 0;
  for (let t = 0; t < triangleCount; t++) {
    const a = indices[t * 3] * 3;
    const b = indices[t * 3 + 1] * 3;
    const c = indices[t * 3 + 2] * 3;
    const ux = verts[b] - verts[a];
    const uy = verts[b + 1] - verts[a + 1];
    const uz = verts[b + 2] - verts[a + 2];
    const vx = verts[c] - verts[a];
    const vy = verts[c + 1] - verts[a + 1];
    const vz = verts[c + 2] - verts[a + 2];
    total +=
      Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) * 0.5;
    cdf[t] = total;
  }
  for (let t = 0; t < triangleCount; t++) cdf[t] /= total;

  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  // The shader reads `aOcclusion`, but the model carries none — the attribute is
  // all zeros and `uOcclusionStrength` is 0 to match. Kept so the material's
  // attribute layout stays intact.
  const occlusion = new Float32Array(count);

  for (let s = 0; s < count; s++) {
    const pick = Math.random();
    let lo = 0;
    let hi = triangleCount - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < pick) lo = mid + 1;
      else hi = mid;
    }

    const a = indices[lo * 3] * 3;
    const b = indices[lo * 3 + 1] * 3;
    const c = indices[lo * 3 + 2] * 3;

    // Uniform barycentric point: fold the far half of the unit square back over
    // the diagonal, so the pair lands inside the triangle rather than the quad.
    let u = Math.random();
    let v = Math.random();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const w = 1 - u - v;

    positions[s * 3] = (w * verts[a] + u * verts[b] + v * verts[c]) * radius;
    positions[s * 3 + 1] =
      (w * verts[a + 1] + u * verts[b + 1] + v * verts[c + 1]) * radius;
    positions[s * 3 + 2] =
      (w * verts[a + 2] + u * verts[b + 2] + v * verts[c + 2]) * radius;

    const e1x = verts[b] - verts[a];
    const e1y = verts[b + 1] - verts[a + 1];
    const e1z = verts[b + 2] - verts[a + 2];
    const e2x = verts[c] - verts[a];
    const e2y = verts[c + 1] - verts[a + 1];
    const e2z = verts[c + 2] - verts[a + 2];
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const length = Math.hypot(nx, ny, nz) || 1;
    normals[s * 3] = nx / length;
    normals[s * 3 + 1] = ny / length;
    normals[s * 3 + 2] = nz / length;

    seeds[s] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aNormal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute("aOcclusion", new THREE.BufferAttribute(occlusion, 1));
  return geometry;
};
