# AGENT GUIDE — GLB to Canvas Zone Pipeline (Dihedral Angle Detection)

**Audience:** AI agent executing this pipeline autonomously
**Goal:** Convert a raw car GLB into a per-zone-mesh GLB with clickable, paintable panel zones in the MockBox wrap editor
**Reference models:** BMW X5M, Porsche 911 Targa 4S

---

## How It Works (Read This First)

Car modelers add sharp creases at real panel seam lines (where hood meets fender, where doors meet body, etc.). These creases create mesh edges with high dihedral angles (25°+), while smooth panel surfaces have near-0° angles. We detect those sharp edges, flood-fill connected faces between them, and merge small clusters into ~20 initial zones. After review and renaming, we split the combined mesh into **separate mesh objects per zone** — one mesh named "hood", one named "door_l", etc. — which Three.js renders as individually paintable panels.

```
Input:  Raw car GLB with arbitrary mesh structure
Output: ${MODEL_NAME}_panels.glb with per-zone mesh objects + face_to_zone.json
```

### Architecture: Per-Zone Mesh Objects (NOT UV Masks)

The pipeline produces a GLB where each body panel is a **separate Three.js mesh object**. This is critical:

- Each mesh is named by zone (`hood`, `roof`, `door_l`, etc.)
- All zone meshes share the `carpaint` material name
- The model component detects zones via `mesh.material.name === "carpaint"` and sets `mesh.userData.surface = mesh.name`
- Per-zone colors, textures, highlights, and click detection all work through mesh identity — no UV masks, no canvas textures, no shared atlas

This is the same architecture used by the Porsche 911 and BMW X5M in production. Do **not** use the old `usePanelMasks` canvas texture approach — it produces scattered UV fragments and visible seam artifacts.

---

## Prerequisites

- Blender 5.x (or 4.x) installed
- Python 3 with PIL/numpy
- All pipeline scripts exist in `pipeline/` directory
- `.env.pipeline` filled in with MODEL_NAME, GLB_INPUT, OUTPUT_DIR, BLENDER

### Bootstrap (run once per machine or new model)

```bash
# Edit .env.pipeline first:
#   MODEL_NAME=your_car_name
#   GLB_INPUT=/absolute/path/to/your_car.glb

bash pipeline/bootstrap.sh
source .env.pipeline
```

Bootstrap auto-detects Blender, installs PIL into Blender's Python, creates output directories. All items must show `[PASS]` before proceeding.

---

## Step 1 — Inspect and Render the GLB

```bash
source .env.pipeline
$BLENDER --background --python pipeline/step1_inspect.py
```

**What it does:** Imports the GLB, generates `mesh_manifest.json` (lists every mesh, its materials, vertex count, bounding box), auto-detects the carpaint material name, renders 7 camera angles.

**Output:**
- `$OUTPUT_DIR/mesh_manifest.json`
- `$OUTPUT_DIR/renders/*.png` (7 views: front, rear, left, right, top, front-left, front-right)

**Verify:**
1. `mesh_manifest.json` has a non-empty `carpaint_meshes` array
2. `carpaint_material_name` is detected (e.g., `"carpaint"`)
3. If null: manually inspect the manifest, find the correct material, edit `carpaint_material_name`

---

## Step 2 — Vision Analysis: Name Mapping

```bash
source .env.pipeline
python3 pipeline/step2_vision.py
```

**What it does:** Prints a summary of all carpaint meshes and writes template `name_mapping.json` with `"???"` placeholders.

**Agent action (CRITICAL):** Open the rendered images from step 1. Identify which mesh corresponds to which car panel. Edit `$OUTPUT_DIR/name_mapping.json` to fill in the mappings.

**Valid zone names:** `hood`, `roof`, `trunk`, `bumper_front`, `bumper_rear`, `fender_fl`, `fender_fr`, `door_fl`, `door_fr`, `door_rl`, `door_rr`, `rocker_l`, `rocker_r`, `body_misc`, `trim`

