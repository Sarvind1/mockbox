# Making a GLB Car Model Pastable in MockBox -- Definitive Agent Guide

**Audience**: AI agent (Claude Code or equivalent). Written as imperative instructions.  
**Prerequisite**: The human provides ONE file -- a `.glb` car model. Everything else is your job.  
**Reference implementation**: 2016 BMW X5M (`2016_bmw_x5m.glb` -> `2016_bmw_x5m_panels.glb`)

---

## Overview: What "Pastable" Means

A pastable vehicle in MockBox has independently selectable body panels (hood, doors, fenders, etc.) that each accept uploaded artwork. The user clicks a panel, uploads an image, and it maps onto that panel with correct UVs. Multiple panels can be grouped for a single-paste stripe or full-side wrap.

The pipeline has 5 stages:
1. **GLB inspection** -- understand the mesh/material structure
2. **Split script** -- separate the carpaint mesh into named panel meshes
3. **5-file wiring** -- register the model in templates, store, component, viewport, and sidebar
4. **Non-carpaint discovery** -- handle glass, trim, chrome, and other materials
5. **Verification** -- visual and functional QA

---

## Stage 1: GLB Inspection

### 1a. Raw Binary GLB Parser (Zero Dependencies)

Use this Node.js snippet to inspect any GLB without installing dependencies. Run it against the raw `.glb` file to extract the embedded JSON chunk (the glTF manifest).

```js
// inspect-glb.mjs -- zero-dependency GLB inspector
import { readFileSync } from "fs";

const buf = readFileSync(process.argv[2]);
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

// GLB header: magic(4) + version(4) + length(4)
const magic = dv.getUint32(0, true);
if (magic !== 0x46546C67) throw new Error("Not a GLB file");
const version = dv.getUint32(4, true);
const totalLen = dv.getUint32(8, true);
console.log(`GLB v${version}, ${totalLen} bytes`);

// Chunk 0 should be JSON (type 0x4E4F534A)
const c0Len = dv.getUint32(12, true);
const c0Type = dv.getUint32(16, true);
if (c0Type !== 0x4E4F534A) throw new Error("First chunk is not JSON");

const json = JSON.parse(
  new TextDecoder().decode(buf.slice(20, 20 + c0Len))
);

// Print material names
console.log("\n== Materials ==");
(json.materials || []).forEach((m, i) =>
  console.log(`  [${i}] ${m.name || "(unnamed)"}`)
);

// Print mesh names and their material indices
console.log("\n== Meshes ==");
(json.meshes || []).forEach((mesh, i) => {
  console.log(`  [${i}] ${mesh.name || "(unnamed)"}`);
  (mesh.primitives || []).forEach((p, j) => {
    const matIdx = p.material ?? "none";
    const matName =
      matIdx !== "none" ? json.materials?.[matIdx]?.name : "none";
    const attrs = Object.keys(p.attributes || {}).join(", ");
    console.log(`       prim[${j}] mat=${matName} (${matIdx}) attrs=[${attrs}]`);
  });
});

// Print node hierarchy
console.log("\n== Nodes ==");
(json.nodes || []).forEach((n, i) => {
  const meshRef = n.mesh !== undefined ? ` -> mesh[${n.mesh}]` : "";
  const children = n.children ? ` children=[${n.children}]` : "";
  const scale = n.scale ? ` scale=[${n.scale}]` : "";
  console.log(`  [${i}] ${n.name || "(unnamed)"}${meshRef}${children}${scale}`);
});
```

Run: `node inspect-glb.mjs public/models/your_car.glb`

### 1b. What to Look For

Identify:
- **The carpaint material name** (e.g., `"carpaint"`). This is the material on the main body panels.
- **Glass/transmission materials** -- any material with `transmission > 0` or `KHR_materials_transmission`.
- **Trim/chrome materials** -- materials like `"phong9"`, `"chrome"`, `"black_plastic"` that cover non-wrappable surfaces.
- **The node hierarchy** -- which node is the carpaint mesh, what is its parent, does the parent have a scale transform.
- **Bounding box** -- mentally note the axis conventions (which axis is front-to-rear, which is left-to-right).

### 1c. Install gltf-transform

