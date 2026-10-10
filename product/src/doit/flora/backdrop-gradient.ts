// 2026-10-10 대표 「모바일웹 Flora 그대로」: Flora(Stemline) 원본 src/lib/scene/backdrop/backdrop-gradient.ts 를 글자 그대로 옮겼다(Kindle 바탕 · 원본 셰이더·값 변경 0).
/**
 * The animated gradient behind the hero — currently **Kindle**: a fire front
 * creeping across a field, char behind it, an ember line, licks above.
 *
 * The front is a **level set of the fuel**, and the fuel scrolls past rather
 * than the threshold moving: a threshold that ramps has to wrap, and a wrap in a
 * fire is a seam. Scrolling the field gives an edge that advances forever and
 * never repeats.
 *
 * **This is plain WebGL2** — one fullscreen triangle, one fragment shader, no
 * three.js and no build step. It is deliberately not a three.js scene: it shares
 * nothing with the dandelion but the canvas stack, and keeping it raw is what
 * makes it cheap enough to sit under a scene that is already spending a frame
 * budget of its own.
 *
 * Every transformation happens in the shader. Per frame the caller lerps four
 * pointer scalars, uploads four uniforms and issues one `drawArrays` — there is
 * no JS animation here, and no CSS animation or filter on the canvas.
 *
 * **The module is named for its job, not for this look.** Swapping in another
 * gradient from the same collection is a new shader, a new config and a new set
 * of palette tokens; nothing outside this file and its three inputs moves.
 *
 * 📖 Docs: obsidian/frontend/backdrop-gradient.md
 */

export interface BackdropTokens {
  /** The unlit field the front burns across. */
  ground: string;
  /** The ramp, darkest first. The stops are placed against each other. */
  deep: string;
  mid: string;
  hot: string;
  light: string;
}

export interface BackdropConfig {
  /** Field zoom. Smaller is a wider, slower field. */
  scale: number;
  /** How fast the field evolves, and how fast the front creeps across it. */
  speed: number;
  spread: number;
  /** How fast the licks climb off the ember line. */
  rise: number;
  /** The fuel level the front sits at, and how thick the ember line is. */
  threshold: number;
  ember: number;
  /** How much of the licking flame survives into the field. */
  lick: number;
  /** fBm gain and octave spacing. */
  roughness: number;
  lacunarity: number;
  /** Tone curve over the field: slope and the value that stays put. */
  contrast: number;
  midpoint: number;
  /** How far up the ramp the unlit ground gives way to fire. */
  sink: number;
  /** Highlight bloom on the hottest part of the front. */
  glow: number;
  /** Film grain, and whether it re-seeds (1) or stays still (0). */
  grain: number;
  grainAnim: number;
  /** Triangular dither — not decoration: a field this smooth bands without it. */
  dither: number;
  vignette: number;
  /** 0 ignores the pointer entirely and the field goes fully ambient. */
  cursor: number;
  /** The pointer's reach, how hard it draws the front, and its wake. */
  pointerRadius: number;
  pointerStrength: number;
  wake: number;
  /** How far the field slides under the pointer. */
  parallax: number;
  /** Hard ceiling on device pixel ratio — the cost here is quadratic in it. */
  maxDpr: number;
}

export interface BackdropGradientOptions {
  canvas: HTMLCanvasElement;
  tokens: BackdropTokens;
  config: BackdropConfig;
}

const VERTEX_SOURCE = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/**
 * uFade is the one addition to the shader as published: the scene above this one
 * puts the room out as the camera comes round, and with the canvases composited
 * additively nothing drawn on top can darken what is behind it. It scales the
 * finished pixel, dither and all, so a faded backdrop is exactly black.
 */
const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2  iResolution;
uniform float iTime;
// Aspect-corrected units, the same space as uv — it trails the cursor.
uniform vec2  iMouse;
// Lead minus body: where the pointer is heading, and how hard.
uniform vec2  iMouseVel;

uniform vec3  uBg, uColorA, uColorB, uColorC, uColorD;
uniform float uScale, uSpeed, uSpread, uRise, uThreshold, uEmber;
uniform float uLick, uRoughness, uLacunarity, uContrast, uMidpoint, uSink;
uniform float uGlow, uGrain, uDither, uVignette, uPointerRadius, uPointerStrength;
uniform float uWake, uParallax;
uniform float uGrainAnim;
uniform float uFade;

#define OCTAVES 3

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float snoise(vec2 p) {
  const float K1 = 0.366025404, K2 = 0.211324865;
  vec2 i = floor(p + (p.x + p.y) * K1);
  vec2 a = p - i + (i.x + i.y) * K2;
  float m = step(a.y, a.x);
  vec2 o = vec2(m, 1.0 - m);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0 * K2;
  vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
  vec3 n = h * h * h * h * vec3(dot(a, hash2(i)), dot(b, hash2(i + o)), dot(c, hash2(i + 1.0)));
  return dot(n, vec3(70.0));
}