**Tips:**
- Use bounding box centers from the manifest to reason about position
- `_fl`/`_rl`/`_l` = left (driver) side, `_fr`/`_rr`/`_r` = right (passenger) side
- Multiple meshes can map to the same zone name
- Unmapped meshes should be `body_misc` or `trim`

---

## Step 3 — UV Unwrap into Shared Atlas

```bash
source .env.pipeline
$BLENDER --background --python pipeline/step3_uv_unwrap.py
```

**What it does:**
1. Tags each face with an `origin_idx` attribute (identifies which object it came from)
2. Temporarily joins all carpaint meshes into one object
3. Marks seams at sharp edges (>35°) + boundary edges
4. UV unwraps the combined mesh (all islands pack into one [0,1] space)
5. Saves `step3_unwrapped.blend` (used by all subsequent steps)

**Output:**
- `$OUTPUT_DIR/step3_unwrapped.blend`
- `$OUTPUT_DIR/origin_map.json`
- `$OUTPUT_DIR/validation/checker_*.png` (UV quality check)

**Verify:** Check checker renders — the checker pattern should be relatively uniform. Some stretching on curved surfaces is acceptable. Severe stretching on flat panels = re-run with different seam angles.

---

## Step 4c — Dihedral Angle Edge Detection (Canvas Zone Creation)

This is the core step. It replaces the old step4/step4b spatial heuristics.

```bash
source .env.pipeline
$BLENDER --background --python pipeline/step4c_seed_vertex_groups.py
```

**What it does:**
1. Opens `step3_unwrapped.blend`, finds the carpaint mesh
2. Computes dihedral angle at every internal mesh edge
3. Marks edges above `ANGLE_THRESHOLD` (default 25°) as zone boundaries
4. Flood-fills connected components between boundaries (BFS)
5. Iteratively merges the smallest cluster into its best neighbor until `TARGET_ZONES` (default 20) remain
6. Isolated clusters (no shared edges) merge into spatially nearest zone
7. Auto-labels zones by normalized bounding-box position
8. Creates Blender vertex groups + color-coded faces
9. Saves `face_to_zone.json` — the reliable face-to-zone mapping
10. Renders 7 color-coded validation views

**Environment variable tuning:**

| Variable | Default | Effect |
|---|---|---|
| `ANGLE_THRESHOLD` | `25` | Lower = more initial clusters (sensitive). Higher = fewer (coarse). |
| `TARGET_ZONES` | `20` | Final zone count after merging. Typical car: 15-25. |

```bash
# Examples:
ANGLE_THRESHOLD=15 $BLENDER --background --python pipeline/step4c_seed_vertex_groups.py  # more zones
TARGET_ZONES=16 $BLENDER --background --python pipeline/step4c_seed_vertex_groups.py     # fewer final zones
```

**Output:**
- `$OUTPUT_DIR/step4c_seeded.blend` — blend file with vertex groups and color-coded faces
- `$OUTPUT_DIR/face_to_zone.json` — `{"0": "bumper_front", "1": "bumper_front", ...}` mapping
- `$OUTPUT_DIR/validation/seed_*.png` — 7 color-coded validation renders

---

## Step 4c-verify — Generate Verification Images

Three types of verification images. Run all three:

### UV Zone Images (per-zone UV triangle footprints)

```bash
source .env.pipeline
$BLENDER --background --python pipeline/render_uv_zones.py
```

**Output:** `$OUTPUT_DIR/validation/uv_zones/` — one image per zone showing its UV triangles + `_all_zones.png` combined view.

**What to look for:** Coverage gaps, stray triangles, shape coherence.

### UV Context Images (zone + neighbors in UV space)

```bash
source .env.pipeline
$BLENDER --background --python pipeline/render_uv_context.py
```

**Output:** `$OUTPUT_DIR/validation/uv_context/` — each zone bright with UV-proximity neighbors dimmed and labeled, cropped to region.