The split script uses `@gltf-transform/core` **v3** (v4 had breaking API changes — `io.read()` was removed):

```bash
npm install --save-dev @gltf-transform/core@^3
```

---

## Stage 2: The Split Script

Create `scripts/split-{car-name}-panels.mjs`. This script:
1. Reads the source GLB
2. Finds the mesh primitive using the carpaint material
3. Computes the bounding box of all carpaint vertices
4. For each triangle, computes its centroid, normalizes to 0-1 range, and assigns it to a named panel zone
5. Builds new mesh primitives with planar-projected UVs per panel
6. Attaches them to the same parent node as the original carpaint mesh
7. Removes the original carpaint mesh
8. Writes the output GLB

### 2a. Panel Zone Definitions

Define zones as normalized bounding-box regions. The actual thresholds from the BMW X5M:

```js
// Coordinates are NORMALIZED (0-1) relative to the body mesh bounding box:
//   nX: 0=left (-X) -> 1=right (+X)
//   nY: 0=bottom    -> 1=top
//   nZ: 0=front     -> 1=rear
// Zones evaluated in order; first match wins. Last zone is the fallback.

const PANELS = [
  { name: 'bumper_front', test: (x,y,z) => z < 0.10 },
  { name: 'bumper_rear',  test: (x,y,z) => z > 0.90 },
  { name: 'hood',         test: (x,y,z) => y > 0.70 && z >= 0.10 && z < 0.35 },
  { name: 'roof',         test: (x,y,z) => y > 0.84 && z >= 0.35 && z <= 0.68 },
  { name: 'trunk',        test: (x,y,z) => y > 0.62 && z > 0.68 && z <= 0.90 },
  { name: 'fender_fl',    test: (x,y,z) => x < 0.25 && y > 0.42 && z >= 0.10 && z < 0.32 },
  { name: 'fender_fr',    test: (x,y,z) => x > 0.75 && y > 0.42 && z >= 0.10 && z < 0.32 },
  { name: 'door_fl',      test: (x,y,z) => x < 0.22 && y >= 0.25 && y <= 0.86 && z >= 0.28 && z < 0.50 },
  { name: 'door_fr',      test: (x,y,z) => x > 0.78 && y >= 0.25 && y <= 0.86 && z >= 0.28 && z < 0.50 },
  { name: 'door_rl',      test: (x,y,z) => x < 0.22 && y >= 0.25 && y <= 0.86 && z >= 0.50 && z <= 0.76 },
  { name: 'door_rr',      test: (x,y,z) => x > 0.78 && y >= 0.25 && y <= 0.86 && z >= 0.50 && z <= 0.76 },
  { name: 'rocker_l',     test: (x,y,z) => x < 0.20 && y < 0.35 && z > 0.12 && z < 0.88 },
  { name: 'rocker_r',     test: (x,y,z) => x > 0.80 && y < 0.35 && z > 0.12 && z < 0.88 },
  { name: 'body_misc',    test: () => true },  // fallback -- catches everything else
];
```

**These thresholds are specific to the BMW X5M.** Every new car model WILL need different thresholds. Be honest about this -- the bounding box proportions, axis conventions, and panel geometry vary per model. Expect 3-5 iterations of adjusting thresholds, re-running the script, and visually inspecting the result.

### 2b. UV Projection Strategy

The script generates planar-projected UVs (not the original model UVs). For each panel:

1. Compute the area-weighted average normal of all triangles in the panel
2. Drop the dominant axis (the one the normal points along most)
3. Project the remaining two axes as U and V
4. Normalize to [0,1] range

