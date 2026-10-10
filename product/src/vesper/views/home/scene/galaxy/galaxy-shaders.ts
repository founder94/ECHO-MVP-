/**
 * Spiral galaxy shaders.
 *
 * Two arms plus a 3D core bulge, both derived from per-vertex hashes of the
 * source sphere's positions — the geometry is only a seed lattice, never drawn
 * as a sphere. Arms rotate with time.
 *
 * Additions over the source scene, so it can hand off to the orb:
 * - `uBlow` pushes every point along a per-point random direction, reproducing
 *   the original universe's dispersal.
 * - `uAppear` / `uFade` replace the source's time-based intro ramp, so the
 *   galaxy assembles and disperses on the scroll clock instead of on mount.
 */
export const galaxyVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uArmSpin;
  uniform float uScale;
  uniform float uBlow;
  uniform float uAssemble;
  uniform vec3  uColEdge;
  uniform vec3  uColCore;
  uniform vec3  uCursor;
  uniform float uRepelRadius;
  uniform float uRepelStrength;
  uniform float uActivity;

  varying float vFade;
  varying vec3  vColor;

  void main() {
    float gRnd1 = fract(sin(dot(position.xyz, vec3(12.989, 78.233, 45.164))) * 43758.545);
    float gRnd2 = fract(sin(dot(position.xyz, vec3(93.989, 67.345, 54.256))) * 24634.634);
    float gRnd3 = fract(sin(dot(position.xyz, vec3(43.332, 11.235, 89.234))) * 56475.234);
    float gRnd4 = fract(sin(dot(position.xyz, vec3(75.321, 32.123, 23.456))) * 35432.123);

    float galaxyR = pow(gRnd1, 2.0) * 60.0 + pow(gRnd2, 3.0) * 30.0;
    float swirl = pow(galaxyR, 1.1) * 0.08;
    float armIndex = floor(gRnd2 * 2.0);
    float baseAngle = armIndex * 3.14159265;
    float uniformTheta = gRnd3 * 2.0 - 1.0;
    float dTheta = pow(uniformTheta, 5.0) * 3.14159;
    float theta = baseAngle + swirl + dTheta + uTime * uArmSpin;

    float gx = galaxyR * cos(theta);
    float gz = galaxyR * sin(theta);
    float gyDisc = pow(gRnd4 * 2.0 - 1.0, 3.0) * 1.5;
    vec3 basePos = vec3(gx, gyDisc, gz);

    float bulgeStrength = smoothstep(25.0, 0.0, galaxyR);
    float gRnd5 = fract(sin(gRnd1 * 44.44 + gRnd2) * 555.55);
    float gRnd6 = fract(sin(gRnd3 * 66.66 + gRnd4) * 777.77);
    float gRnd7 = fract(sin(gRnd5 * 88.88 + gRnd6) * 999.99);
    float phi = acos(gRnd5 * 2.0 - 1.0);
    float thetaS = gRnd6 * 6.2831853 + uTime * (uArmSpin * 2.0);
    float rS = pow(gRnd7, 2.0) * 18.0;
    vec3 bulge = vec3(rS * sin(phi) * cos(thetaS), rS * cos(phi), rS * sin(phi) * sin(thetaS));

    vec3 galaxyPos = mix(basePos, bulge, bulgeStrength);

    vec3 blowDir = normalize(vec3(gRnd1, gRnd2, gRnd3) - 0.5 + 0.0001);

    // Assembly — each star streams in from far out along its own vector, on its
    // own delay, so the disc gathers out of drifting dust instead of fading on.
    float delay = gRnd4 * 0.45;
    float at = clamp((1.0 - uAssemble - delay) / (1.0 - delay), 0.0, 1.0);
    float aEase = 1.0 - pow(1.0 - at, 3.0);
    // Spawn radius is in galaxy-local units; uScale (0.18) shrinks it to world.
    // Much larger than this and the inbound shell encloses the camera.
    vec3 spawn = galaxyPos + blowDir * 70.0 + vec3(0.0, (gRnd3 - 0.5) * 26.0, 0.0);
    galaxyPos = mix(spawn, galaxyPos, aEase);

    // Dispersal — every point flies out along its own direction.
    galaxyPos += blowDir * uBlow * 90.0;

    vec3 finalPos = galaxyPos * uScale;
    vec4 modelPosition = modelMatrix * vec4(finalPos, 1.0);

    vec3 toP = modelPosition.xyz - uCursor;
    float cd = length(toP);
    float fall = smoothstep(uRepelRadius, 0.0, cd);
    modelPosition.xyz += normalize(toP + vec3(0.0001)) * fall * uRepelStrength * uActivity;
    vec4 mvPosition = viewMatrix * modelPosition;

    float coreMix = smoothstep(80.0, 0.0, galaxyR);
    vColor = mix(uColEdge, uColCore, clamp(coreMix, 0.0, 1.0));

    float isOrb = step(0.98, fract(gRnd1 * 77.77));
    float starSize = mix(1.0, 3.0, isOrb);
    vFade = mix(0.7, 1.0, isOrb);

    gl_PointSize = uSize * starSize * (10.0 / -mvPosition.z);
    gl_PointSize = max(gl_PointSize, 1.5);
    gl_Position = projectionMatrix * mvPosition;
  }`;

export const galaxyFragmentShader = /* glsl */ `
  uniform float uOpacity;
  uniform float uBrightness;
  uniform float uAppear;
  uniform float uFade;

  varying float vFade;
  varying vec3  vColor;

  void main() {
    vec2 xy = gl_PointCoord - 0.5;
    float ll = length(xy);
    if (ll > 0.5) discard;
    float a = smoothstep(0.5, 0.1, ll);
    gl_FragColor = vec4(vColor * uBrightness, vFade * a * uOpacity * uAppear * uFade);
  }`;