**What to look for:** Zone adjacency, relative sizes, label correctness.

### 3D Zone Images (zone highlighted on real car)

```bash
source .env.pipeline
python3 pipeline/render_zone_3d.py
```

**Output:** `$OUTPUT_DIR/validation/zone_3d/` — each zone highlighted orange on dim car body, camera aimed from zone's average normal.

**What to look for:** Does the zone boundary match the real panel seam? Is the auto-label correct?

**IMPORTANT:** This script spawns one separate Blender process per zone. This is required because EEVEE in background mode won't refresh material_index changes within a single session.

---

## Step 4c-review — Show Results to User

**Show the user these images for review:**

1. `validation/seed_left.png` and `validation/seed_front_right.png` — full color-coded car from two angles
2. `validation/uv_zones/_all_zones.png` — combined UV atlas with all zones
3. 4-5 images from `validation/zone_3d/` — per-zone 3D highlights (pick the largest/most important zones)
4. List all zone names with face counts (from `face_to_zone.json`)

**Wait for user feedback.** They will tell you:
- Which zones to **rename** (e.g., `cluster_2` → `hood`)
- Which zones to **merge** (e.g., `bumper_rear_1` into `bumper_rear`)
- Which zone boundaries need **face reassignment**
- Whether to re-run with different ANGLE_THRESHOLD or TARGET_ZONES

---

## Step 4c-fix — Manual Refinement in Blender (User Does This)

If the user wants to fix zones manually:

1. Open: `$BLENDER $OUTPUT_DIR/step4c_seeded.blend`
2. Select the carpaint mesh → Tab into Edit Mode → press `3` for Face Select
3. Properties panel → Object Data (green triangle icon) → Vertex Groups
4. Click a zone name → **Select** to see its faces
5. To fix: select wrong faces → click correct zone → **Assign** → click old zone → **Remove**
6. To rename: double-click zone name → type new name
7. **Ctrl+S** to save

After manual fixes, re-run verification images if needed, then proceed to step 4e.

---

## Step 4e — Rename and Merge Zones (Post-Processing)

**This step is REQUIRED before step 5.** The dihedral detection produces auto-generated names like `cluster_8`, `bumper_rear_1`, `door_r_l_2`, etc. These must be renamed to clean panel names and small fragments merged into their parent zones.

### 4e.1 — Build a rename/merge mapping

Review ALL images in `$OUTPUT_DIR/validation/zone_3d/` to identify each zone visually. Build a Python dict mapping old auto-names to new clean names. Zones that map to the **same** new name get merged.

**Naming conventions:**
- `hood` — front hood/frunk lid
- `roof` — roof panel
- `engine_lid` or `trunk` — rear deck lid (engine lid for rear-engine cars, trunk for sedans/SUVs)
- `tailgate` — rear hatch/liftgate (SUVs)
- `bumper_front` — entire front bumper (merge all `bumper_front_*` variants)
- `bumper_rear` — entire rear bumper (merge all `bumper_rear_*` variants)
- `fender_f_l` / `fender_f_r` — front fenders (left/right)
- `quarter_r_l` / `quarter_r_r` — rear quarter panels (left/right)
- `door_l` / `door_r` — doors (merge door panels + side markers + mirrors into one per side)
- `rocker_l` / `rocker_r` — rocker panels / side skirts
- `body_misc` — catch-all for unmapped remnants

**Typical merges (examples from real models):**

BMW X5M (20 → 12 zones):
```python
rename = {
    "cluster_2": "hood",
    "bumper_rear_1": "bumper_rear",  # merge lower bumper into rear bumper
    "fender_f_r_1": "fender_f_r",   # merge lower fender into fender
    "trunk": "tailgate",
    "trunk_1": "tailgate",          # merge both trunk halves
    "trunk_2": "tailgate",
}
```

