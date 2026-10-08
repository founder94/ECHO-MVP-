// GetLayers 3D Scenes 「Solaris」 원본(solaris.html) 셰이더 그대로 — 2026-10-08 대표 구매. 바꾼 곳: 입자 fragment 에 uFade(등장·스크롤 흩어짐) 한 줄.
export const auroraVertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
    }
`;

export const auroraFragmentShader = /* glsl */ `
    uniform float uTime;
    uniform float uScroll;
    uniform vec2 uResolution;
    uniform vec3 color1;
    uniform vec3 color2;
    varying vec2 vUv;

    // Morgan McGuire noise
    float hash(float n) { return fract(sin(n) * 1e4); }
    float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }
    float noise(vec2 x) {
        vec2 i = floor(x);
        vec2 f = fract(x);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    #define OCTAVES 4
    float fbm(vec2 x) {
        float v = 0.0;
        float a = 0.5;
        vec2 shift = vec2(100);
        mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
        for (int i = 0; i < OCTAVES; ++i) {
            v += a * noise(x);
            x = rot * x * 2.0 + shift;
            a *= 0.5;
        }
        return v;
    }

    void main() {
        vec2 st = vUv;
        st.x *= uResolution.x / uResolution.y;

        // Faster animation + massive boost on scroll
        float t = uTime * 6.0 + uScroll * 150.0;

        // Scale coordinates for large, organic blurs
        vec2 st1 = st * 1.2;
        vec2 st2 = st * 1.6;

        // Shape 1: Deep Blue blurs (color2)
        float f1 = fbm(st1 + vec2(t * 0.15, t * 0.1));
        float mask1 = pow(fbm(st1 + f1 * 2.5 - vec2(t * 0.25, 0.0)), 2.0) * 3.5;

        // Shape 2: Blazing Orange blurs (color1)
        float f2 = fbm(st2 - vec2(t * 0.1, t * 0.2));
        float mask2 = pow(fbm(st2 + f2 * 2.0 + vec2(0.0, t * 0.2)), 2.5) * 4.0;

        // Additive blending for extreme saturation without muddy grays
        vec3 finalColor = color2 * mask1 + color1 * mask2;

        // Corner mask: hide the aurora in the center to keep focus on the 3D sphere
        // Using vUv ensures it stays perfectly centered regardless of devicePixelRatio!
        vec2 aspectUv = vUv - 0.5;
        aspectUv.x *= uResolution.x / uResolution.y;
        float centerDist = length(aspectUv);

        // Make the mask dynamic and organic!
        // Adding uScroll makes the "amoeba" actively spin and morph as you scroll
        float angle = atan(aspectUv.y, aspectUv.x) + uScroll * 15.0;
        // Combine a couple of slow sine waves to create an "amoeba" like breathing edge
        float maskOffset = sin(angle * 3.0 + t * 0.4) * 0.05
                         + sin(angle * 5.0 - t * 0.6) * 0.03;
        float dynamicDist = centerDist + maskOffset;

        // Push visibility entirely to the extreme corners
        float cornerFade = smoothstep(0.7, 1.15, dynamicDist);
        cornerFade = pow(cornerFade, 1.6);

        // Apply fade and reduce overall intensity to keep it subtle
        finalColor *= cornerFade * 0.9;

        // Deep dark background base
        vec3 baseBg = vec3(0.012, 0.012, 0.02);

        gl_FragColor = vec4(baseBg + finalColor, 1.0);
    }
`;

export const solarisVertexShader = /* glsl */ `
    uniform float uTime;
    uniform float uScroll;
    uniform float uIntro; // 0 = on-load filled/appearing, 1 = settled
    uniform vec3 uColorTop;    // warm — top of the gradient
    uniform vec3 uColorBottom; // cool — bottom of the gradient
    uniform vec3 uCursor;        // cursor hit point on the sphere surface (world space)
    uniform float uCursorStrength; // 0 = idle, 1 = pointer touching the sphere
    uniform float uCursorRadius;
    uniform float uCursorFlare;
    uniform float uCursorHeat;
    varying float vEdgeFade;
    varying float vHeat;
    varying vec3 vColor;

    // 3D Simplex Noise
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
    float snoise(vec3 v){
      const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + 1.0 * C.xxx; vec3 x2 = x0 - i2 + 2.0 * C.xxx; vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
      i = mod(i, 289.0);
      vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 1.0/7.0; vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
      vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ *ns.x + ns.yyyy; vec4 y = y_ *ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      vec3 p0 = vec3(a0.xy,h.x); vec3 p1 = vec3(a0.zw,h.y); vec3 p2 = vec3(a1.xy,h.z); vec3 p3 = vec3(a1.zw,h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    void main() {
        vec3 normalVec = normalize(position);

        // --- SPHERE POS (resting blob — breathing Simplex deformation) ---
        float noiseVal = snoise(position * 0.5 + uTime * 0.8);
        noiseVal += 0.5 * snoise(position * 1.5 - uTime * 1.2);
        vec3 spherePos = position + normalVec * (noiseVal * 0.5);

        // --- CURSOR SOLAR FLARE ---
        // The sphere sits at the origin with an identity model matrix, so its
        // local position == world position; uCursor is the pointer's hit point
        // on the surface. Particles within reach erupt outward along their
        // normal — a prominence that swells toward the cursor and flickers like
        // real plasma.
        float cursorDist = distance(spherePos, uCursor);
        float flareFall = 1.0 - smoothstep(0.0, uCursorRadius, cursorDist);
        flareFall = pow(flareFall, 1.5);
        float flicker = 0.65 + 0.35 * snoise(position * 3.0 + uTime * 5.0);
        float flare = flareFall * uCursorStrength * flicker;
        spherePos += normalVec * (flare * uCursorFlare);
        vHeat = clamp(flare * uCursorHeat, 0.0, 1.0);

        vec3 finalPos = spherePos;

        vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);

        // Fresnel / Edge fade
        vec3 viewDir = normalize(-mvPosition.xyz);
        vec3 worldNormal = normalize(normalMatrix * normalVec); // approximate normal
        float rim = 1.0 - abs(dot(viewDir, worldNormal));

        // Center dark, edges glowing — the signature hollow-ring look.
        float edgeFadeSphere = smoothstep(0.4, 0.9, rim);

        float opacityMultiplier = 0.8;
        float sizeMultiplier = 1.5;

        // Intro: at uIntro=0 the sphere is fully filled (whole disc visible);
        // as uIntro→1 the centre hollows back to the fresnel rim. A short fade
        // (smoothstep) brings the whole cloud up from nothing on load.
        float introSphere = mix(1.0, edgeFadeSphere, uIntro);
        vEdgeFade = introSphere * opacityMultiplier;
        vEdgeFade *= smoothstep(0.0, 0.2, uIntro);

        // Flared particles light up even in the hollow centre, and swell.
        vEdgeFade += vHeat * 0.7 * smoothstep(0.0, 0.2, uIntro);

        // --- COLORS — pure cool-to-warm gradient across the sphere ---
        float baseColorMix = smoothstep(-3.0, 3.0, position.y + position.x * 0.5);
        vColor = mix(uColorBottom, uColorTop, clamp(baseColorMix, 0.0, 1.0));

        gl_PointSize = sizeMultiplier * (10.0 / -mvPosition.z) * (1.0 + vHeat * 1.6);
        gl_PointSize = max(gl_PointSize, 1.5);

        gl_Position = projectionMatrix * mvPosition;
    }
`;

export const solarisFragmentShader = /* glsl */ `
    varying float vEdgeFade;
    varying float vHeat;
    varying vec3 vColor;
        uniform float uFade;

    void main() {
        vec2 xy = gl_PointCoord.xy - vec2(0.5);
        float ll = length(xy);
        if(ll > 0.5) discard;

        // Soft round points
        float pointAlpha = smoothstep(0.5, 0.1, ll);

        // Flared particles burn toward a white-hot core.
        vec3 col = mix(vColor, vec3(1.0, 0.96, 0.84), vHeat);

        gl_FragColor = vec4(col, vEdgeFade * pointAlpha * 0.9 * uFade);
    }
`;
