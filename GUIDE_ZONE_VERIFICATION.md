# Zone Verification Guide

Three types of verification images for validating canvas zone detection results.

## Overview

After running step4c (dihedral edge detection), you need to verify that zones were detected correctly before exporting masks. The pipeline generates three types of verification images, each useful for different checks:

| Type | Directory | Best for |
|---|---|---|
| UV Zone Images | `validation/uv_zones/` | Checking UV footprint shape and coverage |
| UV Context Images | `validation/uv_context/` | Checking zone adjacency and UV-space layout |
| 3D Zone Images | `validation/zone_3d/` | Checking that zone boundaries match real panel seams |

## UV Zone Images

**Directory:** `$OUTPUT_DIR/validation/uv_zones/`

Per-zone UV triangle renders showing each zone's footprint on the 1024x1024 UV atlas. Each zone gets its own image with filled colored triangles and dark outlines. An `_all_zones.png` combined view shows every zone on one canvas.

### What to look for

- **Coverage gaps**: Missing triangles within a zone indicate faces that were not assigned
- **Stray triangles**: Triangles far from the main cluster suggest misassigned faces
- **Shape coherence**: Each zone should form a contiguous region in UV space

### How to regenerate

```bash
source .env.pipeline
$BLENDER --background --python pipeline/render_uv_zones.py
```

**Script:** `pipeline/render_uv_zones.py`

## UV Context Images

**Directory:** `$OUTPUT_DIR/validation/uv_context/`

Each image shows one zone drawn bright with its UV-proximity neighbors dimmed and labeled. The view is cropped to the region of interest. Neighbor detection uses bounding box proximity — zones whose UV bounding boxes are within 120 pixels of each other (on the 1024px canvas) are considered neighbors.

### What to look for

- **Neighbor correctness**: The labeled neighbors should match what you expect spatially (e.g., hood's neighbors should include fenders and bumper_front)
- **Overlap detection**: If two zone labels overlap in UV space, their masks will interfere with each other during painting
- **Island isolation**: A zone with no neighbors may be a tiny misdetected fragment

### How to regenerate

```bash
source .env.pipeline
$BLENDER --background --python pipeline/render_uv_context.py
```

**Script:** `pipeline/render_uv_context.py`

## 3D Zone Images

**Directory:** `$OUTPUT_DIR/validation/zone_3d/`

Each zone is highlighted bright orange on a dim gray car body, with the camera positioned along the zone's average face normal direction. This gives the most intuitive view of where each zone sits on the actual car.

### What to look for

- **Boundary accuracy**: The orange highlight should follow real panel seam lines
- **Complete coverage**: No visible body panel area should be unlit within the zone
- **Zone naming**: The filename tells you the zone name — verify it matches the panel it highlights

### Why one Blender invocation per zone

EEVEE in background mode does not refresh `material_index` changes between renders. If you set different faces to `material_index = 1` and render again in the same session, EEVEE renders the old state. The `render_zone_3d.py` script works around this by spawning a separate `blender --background` process for each zone.

### How to regenerate

```bash
source .env.pipeline
python3 pipeline/render_zone_3d.py
```

**Script:** `pipeline/render_zone_3d.py`

Note: This is a regular Python script (not a Blender script). It spawns one Blender subprocess per zone. Rendering all zones takes a few minutes.

## Script Reference

| Script | Type | Run with | Output |
|---|---|---|---|
| `pipeline/render_uv_zones.py` | Blender script | `$BLENDER --background --python` | `validation/uv_zones/` |
| `pipeline/render_uv_context.py` | Blender script | `$BLENDER --background --python` | `validation/uv_context/` |
| `pipeline/render_zone_3d.py` | Python script | `python3` | `validation/zone_3d/` |

All scripts read from:
- `$OUTPUT_DIR/step4c_seeded.blend` — the blend file with vertex groups and zone colors
- `$OUTPUT_DIR/face_to_zone.json` — the face-index-to-zone-name mapping

Environment variables (set via `source .env.pipeline`):
- `OUTPUT_DIR` — pipeline output directory
- `MODEL_NAME` — model identifier
- `BLENDER` — path to Blender executable (used by render_zone_3d.py to spawn subprocesses)