Porsche 911 (20 → 11 zones):
```python
rename = {
    "cluster_8": "hood",
    "trunk": "engine_lid",           # rear-engine car
    "bumper_rear_1": "bumper_rear",  # merge 4 rear bumper sections
    "bumper_rear_2": "bumper_rear",
    "bumper_rear_3": "bumper_rear",
    "door_r_l": "quarter_r_l",      # rear side panel = quarter panel
    "door_r_r": "quarter_r_r",
    "door_r_l_1": "door_l",         # actual door
    "door_r_r_1": "door_r",
    "door_r_l_2": "door_l",         # merge side markers into door
    "door_r_r_2": "door_r",
    "door_f_l": "door_l",           # merge mirrors into door
    "door_f_r": "door_r",
    "door_f_l_1": "door_l",         # merge A-pillar trim into door
    "door_f_r_1": "door_r",
}
```

### 4e.2 — Apply the rename to face_to_zone.json

```python
python3 -c "
import json
from collections import Counter

with open('$OUTPUT_DIR/face_to_zone.json') as f:
    f2z = json.load(f)

rename = {
    # ... your mapping here — EVERY auto-name must appear as a key ...
    # zones that keep their name: 'bumper_front': 'bumper_front',
    # zones that rename: 'cluster_8': 'hood',
    # zones that merge:  'bumper_rear_1': 'bumper_rear',
}

new_f2z = {}
for face_idx, zone in f2z.items():
    new_f2z[face_idx] = rename.get(zone, 'body_misc')

# Print result
c = Counter(new_f2z.values())
for z, n in sorted(c.items(), key=lambda x: -x[1]):
    print(f'  {z:20s}: {n:5d} faces')

with open('$OUTPUT_DIR/face_to_zone.json', 'w') as f:
    json.dump(new_f2z, f)
print('Saved')
"
```

**Verify:** The output should show 10-15 clean zone names with reasonable face counts. No `cluster_*` or `_1`/`_2` suffixes should remain.

### 4e.3 — Apply the rename to vertex groups in Blender

This updates the blend file so step 5 can read the correct vertex groups.

```bash
$BLENDER --background $OUTPUT_DIR/step4c_seeded.blend --python-expr "
import bpy

rename = {
    # ... same mapping as above ...
}

carpaint = None
for obj in bpy.data.objects:
    if obj.type == 'MESH' and 'carpaint' in obj.name.lower():
        carpaint = obj
        break

# Create target groups if they don't exist
target_names = set(rename.values())
existing = {vg.name for vg in carpaint.vertex_groups}
for target in target_names:
    if target not in existing:
        carpaint.vertex_groups.new(name=target)

# Merge source groups into targets
for old_name, new_name in rename.items():
    if old_name == new_name:
        continue
    src_vg = carpaint.vertex_groups.get(old_name)
    if not src_vg:
        continue
    dst_vg = carpaint.vertex_groups.get(new_name)
    if not dst_vg:
        continue
    src_idx = src_vg.index
    verts = [v.index for v in carpaint.data.vertices
             for g in v.groups if g.group == src_idx and g.weight > 0.5]
    if verts:
        dst_vg.add(verts, 1.0, 'ADD')
    carpaint.vertex_groups.remove(src_vg)
    print(f'  {old_name} -> {new_name} ({len(verts)} verts)')

print(f'Final groups: {[vg.name for vg in carpaint.vertex_groups]}')
bpy.ops.wm.save_mainfile()
"
```

**Verify:** The output should list only the clean zone names. No auto-generated names should remain.

---

## Step 5 — Split Combined Mesh into Per-Zone GLB

```bash
source .env.pipeline
MODEL_NAME=$MODEL_NAME OUTPUT_DIR=$OUTPUT_DIR \
  $BLENDER --background --python pipeline/step5_export.py
```