```js
// Area-weighted average normal to find dominant projection axis
let nx=0, ny=0, nz=0;
for (let i = 0; i < tris.length; i++) {
  // cross product of triangle edges (area-weighted)
  const b = i * 3;
  const x0=newPos[b*3], y0=newPos[b*3+1], z0=newPos[b*3+2];
  const x1=newPos[(b+1)*3], y1=newPos[(b+1)*3+1], z1=newPos[(b+1)*3+2];
  const x2=newPos[(b+2)*3], y2=newPos[(b+2)*3+1], z2=newPos[(b+2)*3+2];
  const ex=x1-x0, ey=y1-y0, ez=z1-z0;
  const fx=x2-x0, fy=y2-y0, fz=z2-z0;
  nx += ey*fz - ez*fy;
  ny += ez*fx - ex*fz;
  nz += ex*fy - ey*fx;
}
// Drop the dominant axis, project onto the other two
const aX=Math.abs(nx), aY=Math.abs(ny), aZ=Math.abs(nz);
let uIdx, vIdx;
if (aX >= aY && aX >= aZ) { uIdx=2; vIdx=1; }      // side face  -> u=Z, v=Y
else if (aY >= aX && aY >= aZ) { uIdx=0; vIdx=2; } // top/bottom -> u=X, v=Z
else                           { uIdx=0; vIdx=1; } // front/rear -> u=X, v=Y
```

### 2c. Parent Node Attachment (CRITICAL)

New panel nodes MUST be attached to the same parent as the original carpaint node, not the scene root. The script finds the parent:

```js
let parentContainer = null;
for (const node of doc.getRoot().listNodes()) {
  if (node.listChildren().some(c => c === targetMeshNode)) {
    parentContainer = node;
    break;
  }
}
// Add to same parent, NOT scene root
if (parentContainer) {
  parentContainer.addChild(newNode);
} else {
  scene.addChild(newNode);
}
```

### 2d. Run the Script

```bash
node scripts/split-{car-name}-panels.mjs
```

