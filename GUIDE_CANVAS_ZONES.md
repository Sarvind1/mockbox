# Canvas Zone Detection Guide

How to segment a car GLB model into paintable panel zones using dihedral angle edge detection.

## Overview

Canvas zones are named regions of a car's surface (hood, doors, fenders, etc.) that users can paint independently in the wrap editor. The pipeline detects these zones automatically by analyzing the dihedral angle at each mesh edge.

**Why dihedral angles work:** Car modelers add sharp creases at panel seam lines (where body panels meet in real life). These creases create edges with high dihedral angles — typically 25 degrees or more — while the smooth surface within a panel has angles near 0. By thresholding on dihedral angle, we get natural panel boundaries for free.

**How it differs from step4b (spatial heuristics):** The old `step4b_spatial_masks.py` used bounding-box position to classify faces (e.g., "faces in the front-top region are the hood"). This breaks on unusual car shapes and requires per-model tuning. Dihedral detection is geometry-driven and works on any car GLB with natural panel creases.

## Prerequisites

- **Blender 5.x** — the `BLENDER` env var must point to the executable (e.g., `/Applications/Blender.app/Contents/MacOS/blender`)
- **Python with PIL/numpy** — installed into `~/.blender_pip` so Blender's Python can import them
- **step3_unwrapped.blend** — output from Step 3 (UV unwrap). Must exist at `$OUTPUT_DIR/step3_unwrapped.blend`
- **Environment variables set** — run `source .env.pipeline` before any pipeline command

## Step 4c: Dihedral Edge Detection

### Running

```bash
source .env.pipeline
$BLENDER --background --python pipeline/step4c_seed_vertex_groups.py
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OUTPUT_DIR` | (required) | Pipeline output directory for this model |
| `MODEL_NAME` | (required) | Model identifier (e.g., `bmw_x5m`) |
| `ANGLE_THRESHOLD` | `25` | Dihedral angle in degrees. Edges above this are zone boundaries. |
| `TARGET_ZONES` | `20` | How many final zones to produce after iterative merging. |

### What It Does

1. Opens `step3_unwrapped.blend` and finds the carpaint mesh
2. Computes the dihedral angle at every internal mesh edge
3. Marks edges above `ANGLE_THRESHOLD` as zone boundaries
4. Flood-fills connected components between boundaries (BFS)
5. Iteratively merges the smallest cluster into its most-connected neighbor until `TARGET_ZONES` zones remain
6. Auto-labels zones by normalized bounding-box position (e.g., front-top = `hood`, left-middle = `door_f_l`)
7. Creates Blender vertex groups for each zone
8. Saves `face_to_zone.json` — the reliable face-index-to-zone-name mapping
9. Renders color-coded validation views from 7 camera angles

### Outputs

| File | Description |
|---|---|
| `$OUTPUT_DIR/step4c_seeded.blend` | Blend file with vertex groups and color-coded faces |
| `$OUTPUT_DIR/face_to_zone.json` | `{"0": "hood", "1": "hood", ...}` — face index (string) to zone name |
| `$OUTPUT_DIR/validation/seed_*.png` | 7 color-coded validation renders |

## Manual Refinement in Blender

After step4c, open `step4c_seeded.blend` in Blender to verify and fix zone assignments.

### Verification

1. Open the blend file: `$BLENDER $OUTPUT_DIR/step4c_seeded.blend`
2. Select the carpaint mesh
3. Open the Properties panel > Object Data > Vertex Groups
4. Click a zone name, then click **Select** — the faces in that zone highlight
5. Check that zone boundaries follow real panel seam lines

### Fixing Boundaries

1. Enter Edit Mode (Tab)
2. Switch to Face Select mode (press 3)
3. Select the misassigned faces
4. In the Vertex Groups panel, click the correct zone name
5. Click **Assign** to add the faces to the correct zone
6. Click the old (wrong) zone name, then click **Remove** to unassign
7. Ctrl+S to save

### Renaming Zones

If auto-labeling got a name wrong (e.g., `cluster_2` instead of `quarter_panel_r`):

1. Double-click the vertex group name in the panel
2. Type the new name
3. Save

**Important:** After manual refinement, re-run step4d to regenerate masks from the updated vertex groups. The `face_to_zone.json` from step4c is NOT updated by manual Blender edits — step4d rebuilds the mapping from vertex groups using majority vote.

## Step 4d: Export Masks

### Running

```bash
source .env.pipeline
$BLENDER --background --python pipeline/step4d_export_masks.py
```

### What It Does

1. Opens `step4c_seeded.blend` (with any manual refinements)
2. Reads vertex groups and rebuilds the face-to-zone mapping using majority vote across each face's vertices
3. Extracts UV triangles for each zone
4. Generates per-zone UV mask PNGs (2048x2048, white on transparent)
5. Dilates masks by 5px to cover UV seam gaps
6. Saves `panel_metadata.json` with zone names and triangle counts
7. Copies masks to `public/masks/$MODEL_NAME/` for the web app
8. Renders final color-coded validation views

### Outputs

| File | Description |
|---|---|
| `$OUTPUT_DIR/masks/*.png` | Per-zone UV masks (2048x2048) |
| `$OUTPUT_DIR/panel_metadata.json` | Zone metadata for the app |
| `public/masks/$MODEL_NAME/*.png` | Copies of masks for the web app |
| `$OUTPUT_DIR/validation/final_*.png` | Final validation renders |

## Key Technical Details

### Disconnected mesh islands

The carpaint mesh is made of disconnected islands — zones have zero shared mesh edges between them. The dihedral angle detection exploits this: boundary edges between zones have high angles, while internal edges within a zone are smooth.

### Isolated cluster merging

During iterative merging, some clusters have no shared edges with any neighbor (they are spatially separate mesh islands). These get assigned to the spatially nearest active cluster by centroid distance. This is approximate but works well in practice.

### Vertex group boundary artifacts

Vertex groups use `REPLACE` mode when assigning vertices, which means a vertex shared by two zones gets assigned to whichever zone was processed last. This creates unreliable zone boundaries in the vertex groups. That is why `face_to_zone.json` exists as the ground-truth mapping — it stores the zone for every face index, with no shared-vertex ambiguity.

Step4d works around this by using majority vote: for each face, it counts how many of its vertices belong to each vertex group and picks the group with the most votes. This recovers the correct assignment even when boundary vertices are wrong.

### EEVEE background rendering limitation

EEVEE in Blender's background mode does not refresh `material_index` changes between renders within a single invocation. If you change which faces have `material_index = 1` and render again, EEVEE still renders the old assignment. The workaround is to use one Blender invocation per zone (see `render_zone_3d.py`).

## Tuning

### ANGLE_THRESHOLD

Controls how many initial clusters the flood-fill produces.

| Value | Effect |
|---|---|
| `15` | Very sensitive — creates many small clusters. Good for models with subtle creases. |
| `25` | Default — works well for most car GLBs with standard panel seams. |
| `35` | Less sensitive — fewer initial clusters. Good for low-poly models. |

After flood-fill, iterative merging reduces clusters to `TARGET_ZONES`, so a lower threshold just means more merging steps (slower but more accurate).

### TARGET_ZONES

Controls the final number of zones. A typical car has 15-25 paintable panels. Set this to match the number of distinct panels visible on your model. If the auto-labeling produces zones named `cluster_N`, you either need more zones (increase TARGET_ZONES) or the model lacks clear creases at those boundaries.