**What it does:**
1. Opens `step4c_seeded.blend`
2. Reads `face_to_zone.json` (the renamed/merged version from step 4e)
3. For each zone, creates a separate mesh object containing only that zone's faces
4. Names each mesh object with the zone name (e.g., `hood`, `door_l`)
5. Applies a shared `carpaint` Principled BSDF material to all zone meshes
6. Removes the original `carpaint_combined` mesh
7. Un-hides all objects (non-carpaint meshes like glass, wheels, trim are preserved)
8. Exports everything as `public/models/${MODEL_NAME}_panels.glb`

**Output:**
- `public/models/${MODEL_NAME}_panels.glb` — final GLB with per-zone mesh objects

**Verify:**
```bash
# Quick check: list mesh names in the exported GLB
$BLENDER --background --python-expr "
import bpy
bpy.ops.import_scene.gltf(filepath='public/models/${MODEL_NAME}_panels.glb')
for obj in bpy.data.objects:
    if obj.type == 'MESH' and len(obj.data.vertices) > 50:
        mats = [m.name for m in obj.data.materials if m]
        print(f'{obj.name:25s}: {len(obj.data.polygons):6d} faces, mats={mats}')
" 2>/dev/null | grep -v '^$'
```

You should see:
- Zone meshes named `hood`, `roof`, `door_l`, etc. with material `['carpaint']`
- Non-carpaint meshes (`glass`, `tire`, `chassis`, etc.) with their original materials
- Face counts matching what `face_to_zone.json` reports per zone

---

## Step 6 — Three.js Integration

The model component follows the **per-zone mesh** pattern (same as `Porsche911PanelsModel` and `BmwX5mModel`). There are NO UV masks, NO canvas textures, NO shared atlas. Each zone is a separate mesh object with its own material.

### 6.1 — Add the model component to PackagingModel.tsx