Verify the output by checking triangle counts in the console output. Every panel should have > 0 triangles (see Gotcha #1 below).

---

## Stage 3: 5-File Wiring

Five files must be modified to register the new model. Here they are in order.

### File 1: `src/lib/types.ts`

No changes needed IF the `CanvasZone`, `ZoneGroup`, and `PackagingTemplate` types already exist. They should -- the BMW X5M added them. Verify these types exist:

```ts
export interface CanvasZone {
  id: string;    // matches mesh name in the GLB (e.g., "hood")
  label: string; // human-readable label (e.g., "Hood")
}

export interface ZoneGroup {
  id: string;
  label: string;
  zoneIds: string[];
  isPredefined: boolean;
}

export interface PackagingTemplate {
  // ...
  canvasZones?: CanvasZone[];
  zoneGroups?: ZoneGroup[];
}
```

### File 2: `src/lib/templates.ts`

Add a new template entry. **The example below is the BMW X5M — use it as a structural pattern only. Do NOT modify it. Copy it, change the `id`, `name`, and `canvasZones` to match your new model.** The `id` of each zone MUST exactly match the mesh name output by your split script. Include `"trim"` (or whatever your non-carpaint trim zone is named) here too.

```ts
// PATTERN ONLY — adapt this for your car, do not edit the BMW entry
{
  id: "bmw-x5m",
  name: "BMW X5M",
  category: "vehicles",
  description: "2016 BMW X5M — full body wrap with panel canvas zones",
  surfaces: ["body"],
  canvasZones: [
    { id: "hood",         label: "Hood" },
    { id: "roof",         label: "Roof" },
    { id: "trunk",        label: "Trunk" },
    { id: "bumper_front", label: "Front Bumper" },
    { id: "bumper_rear",  label: "Rear Bumper" },
    { id: "fender_fl",    label: "Front Left Fender" },
    { id: "fender_fr",    label: "Front Right Fender" },
    { id: "door_fl",      label: "Front Left Door" },
    { id: "door_fr",      label: "Front Right Door" },
    { id: "door_rl",      label: "Rear Left Door" },
    { id: "door_rr",      label: "Rear Right Door" },
    { id: "rocker_l",     label: "Left Rocker" },
    { id: "rocker_r",     label: "Right Rocker" },
    { id: "body_misc",    label: "Body (Other)" },
    { id: "trim",         label: "Body Trim" },
  ],
  zoneGroups: [
    { id: "racing_stripe", label: "Racing Stripe",   zoneIds: ["hood", "roof", "trunk"],                              isPredefined: true },
    { id: "full_left",     label: "Full Left Side",  zoneIds: ["fender_fl", "door_fl", "door_rl", "rocker_l"],        isPredefined: true },
    { id: "full_right",    label: "Full Right Side", zoneIds: ["fender_fr", "door_fr", "door_rr", "rocker_r"],        isPredefined: true },
    { id: "front_end",     label: "Front End",       zoneIds: ["bumper_front", "hood", "fender_fl", "fender_fr"],     isPredefined: true },
    { id: "all_doors",     label: "All Doors",       zoneIds: ["door_fl", "door_fr", "door_rl", "door_rr"],           isPredefined: true },
    { id: "both_sides",    label: "Both Sides",      zoneIds: ["fender_fl", "fender_fr", "door_fl", "door_fr", "door_rl", "door_rr", "rocker_l", "rocker_r"], isPredefined: true },
  ] as ZoneGroup[],
  defaultColor: "#ffffff",
  thumbnail: "/thumbnails/car-sedan.png",
},
```

### File 3: `src/lib/store.ts`

The store already handles `canvasZones` generically via the `allSurfaces` helper:

```ts
function allSurfaces(template: (typeof templates)[0]): string[] {
  return [
    ...template.surfaces,
    ...(template.canvasZones?.map((z) => z.id) ?? []),
  ];
}
```

This merges `surfaces` (["body"]) with all `canvasZones` ids to initialize `surfaceTextures`. No per-model changes needed IF this helper exists. Verify it does.

### File 4: `src/components/models/PackagingModel.tsx`

**Do NOT reconstruct this component from scratch. Copy `BmwX5mModel` verbatim and make exactly 4 changes:**

1. **Function name**: `BmwX5mModel` → `YourCarModel`
2. **GLB path** in `useGLTF()` and `useGLTF.preload()`: `"/models/2016_bmw_x5m_panels.glb"` → `"/models/your-car_panels.glb"`
3. **Carpaint material name** in `useMemo` traverse: `=== "carpaint"` → `=== "your_material_name"` (whatever you found in Stage 1)
4. **Trim material tagging** in `useMemo` traverse: change `=== "phong9"` to your trim material name, or add/remove additional `else if` blocks for other materials you discovered in Stage 4

That is it. The entire `useEffect` (~180 lines covering composite texture cache, world-space UV bake loop, UV restore loop, autoFlipU XOR userMirror logic, selection highlight, emissive glow) is generic — it contains no car-specific logic and works unchanged for any new model.

**Why verbatim copy matters:** The useEffect has subtle state (the `compositeCache` ref key, the `zonesWithPasteUV` set, the UV save/restore in `geometry.userData.originalUV`). Reconstructing it from a prose description will introduce hard-to-debug bugs. Copy it.

The `useMemo` structure for reference (only the traverse logic changes):

```tsx
const clonedScene = useMemo(() => {
  const cloned = scene.clone(true);
  cloned.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    if ((mesh.material as any).transmission > 0) {
      // Glass: neutralize to avoid WebGL corruption
      mesh.material = new THREE.MeshPhysicalMaterial({
        color: "#aaccff", roughness: 0.05, metalness: 0,
        transparent: true, opacity: 0.25,
      });
    } else if ((mesh.material as THREE.Material).name === "carpaint") {
      // ← CHANGE THIS to your body material name
      mesh.userData.surface = mesh.name; // mesh.name = panel id from split script
    } else if ((mesh.material as THREE.Material).name === "phong9") {
      // ← CHANGE THIS to your trim material name (from Stage 4)
      mesh.userData.surface = "trim";
    }
    // Add more else-if blocks for any other materials that should be selectable
  });
  return cloned;
}, [scene]);
```

Then add to `PackagingModelSwitch` and `useGLTF.preload`:

```tsx
case "your-car-id":
  return <YourCarModel />;
```
```tsx
useGLTF.preload("/models/your-car_panels.glb");
```

### File 5: `src/components/editor/EditorViewport.tsx`

Add the template id to the vehicle detection so the camera position is correct:

```ts
const isVehicle = activeTemplateId.startsWith("car-")
  || activeTemplateId === "porsche-911"
  || activeTemplateId === "bmw-x5m";
```

### Also Check: LeftSidebar.tsx / RightSidebar.tsx

The sidebar renders `canvasZones` from the template automatically IF the generic zone-rendering code already exists. Verify that it reads `template.canvasZones` and renders a clickable zone list. If it does, no changes are needed for new models.

---

## Stage 4: Non-Carpaint Material Discovery

**Important:** The `"trim"` zone (and any other non-carpaint zones) are NOT produced by the split script. The split script only handles the carpaint body mesh. Non-carpaint meshes remain in the GLB unchanged — they are tagged as selectable zones exclusively in the React component's `useMemo` traverse (File 4 above). Do not add trim to the split script's panel definitions.

After the split script, traverse the GLB and identify every non-carpaint material. For each one, decide:

| Material behavior | Action in `clonedScene.traverse` |
|---|---|
| `transmission > 0` (glass) | Replace with transparent `MeshPhysicalMaterial` (opacity ~0.25) to avoid WebGL corruption |
| Named trim material (e.g., `"phong9"`) | Tag with `mesh.userData.surface = "trim"` to make it a selectable zone |
| Chrome / wheels / rubber / interior | Leave untouched (no `userData.surface` = not selectable, not affected by color/texture) |

The material name for trim WILL vary between models. Use the GLB inspector output from Stage 1 to find it. In the BMW X5M, 99 meshes used material `"phong9"` for B-pillar, window surrounds, door frames, and A-pillar trim -- these were all grouped under the single zone `"trim"`.

If a non-carpaint material should be wrappable (e.g., the bumper is a separate material on some models), tag it with `mesh.userData.surface = mesh.name` just like carpaint panels.

---

## Stage 5: Verification Checklist

Run `npm run dev` (or `./dev.sh`) and navigate to the editor with the new template.

1. **All panels render** -- no missing geometry, no floating fragments
2. **Click each panel** -- the zone name appears in the sidebar; the panel highlights red
3. **Upload an image to a single panel** -- it maps correctly, fills the panel, no clipping
4. **Upload to a multi-zone group** (e.g., Racing Stripe) -- image spans across panels seamlessly
5. **Change base color** -- all undecorated panels change; decorated panels keep their image
6. **Toggle finish** (matte/glossy/metallic) -- clearcoat changes visually
7. **Glass is transparent** and not corrupted (no black rectangles)
8. **Trim panels** respond to color changes as a group
9. **body_misc** catches the remaining body triangles and is independently selectable
10. **No console errors** about missing textures or NaN UVs

---

## The 3 Critical Gotchas

### GOTCHA 1: Zero-Triangle Zones

If a panel zone definition captures zero triangles, the script creates no mesh for it. The `canvasZones` entry in `templates.ts` will reference a zone id that has no corresponding mesh in the GLB. This causes:
- The zone appears in the sidebar but clicking it selects nothing
- No visual highlight, no texture mapping
- No crash -- it silently fails

**Detection**: Check the split script console output. Every panel should print a non-zero triangle count:
```
  hood          : 2847 tris
  roof          : 1203 tris
  ...
```

If a zone shows 0 tris, adjust thresholds. Common causes: the zone boundaries are too tight, or the axis convention is inverted (some models have Z pointing forward, others have Z pointing backward).

### GOTCHA 2: Parent Node Hierarchy (100x Scale Bug)

Sketchfab GLBs frequently have a node hierarchy like:
```
Sketchfab_model (root)
  └─ Node (scale: [100, 100, 100])
      └─ carpaint_mesh
      └─ glass_mesh
      └─ trim_mesh
```

If the split script attaches new panel nodes to the **scene root** instead of the scaled parent node, the panels will appear 100x too large (or too small) compared to the rest of the car.

**The fix is already in the split script**: it walks the node tree to find the parent of the carpaint mesh node and attaches new panel nodes there:

```js
let parentContainer = null;
for (const node of doc.getRoot().listNodes()) {
  if (node.listChildren().some(c => c === targetMeshNode)) {
    parentContainer = node;
    break;
  }
}
```

**Always verify** this parent detection worked by checking the console output: `Carpaint node parent: <name>`. If it says "scene root" on a Sketchfab model, something is wrong.

Additionally, the React component scale must account for the GLB's own scale. The BMW X5M uses `scale={[35, 35, 35]}` to make the model the right viewport size. Other models use different scales (e.g., the Porsche 911 uses `scale={[0.015, 0.015, 0.015]}`). This depends entirely on the source model's coordinate system.

### GOTCHA 3: UV Atlas Inheritance

The split script deliberately discards the original UV atlas from the GLB and generates fresh planar-projected UVs per panel. This is correct and intentional. The original GLB UVs are typically:
- A shared atlas across the entire body (image of the car's paint job)
- Or completely absent on carpaint meshes (solid color, no texture needed)

Neither is useful for per-panel artwork pasting. The planar projection ensures each panel's UV space fills [0,1]x[0,1], so an uploaded image fills the entire panel.

**However**, when single-paste mode spans multiple panels, the per-panel UVs must be REPLACED at runtime with world-space projected UVs so the image is continuous across panels. This is handled in `PackagingModel.tsx`:

```ts
// For each zone in the paste group, project world-space UVs
for (let i = 0; i < count; i++) {
  vertex.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
  m.localToWorld(vertex);
  const rawU = (c(vertex, uCoord) - groupMinU) / groupExtU;
  newUVData[i * 2 + 0] = flipU ? 1 - rawU : rawU;
  newUVData[i * 2 + 1] = (c(vertex, vCoord) - groupMinV) / groupExtV;
}
```

The original per-panel UVs are saved in `geometry.userData.originalUV` and restored when single-paste is deactivated. If this save/restore is broken, panels will keep world-space UVs permanently, causing individual-panel artwork to render incorrectly.

Also note the `autoFlipU` logic for left-side panels: when the combined bounding box center X < 0 (left side of car), U is inverted so text reads correctly when viewed from outside. This is XOR'd with the user's `mirrorX` setting.

---

## Full File Manifest

For a new car model named `{car}`, you will touch:

| File | Action |
|---|---|
| `public/models/{car}.glb` | Human provides this |
| `scripts/split-{car}-panels.mjs` | Copy `scripts/split-bmw-panels.mjs`, change: `INPUT`, `OUTPUT`, `TARGET_MAT`, and the `PANELS` threshold array |
| `public/models/{car}_panels.glb` | Generated by the split script |
| `src/lib/types.ts` | Verify types exist (no changes if BMW was done first) |
| `src/lib/templates.ts` | Add template entry with `canvasZones` and `zoneGroups` |
| `src/lib/store.ts` | Verify `allSurfaces` helper exists (no changes if BMW was done first) |
| `src/components/models/PackagingModel.tsx` | Add model component + `PackagingModelSwitch` case + `useGLTF.preload` |
| `src/components/editor/EditorViewport.tsx` | Add template id to `isVehicle` check |
| `src/components/editor/LeftSidebar.tsx` | Verify zone rendering works generically (likely no changes) |

---

## Threshold Iteration Strategy

The normalized bounding-box thresholds are the hardest part. Here is the process:

1. Run the GLB inspector to get the bounding box extents and axis convention.
2. Start with generous zones (bumpers at z < 0.12 / z > 0.88, hood at y > 0.65, etc.).
3. Run the split script and check triangle counts. If `body_misc` has too many triangles, tighten zones. If a named panel has too few, loosen its bounds.
4. Load in the browser. Visually inspect each panel by clicking it (the red highlight reveals exact boundaries).
5. Iterate. Common adjustments:
   - Door Y-max creeping into roof territory (lower the roof Y threshold or raise the door Y-max)
   - Fender Z range overlapping with door Z range (tighten the fender's Z-end)
   - A-pillar triangles landing in hood instead of body_misc (tighten hood's X range)

**Do not expect to get thresholds right on the first try.** Plan for 3-5 rounds. The `body_misc` fallback catches anything that escapes all named zones, so the model always renders completely even with imperfect thresholds -- it is just a matter of which triangles are in which selectable zone.

---

## Summary: What the Human Provides vs. What the Agent Does

| Human provides | Agent does everything else |
|---|---|
| The `.glb` file | Inspect it, write the split script, tune thresholds, wire all 5 files, verify |

**One honest caveat:** threshold tuning (Stage 2 iteration) requires loading the model in the browser and visually inspecting which triangles landed in which zone by clicking panels. This is the one step that is genuinely iterative — an agent can do it autonomously using Playwright MCP to take screenshots and inspect click targets, but it cannot be skipped. Expect 3-5 browser-inspect-and-adjust cycles before panel boundaries are clean.
