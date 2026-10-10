import { snoise } from "../shaders/snoise";

/**
 * Orb vertex shader.
 *
 * A Fibonacci sphere displaced along its normals by two simplex octaves. Colour
 * is painted in *view space* so the gradient stays fixed to the screen while the
 * orb rotates underneath.
 *
 * Three stages ride on top of the source scene:
 *
 * - `uAssemble` (0→1) — the reveal. At 0 every point sits at the camera, splayed
 *   a little below centre; at 1 it has landed on the sphere. Each point carries
 *   its own delay, so the form streams past the viewer and gathers.
 * - `uOut` (0→1) — the dissolve. Points ride outward along a noise-warped normal,
 *   with a travelling ripple, so the surface comes apart in liquid sheets rather
 *   than exploding uniformly.
 * - `uCore` (0→1) — bores a hole straight through the blob along the view axis.
 *   The bore is measured in **object space**, not screen space, so its rim rides
 *   the displaced surface and wobbles with the blob instead of being a crisp
 *   circle stamped over it.
 */
export const orbVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPR;
  uniform float uDeform;
  uniform float uOut;
  uniform float uAssemble;
  uniform float uCore;
  uniform vec3  uCentre;
  uniform vec3  uCamLocal;
  uniform vec3  uCursor;
  uniform vec3  uCursorVel;
  uniform float uEnergy;
  uniform float uPointerRadius;
  uniform float uOilBulge;
  uniform float uOilRipple;
  uniform float uOilDrag;
  uniform float uRippleFreq;
  uniform float uRippleSpeed;

  attribute vec3 aRandom;

  varying float vAlpha;
  varying float vLit;
  varying float vVert;
  varying float vSide;
  varying float vOil;

  ${snoise}

  void main(){
    vec3 p = position;

    // Soft radial deformation — two noise octaves, drifting over time.
    float n1 = snoise(p * 1.6 + vec3(0.0, uTime * 0.18, 0.0));
    float n2 = snoise(p * 3.3 - vec3(uTime * 0.12));
    float disp = n1 * 0.72 + n2 * 0.28;
    vec3 pos = p * (1.0 + uDeform * disp);

    // Lighting comes from the crest/trough of the displacement.
    float lit = smoothstep(-0.25, 0.5, disp);
    vLit = lit;

    // --- CORE: a bore straight through the blob, along the view axis ---
    // Measured in object space against the *displaced* surface, so the rim rides
    // the blob's own shape and wobbles with it. A screen-space circle would sit
    // over the blob like a stencil rather than being a hole in it.
    vec3 axis = normalize(uCamLocal);
    float axial = dot(pos, axis);
    float radial = length(pos - axis * axial);
    // Radii on the unit sphere. The rest value matches the hollow the old
    // screen-space cut produced at the hero camera distance; the open value must
    // clear the logo plane's half-size (0.35).
    float bore = mix(0.36, 0.56, uCore) * (1.0 + disp * 0.55);
    float hole = smoothstep(bore, bore + 0.10, radial);

    // --- REVEAL: stream in from the camera ---
    // A wide per-point delay spreads arrival across most of the ramp, so the
    // cloud reads as gathering rather than as one solid mass sliding in.
    float delay = (aRandom.z + 0.5) * 0.55;
    float t = clamp((uAssemble - delay) / (1.0 - delay), 0.0, 1.0);
    float ease = 1.0 - pow(1.0 - t, 3.0);
    // Spawn at the camera, splayed a little below centre.
    vec3 spawn = uCamLocal * 0.92
      + vec3(aRandom.x * 1.9, -1.7 + aRandom.y * 1.3, 0.0);
    pos = mix(spawn, pos, ease);
    float assembleFade = ease;

    // --- DISSOLVE: liquid sheets riding outward ---
    float out2 = uOut * uOut;
    vec3 flow = normalize(p + aRandom * 0.4);
    float sheet = snoise(p * 1.9 + vec3(uTime * 0.25));            // which sheets go first
    float ripple = sin(length(p) * 6.0 - uTime * 1.6 + sheet * 3.0);
    float travel = out2 * (9.0 + sheet * 5.0 + ripple * 1.6);
    pos += flow * travel;
    // Surface tension: the sheets thin and wobble as they leave.
    pos += vec3(sheet, ripple, sheet * ripple) * uOut * 0.55;

    // OIL: viscous disturbance fixed in WORLD space (does not spin with the orb).
    vec4 wpos = modelMatrix * vec4(pos, 1.0);
    vec3 wN = normalize(wpos.xyz - uCentre);
    float ang = acos(clamp(dot(wN, normalize(uCursor)), -1.0, 1.0));
    float fall = smoothstep(uPointerRadius, 0.0, ang);
    float bulge = fall * fall;
    float oilRipple = sin(ang * uRippleFreq - uTime * uRippleSpeed) * fall;
    float oil = (bulge * uOilBulge + oilRipple * uOilRipple) * uEnergy;
    wpos.xyz += wN * oil;
    wpos.xyz += uCursorVel * fall * uOilDrag * uEnergy;
    vOil = (bulge + max(oilRipple, 0.0) * 0.5) * uEnergy;

    vec4 mv = viewMatrix * wpos;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPR * (1.0 / max(0.1, -mv.z));

    // Static view-space colouring — top/bottom and distance from the centre.
    vVert = mv.y;
    vSide = abs(mv.x);

    float depth = pos.z * 0.5 + 0.5;

    // Dissolving points fade as they travel; assembling points fade in.
    float outFade = 1.0 - smoothstep(0.0, 0.92, uOut);

    // Alpha floors. The blend is additive, so a point can only ever *add* light —
    // it cannot draw black. But over a near-black backdrop a point whose alpha
    // collapses reveals that backdrop, and reads as a black blotch rather than as
    // a dimmer particle. Keep a floor under the depth and lighting terms so
    // troughs and the far hemisphere stay coloured instead of dropping out.
    vAlpha = hole * (0.28 + 0.32 * depth) * (0.38 + 0.72 * lit) * outFade * assembleFade;
  }`;

export const orbFragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3  uColTop;
  uniform vec3  uColBottom;
  uniform vec3  uColEdge;
  uniform float uBrightness;
  uniform float uOpacity;
  uniform float uAppear;
  uniform float uIri;

  varying float vAlpha;
  varying float vLit;
  varying float vVert;
  varying float vSide;
  varying float vOil;

  void main(){
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    // Concentrate each sprite's energy in a tight bright core with a thin halo,
    // rather than a wide soft blob. Additive overlap of wide blobs is what read
    // as "soapy"; a crisper falloff makes the orb resolve into particles.
    float soft = smoothstep(0.5, 0.0, d);
    // Square tightens the halo (crisper particles); the ×1.2 restores the peak
    // brightness the squaring would otherwise cost, so the orb reads sharp, not dim.
    soft = soft * soft * 1.2;
    float core = smoothstep(0.13, 0.0, d);

    float vt = clamp(vVert * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(uColBottom, uColTop, vt);
    col = mix(col, uColEdge, smoothstep(0.72, 1.15, vSide));

    // Colour floor, for the same reason as the alpha floor: an unlit trough must
    // still carry its hue rather than fall to black.
    col *= (0.78 + 0.42 * vLit);
    col += smoothstep(0.6, 1.0, vLit) * core * vec3(0.45);

    // Extra glow at the poles — the bloom picks this up.
    float cap = smoothstep(0.55, 1.05, abs(vVert));
    col += col * cap * 1.1;
    float capA = 1.0 + 0.6 * cap;

    // Oil slick: thin-film iridescence over the disturbed area.
    float oilMask = clamp(vOil, 0.0, 1.0);
    vec3 iri = 0.5 + 0.5 * cos(6.2831853 * (vOil * 2.4 + abs(vVert) * 0.3 + vec3(0.0, 0.33, 0.67)));
    col = mix(col, iri, oilMask * uIri);
    col += oilMask * 0.3;

    col *= uBrightness;
    gl_FragColor = vec4(col, soft * vAlpha * capA * uOpacity * uAppear * (1.0 + oilMask * 0.5));
  }`;