```typescript
// ---- ${CAR_NAME} (GLB) — per-zone mesh objects ----
export function ${ComponentName}Model() {
  const { scene } = useGLTF("/models/${MODEL_NAME}_panels.glb");
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const selectedZoneIds = useEditorStore((s) => s.selectedZoneIds);
  const toggleZoneInSelection = useEditorStore((s) => s.toggleZoneInSelection);
  const multiSelectMode = useEditorStore((s) => s.multiSelectMode);
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);
  const dropHoverZone = useEditorStore((s) => s.dropHoverZone);
  const textures = useLoadedTextures(surfaceTextures);
  const compositeCacheRef = useRef<Map<string, THREE.CanvasTexture>>(new Map());

  const clonedScene = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const matName = (mesh.material as THREE.Material).name;
      if ((mesh.material as any).transmission > 0) {
        mesh.material = new THREE.MeshPhysicalMaterial({
          color: "#aaccff", roughness: 0.05, metalness: 0,
          transparent: true, opacity: 0.25,
        });
      } else if (matName === "carpaint") {
        // Zone mesh objects are named by zone (hood, roof, door_l, etc.)
        mesh.userData.surface = mesh.name;
      }
    });
    return cloned;
  }, [scene]);

  // Apply per-zone materials
  useEffect(() => {
    const clearcoat = finish === "glossy" ? 1.0 : finish === "metallic" ? 0.5 : 0.1;
    const clearcoatRoughness = finish === "glossy" ? 0.05 : 0.3;
    const compositeCache = compositeCacheRef.current;

    clonedScene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const zoneName: string | undefined = mesh.userData.surface;
      if (!zoneName) return;

      const surf = surfaceTextures[zoneName];
      const zoneColor = surf?.color ?? baseColor;
      const rawTex = textures[zoneName] ?? null;
      const isSelected = selectedZoneIds.includes(zoneName);
      const isActive = activeSurface === zoneName;

      // Composite artwork over zone color background
      let mapTex: THREE.Texture | null = rawTex;
      if (rawTex) {
        const effectiveBg = surf?.color ?? baseColor;
        const key = `${surf?.imageUrl}:${effectiveBg}`;
        if (!compositeCache.has(key)) {
          const img = rawTex.image as HTMLImageElement | HTMLCanvasElement;
          const w = (img as HTMLImageElement).naturalWidth || img.width || 512;
          const h = (img as HTMLImageElement).naturalHeight || img.height || 512;
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = effectiveBg;
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const ct = new THREE.CanvasTexture(canvas);
          ct.colorSpace = THREE.SRGBColorSpace;
          ct.flipY = rawTex.flipY;
          ct.wrapS = rawTex.wrapS; ct.wrapT = rawTex.wrapT;
          compositeCache.set(key, ct);
        }
        mapTex = compositeCache.get(key)!;
      }

      if (mapTex && surf) {
        const s = surf.scale || 1;
        mapTex.repeat.set(surf.mirrorX ? -1 / s : 1 / s, 1 / s);
        mapTex.offset.set(surf.offsetX, surf.offsetY);
        mapTex.rotation = surf.rotation;
        mapTex.center.set(0.5, 0.5);
        mapTex.needsUpdate = true;
      }

      const displayColor = new THREE.Color(zoneColor);
      if (isSelected && !rawTex) {
        displayColor.lerp(new THREE.Color("#ff2200"), isActive ? 0.72 : 0.55);
      }
      const matColorHex = rawTex ? "#ffffff" : "#" + displayColor.getHexString();
      const matProps = getMaterialProps(finish, matColorHex);
      const hasTexture = rawTex !== null;

      mesh.material = new THREE.MeshPhysicalMaterial({
        ...matProps, clearcoat, clearcoatRoughness,
        map: mapTex,
        emissive: new THREE.Color(
          dropHoverZone === zoneName ? "#0044ff" :
          !hasTexture && isActive ? "#ff3300" :
          !hasTexture && isSelected ? "#cc2200" : "#000000"
        ),
        emissiveIntensity:
          dropHoverZone === zoneName ? 0.5 :
          !hasTexture && isActive ? 0.45 :
          !hasTexture && isSelected ? 0.32 : 0,
      });
    });
  }, [clonedScene, baseColor, finish, activeSurface, selectedZoneIds,
      textures, surfaceTextures, dropHoverZone]);

  const handleClick = (e: any) => {
    e.stopPropagation();
    const mesh = e.object as THREE.Mesh;
    const zone = mesh.userData.surface as string | undefined;
    if (!zone) return;
    if (multiSelectMode || e.nativeEvent?.shiftKey) {
      toggleZoneInSelection(zone);
    } else if (activeSurface === zone && selectedZoneIds.length === 1) {
      setActiveSurface("body");
    } else {
      setActiveSurface(zone);
    }
  };

  return (
    <>
      <group scale={[SCALE, SCALE, SCALE]} position={[0, -0.45, 0]}>
        <primitive object={clonedScene} onClick={handleClick} />
      </group>
      <StickerLayer parentScene={clonedScene} />
    </>
  );
}
useGLTF.preload("/models/${MODEL_NAME}_panels.glb");
```

**CRITICAL — StickerLayer placement:**
- `<StickerLayer>` must be a **sibling** of the `<group>`, NOT a child
- It lives OUTSIDE the `<group scale={...}>` wrapper
- DecalGeometry uses world-space coordinates; nesting it inside a scaled group would break sticker positioning
- Use `<>...</>` (Fragment) to wrap both elements

**Scale value:** Depends on the GLB's native units. Check by loading the GLB and inspecting world-space bounding box. Typical values:
- BMW X5M: `scale={[35, 35, 35]}` (model is ~0.03 units)
- Porsche 911: `scale={[0.015, 0.015, 0.015]}` (model is ~300 units)

### 6.2 — Add template entry in src/lib/templates.ts

