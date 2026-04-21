# AGENT GUIDE — GLB to Canvas Zone Pipeline (Dihedral Angle Detection)

**Audience:** AI agent executing this pipeline autonomously
**Goal:** Convert a raw car GLB into paintable canvas zones with UV masks, verification images, and Three.js integration code
**Reference model:** BMW X5M (`public/models/bmw_x5m.glb`)

---

## How It Works (Read This First)

Car modelers add sharp creases at real panel seam lines (where hood meets fender, where doors meet body, etc.). These creases create mesh edges with high dihedral angles (25°+), while smooth panel surfaces have near-0° angles. We detect those sharp edges, flood-fill connected faces between them, and merge small clusters into ~20 paintable zones.

```
Input:  Raw car GLB with arbitrary mesh structure
Output: Per-zone UV mask PNGs + verification images + face_to_zone.json
```

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
9. Saves `face_to_zone.json` — the reliable face-to-zone mapping (15303 entries for BMW)
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
- `$OUTPUT_DIR/face_to_zone.json` — `{"0": "hood", "1": "hood", ...}` mapping
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

After manual fixes, re-run verification images if needed, then proceed to step 4d.

---

## Step 4d — Export Final UV Masks

```bash
source .env.pipeline
$BLENDER --background --python pipeline/step4d_export_masks.py
```

**What it does:**
1. Opens `step4c_seeded.blend` (with any manual refinements)
2. Reads vertex groups, rebuilds face-to-zone mapping using majority vote (handles boundary vertex contamination)
3. Extracts UV triangles per zone
4. Generates per-zone UV mask PNGs (2048x2048, white on transparent, dilated 5px for seam gaps)
5. Saves `panel_metadata.json`
6. Copies masks to `public/masks/$MODEL_NAME/`
7. Renders final validation views

**Output:**
- `$OUTPUT_DIR/masks/*.png` — per-zone UV masks
- `$OUTPUT_DIR/panel_metadata.json` — zone metadata for the app
- `public/masks/$MODEL_NAME/*.png` — copies for the web app
- `$OUTPUT_DIR/validation/final_*.png` — final validation renders

---

## Step 5 — Reassemble Final GLB

```bash
source .env.pipeline
$BLENDER --background --python pipeline/step5_export.py
```

**What it does:** Separates the combined mesh back into per-zone objects (using `origin_idx`), renames them to zone names, applies shared carpaint material, exports final GLB.

**Output:**
- `public/models/${MODEL_NAME}_panels.glb` — final GLB with separate carpaint meshes + shared UVs
- Masks copied to `public/masks/$MODEL_NAME/`

**Verify:** Open GLB in Blender — each panel zone is a separate mesh object, all using the same `carpaint` material, with shared UV atlas.

---

## Step 6 — Validate Masks

```bash
source .env.pipeline
python3 pipeline/step6_validate.py
```

**Agent action:** Open each mask PNG. Verify:
- White region looks like a coherent car panel shape
- Edges are reasonably smooth
- No large gaps within a zone
- No stray triangles far from the main cluster

---

## Step 7 — Three.js Integration

The model component needs:

1. **`src/hooks/usePanelMasks.ts`** — shared CanvasTexture hook (already exists if BMW was done before)
2. **Model component** in `PackagingModel.tsx` — follows `BmwX5mAtlasModel` pattern:
   - `useGLTF("/models/${MODEL_NAME}_panels.glb")`
   - `usePanelMasks({ modelName: MODEL_NAME, zones: ZONES })`
   - Set `mesh.userData.surface = mesh.name` for each carpaint mesh
   - Apply shared `panelTexture` as `map` on all carpaint meshes

3. **Template entry** in `src/lib/templates.ts` with `canvasZones` matching zone names
4. **Case in `PackagingModelSwitch`** mapping template ID to the new component

See `AGENT_GUIDE_GLB_PASTABLE.md` for full code examples of the hook, model component, and template integration.

---

## Key Technical Gotchas

### Disconnected mesh islands
The carpaint mesh is made of disconnected islands — zones have **zero shared mesh edges** between them. This is normal. The dihedral clustering exploits this: boundary edges between panels have high angles, internal edges are smooth.

### face_to_zone.json vs vertex groups
`face_to_zone.json` is the **reliable** mapping. Vertex groups use REPLACE mode which overwrites shared-edge vertices, losing ~37% of face assignments at boundaries. Step 4d works around this via majority vote, but for rendering/verification, always use `face_to_zone.json`.

### EEVEE background rendering limitation
EEVEE won't refresh `material_index` changes between renders in a single Blender session. `render_zone_3d.py` handles this by spawning **one Blender process per zone**.

### Isolated cluster merging
During iterative merging, clusters with no shared edges (spatially separate mesh islands) get assigned to the **spatially nearest** active cluster by centroid distance. This is approximate but works well.

### Blender 5.x compatibility
- `BLENDER_EEVEE_NEXT` was renamed to `BLENDER_EEVEE` in Blender 5.x. Step4c uses `BLENDER_EEVEE`.
- `Material.use_nodes = True` shows deprecation warning but still works.
- Pillow needs `sys.path.insert(0, "~/.blender_pip")` workaround (app bundle is read-only).

### flipY on CanvasTexture
Keep `flipY = true` (the default). Step 4 flips V (`py = (1-v) * size`) so mask PNGs use image convention (Y=0 at top). Three.js `flipY=true` handles the rest.

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

# >>> PAUSE: show user results, get feedback, fix zones in Blender if needed <<<

# 4d. Export final masks
$BLENDER --background --python pipeline/step4d_export_masks.py

# 5. Reassemble final GLB
$BLENDER --background --python pipeline/step5_export.py

# 6. Validate
python3 pipeline/step6_validate.py

# 7-8. Three.js integration (see code examples above)
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
| 4c-fix | Manual refinement | User in Blender | 0-30min |
| 4d | Export masks | Blender + PIL | ~30s |
| 5 | Reassemble GLB | Blender | ~30s |
| 6 | Validate masks | Agent vision | ~2min |
| 7-8 | Three.js integration | Code | ~15min |

**Total automated time:** ~5 minutes. **Total with user review:** ~30-60 minutes per model.