float fbm(vec2 p) {
  float v = 0.0, amp = 0.5;
  for (int i = 0; i < OCTAVES; i++) {
    v += amp * snoise(p);
    p *= uLacunarity;
    amp *= uRoughness;
  }
  return v;
}

vec3 ramp4(float t) {
  vec3 c = mix(uColorA, uColorB, smoothstep(0.00, 0.36, t));
  c = mix(c, uColorC, smoothstep(0.32, 0.70, t));
  c = mix(c, uColorD, smoothstep(0.66, 1.00, t));
  return c;
}

// Triangular-PDF dither — the only reliable cure for 8-bit gradient banding.
float triDither(vec2 fc) {
  float a = fract(sin(dot(fc, vec2(12.9898, 78.233))) * 43758.5453);
  float b = fract(sin(dot(fc + 17.0, vec2(12.9898, 78.233))) * 43758.5453);
  return (a + b - 1.0) / 255.0;
}

// House grain. An integer hash, so no sin() streaks; triangular, so it reads as
// film rather than static; weighted into the midtones, so it never crusts a
// black or a white. Static by default, re-seeded 24 times a second by uGrainAnim.
float houseGrain(vec2 fc) {
  uvec2 q = uvec2(fc) * uvec2(1597334677u, 3812015801u)
          + uint(floor(iTime * 24.0 * uGrainAnim)) * 2654435769u;
  uint n = q.x ^ q.y; n = n * 1664525u + 1013904223u; n ^= n >> 16u; n *= 2246822519u; n ^= n >> 13u;
  float a = float(n & 0xffffu) / 65535.0;
  n *= 3266489917u; n ^= n >> 16u;
  float b = float(n & 0xffffu) / 65535.0;
  return a + b - 1.0;
}

