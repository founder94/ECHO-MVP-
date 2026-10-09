// 📖 Docs: obsidian/frontend/scene-3d.md

/** What the scene fetches first: the figure and the Draco decoder (ADR-0033). */
const SCENE_ASSETS = ["/assets/model.glb", "/draco/draco_wasm_wrapper.js", "/draco/draco_decoder.wasm"];

/**
 * Starts the scene's downloads at the first paint, not in the HTML head.
 *
 * As head preloads they raced the first paint: the odometer paints at once,
 * and every download that finished before that paint is billed to it by
 * Lighthouse's simulation (Lantern) — the figure and the decoder turned a
 * ~2 s LCP into 3–5 s. Started from the paint they are still in flight a whole
 * count before the hand-over needs them (the loader holds at 75 until the
 * figure is in).
 *
 * `crossorigin="anonymous"` matches three's FileLoader fetch (mode "cors",
 * credentials "same-origin") — any other combination downloads twice. A 2 s
 * timer covers a browser without paint timing.
 */
export const SCENE_PRELOAD_SCRIPT = `(function(){var d=0;function go(){if(d)return;d=1;${JSON.stringify(
  SCENE_ASSETS,
)}.forEach(function(u){var l=document.createElement("link");l.rel="preload";l.as="fetch";l.crossOrigin="anonymous";l.href=u;document.head.appendChild(l)})}try{new PerformanceObserver(function(l,o){if(l.getEntriesByName("first-contentful-paint").length){o.disconnect();go()}}).observe({type:"paint",buffered:true})}catch(e){}setTimeout(go,2000)})();`;