```typescript
{
  id: "${template-id}",
  name: "${Car Name}",
  category: "vehicles",
  description: "${Year Make Model} — full body wrap with panel canvas zones",
  surfaces: ["body"],
  canvasZones: [
    // MUST match the zone names in face_to_zone.json exactly
    { id: "hood",          label: "Hood" },
    { id: "roof",          label: "Roof" },
    { id: "engine_lid",    label: "Engine Lid" },
    { id: "bumper_front",  label: "Front Bumper" },
    { id: "bumper_rear",   label: "Rear Bumper" },
    { id: "fender_f_l",   label: "Front Left Fender" },
    { id: "fender_f_r",   label: "Front Right Fender" },
    { id: "quarter_r_l",  label: "Rear Left Quarter" },
    { id: "quarter_r_r",  label: "Rear Right Quarter" },
    { id: "door_l",        label: "Left Door" },
    { id: "door_r",        label: "Right Door" },
  ],
  zoneGroups: [
    { id: "racing_stripe",  label: "Racing Stripe",   zoneIds: ["hood", "roof", "engine_lid"],            isPredefined: true },
    { id: "full_left",      label: "Full Left Side",  zoneIds: ["fender_f_l", "door_l", "quarter_r_l"],   isPredefined: true },
    { id: "full_right",     label: "Full Right Side", zoneIds: ["fender_f_r", "door_r", "quarter_r_r"],   isPredefined: true },
    { id: "both_doors",     label: "Both Doors",      zoneIds: ["door_l", "door_r"],                       isPredefined: true },
  ] as ZoneGroup[],
  defaultColor: "#ffffff",
  thumbnail: "/thumbnails/car-sedan.png",
},
```

### 6.3 — Add case in PackagingModelSwitch

```typescript
case "${template-id}":
  return <${ComponentName}Model />;
```

### 6.4 — Add icon mappings

In `LeftSidebar.tsx`, `TemplateShowcase.tsx`, and `TemplateGrid.tsx`, add the template ID to the icon mapping objects.

---

## Key Technical Gotchas

### Per-zone mesh objects (NOT UV masks)
The old pipeline (step 4d) generated UV-space mask PNGs and used a `usePanelMasks` canvas texture hook. **This approach is deprecated.** It produces scattered UV triangle fragments because the UV unwrapping scatters each panel's faces across the atlas. The current approach uses per-zone mesh objects (step 5) — each zone is a separate Three.js mesh, enabling simple per-mesh materials with no UV mask artifacts.

### StickerLayer must be OUTSIDE the scaled group
```tsx
// CORRECT:
<>
  <group scale={[35, 35, 35]}>
    <primitive object={clonedScene} onClick={handleClick} />
  </group>
  <StickerLayer parentScene={clonedScene} />  {/* sibling */}
</>

// WRONG — breaks sticker positioning:
<group scale={[35, 35, 35]}>
  <primitive object={clonedScene} onClick={handleClick} />
  <StickerLayer parentScene={clonedScene} />  {/* child of scaled group */}
</group>
```

### face_to_zone.json is the source of truth
Step 5 reads `face_to_zone.json` to determine which faces belong to which zone. The vertex groups in the blend file are secondary — they're used for visualization in Blender but step 5 ignores them in favor of the JSON. Always update `face_to_zone.json` first (step 4e.2), then the vertex groups (step 4e.3).

### Zone rename must happen BEFORE step 5
Step 5 reads `face_to_zone.json` and creates mesh objects named by zone. If you run step 5 with auto-generated names like `cluster_8`, the GLB will have meshes named `cluster_8` — which won't match your template's `canvasZones`. Always complete step 4e before step 5.

### Disconnected mesh islands
The carpaint mesh is made of disconnected islands — zones have **zero shared mesh edges** between them. This is normal. The dihedral clustering exploits this: boundary edges between panels have high angles, internal edges are smooth.

### EEVEE background rendering limitation
EEVEE won't refresh `material_index` changes between renders in a single Blender session. `render_zone_3d.py` handles this by spawning **one Blender process per zone**.

### Blender 5.x compatibility
- `BLENDER_EEVEE_NEXT` was renamed to `BLENDER_EEVEE` in Blender 5.x. Step4c uses `BLENDER_EEVEE`.
- `Material.use_nodes = True` shows deprecation warning but still works.
- Pillow needs `sys.path.insert(0, "~/.blender_pip")` workaround (app bundle is read-only).

