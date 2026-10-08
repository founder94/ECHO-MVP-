// GetLayers 3D Scenes 「Einstein–Rosen Lattice」 원본(einstein-rosen-lattice.html) 셰이더 — 2026-10-08 대표 구매.
// 바꾼 곳: STEPS·BISECT 를 #define(휴대폰은 줄임) · 마지막 줄 알파 = 선 밝기(투명 캔버스로 별 배경 위에 겹치기).
export const quadVertexShader = /* glsl */ `
  void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const bridgeFragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3  iResolution;
  uniform float iTime, iAlpha, uAspect;
  uniform float iAz, iEl, iSpin, iPhase, iPulse, iBreath;
  uniform float uA, uB, uCamDist, uTanFov;
  uniform float uMeridians, uRingSpacing;
  uniform float uLineWidth, uLineGain, uHazeMax, uThroatBoost;
  uniform float uTintAmount, uTintFalloff;
  uniform float uFadeStart, uFadeEnd, uVignette, uVignettePower, uHorizonFloor;
  uniform float uPulseAmp;
  uniform float uSeamGap;
  uniform vec3  uLineColor, uThroatTint, uRimTint;

  #ifndef STEPS
  #define STEPS 72
  #endif
  #ifndef BISECT
  #define BISECT 18
  #endif
  const float PI     = 3.14159265359;
  const float SPAN   = 15.0;

  float acoshx(float x){ x = max(x, 1.0); return log(x + sqrt(x * x - 1.0)); }
  float asinhx(float x){ return log(x + sqrt(x * x + 1.0)); }

  // signed "outside-ness": > 0 in the waist chamber the camera occupies,
  // < 0 inside the funnel.  Root = the catenoid  rho = a*cosh(y/b).
  float phiOf(float sig, float A, float Rm2, float cy, float vy, float a, float b){
    float R = sqrt(A * sig * sig + Rm2);
    return acoshx(R / a) - abs(cy + vy * sig) / b;
  }

  // one lattice family: crisp line, dissolving to a bounded haze once the
  // spacing drops under a pixel (this is what paints the horizon band)
  float lattice(float v, float per, float grad){
    float w = max(grad * uLineWidth, 1e-9);
    float d = abs(fract(v / per) - 0.5) * per;
    float s = 1.0 - clamp(d / w, 0.0, 1.0);
    s = s * s * (3.0 - 2.0 * s);
    float ratio = 2.0 * w / per;
    float avg = min(clamp(ratio, 0.0, 1.0), uHazeMax);
    float k = clamp((ratio - 0.30) / 0.70, 0.0, 1.0);
    return clamp(mix(s, avg, k), 0.0, 1.0);
  }

  void main(){
    vec2 p = gl_FragCoord.xy / iResolution.xy * 2.0 - 1.0;

    // breathing throat + click ripple through the bridge
    float a = uA * iBreath * (1.0 - iPulse * uPulseAmp * 0.25);
    float b = uB * (1.0 + iPulse * uPulseAmp * 0.35);

    // orbit camera (pointer parallax) — at rest this is (0, 0, D) looking at 0
    float ca = cos(iAz), sa = sin(iAz), ce = cos(iEl), se = sin(iEl);
    vec3  O  = uCamDist * vec3(sa * ce, se, ca * ce);
    vec3  fw = normalize(-O);
    vec3  rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
    vec3  up = cross(rt, fw);
    vec3  V  = normalize(fw + rt * (p.x * uTanFov * uAspect) + up * (p.y * uTanFov));

    float A    = max(V.x * V.x + V.z * V.z, 1e-8);
    float sqA  = sqrt(A);
    float tst  = -(O.x * V.x + O.z * V.z) / A;
    float Rm2  = max(O.x * O.x + O.z * O.z - A * tst * tst, 0.0);
    float cy   = O.y + V.y * tst;

    // scan sigma = t - tstar in an asinh-warped variable so the throat and
    // the far field are both resolved by the same fixed step count
    float sig0 = -tst;
    float w0   = asinhx(sqA * sig0 / a);
    float dw   = SPAN / float(STEPS);
    float ew   = exp(w0);
    float ed   = exp(dw);
    float iw   = 1.0 / ew;
    float id   = 1.0 / ed;
    float kSig = a / sqA;

    float sPrev = sig0;
    float pPrev = phiOf(sig0, A, Rm2, cy, V.y, a, b);
    float lo = 0.0, hi = 0.0;
    bool  hit = false;

    for (int i = 0; i < STEPS; i++){
      ew *= ed; iw *= id;
      float sg = kSig * 0.5 * (ew - iw);
      float ph = phiOf(sg, A, Rm2, cy, V.y, a, b);
      if (pPrev > 0.0 && ph <= 0.0){ lo = sPrev; hi = sg; hit = true; break; }
      sPrev = sg; pPrev = ph;
    }

    // near-equatorial rays never cross the catenoid — rather than stamp a hard
    // black seam across the middle, let them ride out to the farthest marched
    // sample so the horizon reads as one continuous surface top-to-bottom
    float miss = hit ? 0.0 : 1.0;
    if (hit){
      for (int i = 0; i < BISECT; i++){
        float m = 0.5 * (lo + hi);
        if (phiOf(m, A, Rm2, cy, V.y, a, b) > 0.0) lo = m; else hi = m;
      }
    } else {
      lo = sPrev; hi = sPrev;
    }

    float t = tst + 0.5 * (lo + hi);
    vec3  h = O + V * t;

    // lattice coordinates: rings drift along the bridge, meridians spin
    float ring = h.y + iPhase;
    float mer  = atan(h.z, h.x) + iSpin;

    float perR = 2.0 * PI * b / uMeridians * uRingSpacing;
    float perM = 2.0 * PI / uMeridians;

    float dR = fwidth(ring);
    float dM = min(fwidth(mer), fwidth(mod(mer + PI, 2.0 * PI)));

    float g = max(lattice(ring, perR, dR), lattice(mer, perM, dM));

    // shading — value structure: black field, fine bright wire
    float rr = clamp(abs(h.y) / (b * uTintFalloff), 0.0, 1.0);
    vec3  col = uLineColor;
    col = mix(col, uThroatTint, uTintAmount * (1.0 - smoothstep(0.0, 0.55, rr)));
    col = mix(col, uRimTint,    uTintAmount * smoothstep(0.35, 1.0, rr));

    float boost = 1.0 + uThroatBoost * (1.0 - smoothstep(0.0, 0.45, rr));
    float fade  = 1.0 - clamp((t - uFadeStart) / max(uFadeEnd - uFadeStart, 1e-3), 0.0, 1.0);
    // keep lit pixels (lines + horizon haze) above a floor so the far field and
    // the equatorial miss-fill never fade to a black seam — the sheets stay joined
    fade = max(fade, uHorizonFloor);
    float vig   = 1.0 - uVignette * pow(clamp(length(p) * 0.72, 0.0, 1.0), uVignettePower);

    // FAR-HORIZON gap: split the BACKGROUND where the receding upper & lower
    // sheets meet at the equator, WITHOUT touching the near throat. The seam is an
    // EQUATORIAL-DIRECTION ray (cy ~ 0, cy = the ray's height at closest approach
    // to the axis) — true for BOTH the near throat and the far horizon, so cy alone
    // can't tell them apart. Distance does: gate on t so only far hits (the
    // background horizon, t >> throat) get cut, leaving the central throat whole.
    // uSeamGap = half-width of the black band in cy (world height at the axis).
    float farNess = smoothstep(uCamDist * 1.7, uCamDist * 3.0, t);
    float eqNess  = 1.0 - smoothstep(0.0, max(uSeamGap, 1e-4), abs(cy));
    float gapMask = farNess * eqNess;

    float I = g * boost * fade * vig * uLineGain * iAlpha * (1.0 - gapMask);
    gl_FragColor = vec4(col * I, min(1.0, I * 1.35));
  }
`;

export const glowFragmentShader = /* glsl */ `
  precision highp float;
  uniform vec3  iResolution;
  uniform float uAspect, iAlpha, iPulse;
  uniform float uGlowIntensity, uGlowWidth, uGlowHeight, uGlowFalloff;
  uniform vec3  uGlowColor;
  void main(){
    vec2 q = gl_FragCoord.xy / iResolution.xy * 2.0 - 1.0;
    q.x *= uAspect;
    vec2 e = q / vec2(max(uGlowWidth, 1e-3), max(uGlowHeight, 1e-3));
    float d = length(e);
    float g = exp(-pow(d, uGlowFalloff));
    float amp = uGlowIntensity * (1.0 + iPulse * 0.9);
    gl_FragColor = vec4(uGlowColor * g * amp * iAlpha, 1.0);
  }
`;
