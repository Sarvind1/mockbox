WebGL Context Loss on Hard Refresh — Investigation Summary
Component: src/components/editor/EditorViewport.tsx
Route: /wrap/[templateId] (reproduced on /wrap/porsche-911)
Status: Partial fix in place; intermittent failures remain.
Symptom
On a hard refresh of the wrap editor route, the 3D model fails to render. Initial behavior was a broken-canvas glyph; after the first fix attempt it became a "Loading 3D scene..." overlay that sometimes resolves and sometimes hangs forever. The user also reports occasional flash-then-disappear behavior where the car briefly paints, then vanishes back to the loader.
Client-side navigation into the same route (Home → Vehicle Wraps → Porsche 911) works reliably. Only hard refresh fails.
Diagnosis
The WebGL context is being lost during the initial Canvas mount. Confirmed via:

gl.isContextLost() === true on the rendered canvas after refresh.
Console: THREE.WebGLRenderer: Context Lost. fires within the first second on every cold load.
Console: THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated warning logged 8 times in the first ~1s of mount, indicating the WebGLRenderer is being constructed 8 times when it should be constructed once. Each construction creates a WebGL context; the browser drops the orphans.

Network shows all assets loading successfully (GLB 200, blob textures 200, HDRI 200) — so it is not an asset failure. It is a React mount/lifecycle problem.
Root Causes (in order of impact)
1. HDRI environment map is fetched from third-party CDNs in addition to the local copy.
Network on every cold refresh shows:

raw.githack.com/.../studio_small_03_1k.hdr → 200
raw.githubusercontent.com/.../studio_small_03_1k.hdr → pending (CORS fallback)
localhost:3000/hdri/studio_small_03_1k.hdr → 200, fetched 3 separate times

The local HDRI was added but a stray useEnvironment() or <Environment preset="..."> call without a files prop is still in the component tree, defaulting drei's loader to its CDN. Each Suspense throw from these fetches re-mounts the Canvas. The triple-fetch of the local file suggests three separate <Environment> components in the tree.
2. Stale Webpack chunk reference returns 404.
/_next/static/chunks/_app-pages-browser_src_components_editor_EditorViewport_tsx.js returns 404 on hard refresh, after which page.js is re-fetched 4 times in succession. This is a stale HMR manifest from the developer's recent edits and forces additional Suspense unmount/remount cycles. This is the most likely cause of the "1-second flash then stuck on Loading" behavior — first mount works, then the failed chunk import triggers a re-render that nukes the working Canvas.
3. React Strict Mode double-invoke is not being prevented.
The current requestAnimationFrame(() => setMounted(true)) deferral is racy and does not reliably wait past Strict Mode's mount → unmount → remount cycle in dev. Evidence: 8 renderer constructions on cold load instead of 1.
Why Navigation Works but Refresh Doesn't
On client-side navigation, the HDRI is browser-cached (no Suspense throw, no extra remount), the chunks are already in memory (no 404), and Strict Mode's double-mount is mild enough for the recovery handler to absorb. On hard refresh, all three failure modes stack: HDRI fetched 4× → multiple Suspense throws, 404 chunk → forced fallback, Strict Mode → extra mounts. Result: the Canvas is mounted 8+ times in 1 second and the GPU drops contexts faster than the app can rebuild them.
Fixes Attempted

Added webglcontextlost listener that logged "waiting for restore" — caught the symptom but webglcontextrestored never fires for app-induced context losses, so the spinner hung forever.
Replaced passive wait with active Canvas remount via setCanvasKey(k => k + 1) after a 500ms setTimeout — masks the bug on most refreshes by rebuilding successfully on attempt #2, but creates a race where the recovery can also nuke a healthy first render.
Added requestAnimationFrame mount deferral — did not eliminate the triple-mount; renderer is still constructed 8 times on cold load.
Added local HDRI file at public/hdri/studio_small_03_1k.hdr — file is being loaded but the CDN fetch is still happening in parallel from a stray useEnvironment call elsewhere in the tree.

Recommended Next Steps (Prioritized)
1. Find and remove the stray CDN HDRI loader. Grep the codebase for useEnvironment and <Environment and verify every call uses files: '/hdri/studio_small_03_1k.hdr' and not preset=.... Investigate why the local file is being fetched 3 times — likely three separate <Environment> components in the tree that should be consolidated to one.
2. Clear the Webpack cache and restart dev server.
rm -rf .next && npm run dev
This should resolve the 404 on _app-pages-browser_src_components_editor_EditorViewport_tsx.js. If it persists, there is a broken dynamic import path that needs to be fixed.
3. Replace the rAF deferral with a Strict-Mode-safe mount gate:
tsxuseEffect(() => {
  let cancelled = false;
  // Double rAF to ensure we're past Strict Mode's sync remount cycle
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!cancelled) setMounted(true);
  }));
  return () => { cancelled = true; };
}, []);
4. Make the recovery handler self-validating so it cannot kill a healthy Canvas:
tsxcanvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  setTimeout(() => {
    const stillLost = canvas.getContext('webgl2')?.isContextLost();
    if (stillLost) setCanvasKey(k => k + 1);
  }, 500);
});
Verification Criteria
After the next iteration, hard-refresh /wrap/porsche-911 10 times and confirm:

PCFSoftShadowMap warning appears at most once per refresh (currently 8×).
No Context Lost log on a clean run.
No remounting Canvas log on a clean run.
The Porsche renders within 3 seconds on every refresh, never stuck on "Loading 3D scene..."
Network shows the HDRI fetched once, from localhost:3000/hdri/, with no requests to raw.githack.com or raw.githubusercontent.com.

Tooling Notes
The gif_creator tool returned 0 frames on three attempts — could not produce a video of the failure. Investigation relied on manual screenshots, console logs, network requests, performance.getEntriesByType() timeline reconstruction, and a 60Hz requestAnimationFrame JS sampler tracking canvas state, context-loss state, and rendered pixel content.
The single biggest investigative gap: nothing I had access to could observe the first ~400ms after a hard refresh, which is exactly when the context-loss-and-recovery race occurs. To capture it visually, the developer should add a debug overlay that timestamps every Canvas mount/loss/restore event so it can be read from a single post-load screenshot.