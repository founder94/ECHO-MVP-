/**
 * Brain point-cloud shaders.
 *
 * A GLB-sampled surface of ~140k additive points: vertical cool→warm tint,
 * dark interior, bright silhouette edge, white-hot synapse flashes, and a
 * continuous tangential flow shimmer. Ported verbatim from the source brain
 * scene; colours are supplied as uniforms (recoloured to the project palette in
 * `constants.ts`). GLSL1 style (`attribute`/`varying`), matching the orb/galaxy
 * materials — three injects the WebGL2 compatibility layer.
 *
 * The `uExplode` term doubles as this scene's assemble animation: at 1 the points
 * are dispersed along their radial/hash direction, at 0 they rest on the surface.
 * The clock drives it (see `brain.tsx`), so the brain gathers as the galaxy blows.
 */
export const brainVertexShader = /* glsl */ `
  attribute float aSeed; attribute float aOcclusion; attribute vec3 aNormal;
  uniform float iTime; uniform float iResolutionY; uniform float uSize; uniform float uSynapseRate;
  uniform float uCenterRadius; uniform float uFlowSpeed; uniform float uFlowAmount;
  uniform vec3 uHighlightPos; uniform float uHighlightRadius; uniform float uHighlightStrength;
  uniform float uExplode; uniform float uExplodeDist;
  uniform vec2 uMouse; uniform float uCursor; uniform float uAspect; uniform float uCursorRadius;
  varying float vSeed; varying float vSynapse; varying float vHemi; varying float vDepth;
  varying float vFrontness; varying float vCenterness; varying float vOcclusion; varying float vHighlight;
  varying float vFar; varying float vCursor; varying vec3 vWorldPos;
  void main() {
    vSeed = aSeed; vOcclusion = aOcclusion;
    vec3 p = position; vWorldPos = p; vHemi = step(0.0, p.x);
    vHighlight = (1.0 - smoothstep(0.0, uHighlightRadius, distance(position, uHighlightPos))) * uHighlightStrength;
    vec3 focalDir = normalize(uHighlightPos + vec3(1e-5));
    float align = dot(normalize(position + vec3(1e-5)), focalDir);
    vFar = smoothstep(0.55, -0.35, align);
    vec3 rad = normalize(p + vec3(1e-5));
    float breathe = sin(iTime * 1.6 + aSeed * 6.0) * 0.012;
    p += rad * breathe;
    vec3 nrm = normalize(aNormal + vec3(1e-5));
    vec3 ref = abs(nrm.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 tA = normalize(cross(nrm, ref));
    vec3 tB = cross(nrm, tA);
    float ph = iTime * uFlowSpeed + aSeed * 6.2831;
    vec3 loopDir = tA * cos(ph) + tB * sin(ph);
    p += loopDir * uFlowAmount;
    vec3 exDir = normalize(rad + vec3(sin(aSeed * 41.0), cos(aSeed * 57.0), sin(aSeed * 73.0)) * 0.45);
    p += exDir * uExplode * uExplodeDist;
    float period = mix(3.0, 9.0, aSeed);
    float firePhase = aSeed * period;
    float ft = mod(iTime + firePhase, period);
    float fire = pow(clamp(1.0 - ft / 0.4, 0.0, 1.0), 2.5);
    if (aSeed > uSynapseRate) fire = 0.0;
    vSynapse = fire;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec4 centerMv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float rel = centerMv.z - mv.z;
    vFrontness = clamp(rel * 0.6 + 0.5, 0.0, 1.0);
    gl_Position = projectionMatrix * mv;
    vec4 centerClip = projectionMatrix * centerMv;
    vec2 centerNDC = centerClip.xy / max(0.0001, centerClip.w);
    vec2 pNDC = gl_Position.xy / max(0.0001, gl_Position.w);
    float screenDist = length(pNDC - centerNDC);
    vCenterness = 1.0 - clamp(screenDist / max(0.05, uCenterRadius), 0.0, 1.0);
    vec2 dMouse = pNDC - uMouse; dMouse.x *= uAspect;
    vCursor = (1.0 - smoothstep(0.0, uCursorRadius, length(dMouse))) * uCursor;
    float baseSize = uSize * (iResolutionY / 720.0) * (200.0 / -mv.z);
    // Synapse flashes flare smaller now (was fire * 2.5) — a subtler twinkle.
    gl_PointSize = baseSize * (1.0 + fire * 0.8 + vHighlight * 1.8 + vCursor * 1.3);
    vDepth = -mv.z;
  }`;

export const brainFragmentShader = /* glsl */ `
  uniform vec3 uCool; uniform vec3 uWarm; uniform vec3 uEdgeColor; uniform vec3 uCenterColor;
  uniform float uCenterFalloff; uniform vec3 uSynapse; uniform float iAlpha; uniform float uGlow;
  uniform float uDepthDarkness; uniform vec3 uDeepColor; uniform float uOcclusionStrength;
  uniform vec3 uHighlightColor; uniform float uHighlightStrength; uniform float uFocusFadeStrength;
  uniform float uIsolateStrength; uniform float uExplode; uniform vec3 uCursorColor;
  varying float vSeed; varying float vSynapse; varying float vHemi; varying float vDepth;
  varying float vFrontness; varying float vCenterness; varying float vOcclusion; varying float vHighlight;
  varying float vFar; varying float vCursor; varying vec3 vWorldPos;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float r = length(p);
    if (r > 0.5) discard;
    float core = pow(smoothstep(0.5, 0.0, r), 2.2);
    float t = pow(vCenterness, max(0.05, uCenterFalloff));
    // Full vertical gradient like the hero orb — cool (bottom) → warm (top).
    // Carries the whole form at full strength (the old 35% tint over an
    // edge-coloured base read flat); it fades toward the dark interior, and the
    // outer rim is lifted with the edge colour.
    float vt = clamp(smoothstep(-0.7, 0.9, vWorldPos.y) + vSeed * 0.12, 0.0, 1.0);
    vec3 grad = mix(uCool, uWarm, vt);
    vec3 base = mix(grad, uCenterColor, t);
    base = mix(base, uEdgeColor, (1.0 - t) * 0.18);
    base = mix(base, uDeepColor, clamp(vOcclusion * uOcclusionStrength, 0.0, 1.0));
    vec3 col = base + uSynapse * vSynapse * 2.0;
    col = mix(col, uHighlightColor, vHighlight * 0.5);
    col += uHighlightColor * vHighlight * 0.7;
    float nonFocus = (1.0 - vHighlight) * uHighlightStrength;
    col = mix(col, uDeepColor, nonFocus * uIsolateStrength);
    float depthMul = mix(1.0 - uDepthDarkness, 1.0, vFrontness);
    col *= depthMul;
    float alphaOut = core * iAlpha * mix(1.0 - uDepthDarkness * 0.7, 1.0, vFrontness);
    alphaOut *= 1.0 + vHighlight * 0.8;
    float focusDim = 1.0 - uHighlightStrength * uFocusFadeStrength * vFar;
    col *= focusDim; alphaOut *= focusDim;
    col += uCursorColor * vCursor * 0.8;
    alphaOut += vCursor * core * 0.32;
    alphaOut *= 1.0 - smoothstep(0.0, 1.0, uExplode) * 0.8;
    gl_FragColor = vec4(col * uGlow, alphaOut);
  }`;