### Material name matching
Step 5 creates a material named `"carpaint"`. The model component detects zone meshes via `matName === "carpaint"`. If the original GLB used a different carpaint material name (e.g., `PAINT_COLOR_4`), add both checks:
```typescript
} else if (matName === "carpaint" || matName === "PAINT_COLOR_4") {
    mesh.userData.surface = mesh.name;
}
```

---

## Quick Reference — Full Pipeline Commands

```bash
# 0. Bootstrap
bash pipeline/bootstrap.sh
source .env.pipeline

# 1. Inspect GLB
$BLENDER --background --python pipeline/step1_inspect.py

# 2. Vision analysis (agent fills in name_mapping.json)
python3 pipeline/step2_vision.py
# >>> PAUSE: edit $OUTPUT_DIR/name_mapping.json <<<

# 3. UV unwrap
$BLENDER --background --python pipeline/step3_uv_unwrap.py

# 4c. Dihedral angle zone detection
$BLENDER --background --python pipeline/step4c_seed_vertex_groups.py

# 4c-verify. Generate all verification images
$BLENDER --background --python pipeline/render_uv_zones.py
$BLENDER --background --python pipeline/render_uv_context.py
python3 pipeline/render_zone_3d.py

# >>> PAUSE: show user validation/zone_3d/ images, get feedback <<<

# 4e. Rename and merge zones (REQUIRED)
# 4e.2: Update face_to_zone.json with rename mapping (Python one-liner)
# 4e.3: Update vertex groups in Blender (Blender --python-expr)

# 5. Split into per-zone mesh objects and export GLB
MODEL_NAME=$MODEL_NAME OUTPUT_DIR=$OUTPUT_DIR \
  $BLENDER --background --python pipeline/step5_export.py

# 6. Three.js integration
# - Add model component to PackagingModel.tsx (per-zone mesh pattern)
# - Add template entry to templates.ts with canvasZones
# - Add case to PackagingModelSwitch
# - Add icon mappings to sidebars

# 7. Test
npm run build  # verify no TS errors
# Hard refresh browser, test zone selection + sticker placement
```

---

## Pipeline Summary

| Step | What | Tool | Duration |
|------|------|------|----------|
| 0 | Bootstrap | bash | ~10s |
| 1 | Inspect GLB | Blender | ~30s |
| 2 | Name mapping | Agent vision | ~5min |
| 3 | UV unwrap | Blender | ~60s |
| 4c | Dihedral zone detection | Blender | ~15s |
| 4c-verify | Verification images | Blender + Python | ~3min |
| 4c-review | User reviews zones | Agent shows images | ~5min |
| 4c-fix | Manual refinement (optional) | User in Blender | 0-30min |
| **4e** | **Rename/merge zones** | **Python + Blender** | **~5min** |
| 5 | Split into per-zone GLB | Blender | ~30s |
| 6 | Three.js integration | Code | ~15min |

**Total automated time:** ~5 minutes. **Total with user review:** ~30-60 minutes per model.

---

## What NOT To Do

1. **Do NOT use `usePanelMasks` or canvas textures** — this approach produces scattered UV fragments and visible seam artifacts. Use per-zone mesh objects instead.
2. **Do NOT skip step 4e** — running step 5 with auto-generated zone names produces a GLB with nonsensical mesh names that won't match the template config.
3. **Do NOT put `<StickerLayer>` inside a `<group scale={...}>`** — DecalGeometry uses world-space coordinates; the parent scale would corrupt sticker positioning.
4. **Do NOT skip step 5 and try to use the original GLB** — the original GLB's UV layout doesn't match the pipeline's masks, and the single-mesh structure doesn't support per-zone materials.
5. **Do NOT run step 4d (mask export) for the per-zone mesh approach** — UV masks are only needed for the deprecated canvas texture approach. Step 5 replaces step 4d entirely.