void main() {
  // Centred and scaled by height, so the field reflows rather than stretching
  // at any aspect ratio.
  vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution) / iResolution.y;
  float t = iTime * uSpeed;

  vec2 d = uv - iMouse;
  float near = exp(-dot(d, d) / max(1e-4, uPointerRadius * uPointerRadius));

  // The front is a level set of the fuel, and the FUEL scrolls past rather than
  // the threshold moving — a threshold that ramps has to wrap, and a wrap in a
  // fire is a seam. Scrolling gives an edge that advances forever.
  vec2 p = (uv - iMouse * uParallax) * uScale + vec2(t * uSpread, 0.0);
  float fuel = fbm(p * 1.5) * 0.5 + 0.5;

  // Fire leans toward a draught: the threshold drops where the hand is, so the
  // front bulges toward it.
  float thr = uThreshold - near * uPointerStrength * 0.12 - iMouseVel.x * uWake * 0.05;
  float e0 = fuel - thr;

  float charred = smoothstep(0.02, -0.14, e0);
  float ember = exp(-e0 * e0 / max(1e-5, uEmber * uEmber));
  float lick = (fbm(vec2(p.x * 2.4, p.y * 1.2 - t * uRise)) * 0.5 + 0.5) * ember * uLick;

  float f = clamp(0.08 + charred * 0.10 + ember * 0.50 + lick * 0.34, 0.0, 1.0);
  f = clamp((f - uMidpoint) * uContrast + 0.5, 0.0, 1.0);

  vec3 col = ramp4(f);
  col += uColorD * uGlow * pow(f, 4.0);
  col = mix(uBg, col, smoothstep(0.0, max(0.01, uSink), f) * 0.9 + 0.1);
  col *= 1.0 - uVignette * dot(uv, uv);
  { float hgL = clamp(dot(col, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
    col += houseGrain(gl_FragCoord.xy) * uGrain * mix(1.0, 4.0 * hgL * (1.0 - hgL), 0.6); }
  col += triDither(gl_FragCoord.xy) * uDither;

  fragColor = vec4(clamp(col, 0.0, 1.0) * uFade, 1.0);
}`;

/**
 * Resolve any CSS colour to 0–1 RGB.
 *
 * Hex is taken directly; anything else is handed to a 1x1 2D context, which is
 * the browser's own parser. That keeps this module dependency-free while still
 * accepting whatever a token happens to hold.
 */
const parseColor = (value: string): [number, number, number] => {
  const hex = value.trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (short) {
    return [
      parseInt(short[1] + short[1], 16) / 255,
      parseInt(short[2] + short[2], 16) / 255,
      parseInt(short[3] + short[3], 16) / 255,
    ];
  }
  if (long) {
    return [
      parseInt(long[1], 16) / 255,
      parseInt(long[2], 16) / 255,
      parseInt(long[3], 16) / 255,
    ];
  }

  const probe = document.createElement("canvas");
  probe.width = 1;
  probe.height = 1;
  const context = probe.getContext("2d", { willReadFrequently: true });
  if (!context) return [0, 0, 0];
  context.fillStyle = hex;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
};

export class BackdropGradient {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly locations = new Map<string, WebGLUniformLocation | null>();
  private config: BackdropConfig;
  private pixelRatio = 1;

  constructor({ canvas, tokens, config }: BackdropGradientOptions) {
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("WebGL2 is not available");

    this.canvas = canvas;
    this.gl = gl;
    this.config = config;

    const program = gl.createProgram();
    gl.attachShader(program, this.compile(gl.VERTEX_SHADER, VERTEX_SOURCE));
    gl.attachShader(program, this.compile(gl.FRAGMENT_SHADER, FRAGMENT_SOURCE));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "link failed");
    }
    this.program = program;
    gl.useProgram(program);
    // No buffers and no attributes: the triangle is built from gl_VertexID. A
    // bound VAO is still required for a draw call to be legal.
    gl.bindVertexArray(gl.createVertexArray());

    this.applyTokens(tokens);
    this.applyConfig(config);
    this.resize();
  }

  private compile(type: number, source: string): WebGLShader {
    const { gl } = this;
    const shader = gl.createShader(type);
    if (!shader) throw new Error("could not create shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || "shader compile failed");
    }
    return shader;
  }

  /** Cached: `getUniformLocation` is a string lookup into the driver. */
  private location(name: string): WebGLUniformLocation | null {
    const cached = this.locations.get(name);
    if (cached !== undefined) return cached;
    const found = this.gl.getUniformLocation(this.program, name);
    this.locations.set(name, found);
    return found;
  }

  private float(name: string, value: number): void {
    this.gl.uniform1f(this.location(name), value);
  }

  /** The palette is the tokens and the tokens only — never the shader. */
  applyTokens(tokens: BackdropTokens): void {
    const { gl } = this;
    gl.useProgram(this.program);
    const upload = (name: string, colour: string): void => {
      const [r, g, b] = parseColor(colour);
      gl.uniform3f(this.location(name), r, g, b);
    };
    upload("uBg", tokens.ground);
    upload("uColorA", tokens.deep);
    upload("uColorB", tokens.mid);
    upload("uColorC", tokens.hot);
    upload("uColorD", tokens.light);
  }

  applyConfig(config: BackdropConfig): void {
    this.config = config;
    this.gl.useProgram(this.program);
    this.float("uScale", config.scale);
    this.float("uSpeed", config.speed);
    this.float("uSpread", config.spread);
    this.float("uRise", config.rise);
    this.float("uThreshold", config.threshold);
    this.float("uEmber", config.ember);
    this.float("uLick", config.lick);
    this.float("uRoughness", config.roughness);
    this.float("uLacunarity", config.lacunarity);
    this.float("uContrast", config.contrast);
    this.float("uMidpoint", config.midpoint);
    this.float("uSink", config.sink);
    this.float("uGlow", config.glow);
    this.float("uGrain", config.grain);
    this.float("uGrainAnim", config.grainAnim);
    this.float("uDither", config.dither);
    this.float("uVignette", config.vignette);
    this.float("uPointerRadius", config.pointerRadius);
    this.float("uPointerStrength", config.pointerStrength);
    this.float("uWake", config.wake);
    this.float("uParallax", config.parallax);
    this.resize();
  }

  /** True while the pointer should be followed at all. */
  get followsPointer(): boolean {
    return this.config.cursor !== 0;
  }

  resize(): void {
    const { gl, canvas } = this;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.config.maxDpr);
    const width = Math.max(1, Math.round(canvas.clientWidth * this.pixelRatio));
    const height = Math.max(1, Math.round(canvas.clientHeight * this.pixelRatio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.program);
    gl.uniform2f(this.location("iResolution"), width, height);
  }

  /**
   * @param clock - seconds, accumulated from clamped frame intervals by the
   *   caller. Never wall time: rAF stops in a background tab and wall time does
   *   not, and handing the shader that gap is what makes a field lurch on the
   *   way back.
   * @param velocityX - the gap between the pointer's two poles. It opens while
   *   the hand moves and closes on its own a beat after it stops, which buys a
   *   wake with no history buffer anywhere.
   * @param fade - 1 shows the gradient, 0 is black.
   */
  render(
    clock: number,
    pointerX: number,
    pointerY: number,
    velocityX: number,
    velocityY: number,
    fade: number,
  ): void {
    const { gl } = this;
    gl.useProgram(this.program);
    this.float("iTime", clock);
    gl.uniform2f(this.location("iMouse"), pointerX, pointerY);
    gl.uniform2f(this.location("iMouseVel"), velocityX, velocityY);
    this.float("uFade", fade);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /**
   * Releases the program and nothing else. **The context is deliberately left
   * alone**: `WEBGL_lose_context` would be the tidier-looking ending, but React
   * double-invokes effects in development, and `getContext` on the same canvas
   * hands the second instance the context the first one just killed — every
   * shader then fails to compile **with a null info log**, which looks like a
   * shader bug and is not one. The canvas leaves the DOM with the component and
   * the context goes with it.
   */
  dispose(): void {
    const { gl } = this;
    gl.useProgram(null);
    gl.deleteProgram(this.program);
    this.locations.clear();
  }
}
