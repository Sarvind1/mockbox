"""Step 3: UV unwrap — import GLB, join carpaint meshes, Smart UV Project, save blend.

Reads name_mapping.json to decide which meshes are carpaint (and should be joined)
versus trim/skip. The joined mesh is named "carpaint_combined" (step4c searches for
"carpaint" in the name). Non-carpaint meshes are kept but hidden for rendering.

Environment variables:
  OUTPUT_DIR  — pipeline output directory
  MODEL_NAME  — model name
  GLB_INPUT   — path to the source GLB file
"""
import sys
import os
_extra = os.path.expanduser("~/.blender_pip")
if _extra not in sys.path:
    sys.path.insert(0, _extra)

import bpy
import bmesh
import json

OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "")
MODEL_NAME = os.environ.get("MODEL_NAME", "")
GLB_INPUT = os.environ.get("GLB_INPUT", "")

if not OUTPUT_DIR or not MODEL_NAME or not GLB_INPUT:
    print("ERROR: OUTPUT_DIR, MODEL_NAME, and GLB_INPUT must be set")
    sys.exit(1)

mapping_path = os.path.join(OUTPUT_DIR, "name_mapping.json")
if not os.path.exists(mapping_path):
    print(f"ERROR: {mapping_path} not found. Run step 2 and fill in the mapping.")
    sys.exit(1)

with open(mapping_path) as f:
    mapping_data = json.load(f)

name_mapping = mapping_data.get("name_mapping", {})

# Roles that are carpaint body panels (will be joined)
CARPAINT_ROLES = {
    "hood", "roof", "trunk", "bumper_front", "bumper_rear",
    "fender_fl", "fender_fr", "fender_f_l", "fender_f_r",
    "fender_rl", "fender_rr", "fender_r_l", "fender_r_r",
    "door_fl", "door_fr", "door_f_l", "door_f_r",
    "door_rl", "door_rr", "door_r_l", "door_r_r",
    "rocker_l", "rocker_r",
    "quarter_r_l", "quarter_r_r",
    "body_misc",
}

# Clear default scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Import GLB
bpy.ops.import_scene.gltf(filepath=GLB_INPUT)
print(f"Imported: {GLB_INPUT}")

# Classify meshes
carpaint_objects = []
trim_objects = []
skip_objects = []

for obj in bpy.data.objects:
    if obj.type != "MESH":
        continue
    role = name_mapping.get(obj.name, "unmapped")
    if role in CARPAINT_ROLES:
        carpaint_objects.append(obj)
    elif role == "trim":
        trim_objects.append(obj)
    elif role == "skip":
        skip_objects.append(obj)
    else:
        # Unmapped — check if it's a large mesh (likely carpaint) or small (trim)
        if len(obj.data.polygons) > 50:
            carpaint_objects.append(obj)
            print(f"  Auto-including unmapped mesh: {obj.name} ({len(obj.data.polygons)} faces)")
        else:
            trim_objects.append(obj)

print(f"\nCarpaint meshes: {len(carpaint_objects)}")
print(f"Trim meshes: {len(trim_objects)}")
print(f"Skip meshes: {len(skip_objects)}")

if not carpaint_objects:
    print("ERROR: No carpaint meshes found! Check name_mapping.json")
    sys.exit(1)

# ── Join all carpaint meshes into one ──
# First, apply all transforms
for obj in carpaint_objects:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.select_all(action="DESELECT")

# Select all carpaint objects and join
for obj in carpaint_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = carpaint_objects[0]
bpy.ops.object.join()

combined = bpy.context.active_object
combined.name = "carpaint_combined"
print(f"\nJoined into: {combined.name} ({len(combined.data.vertices)} verts, {len(combined.data.polygons)} faces)")

# ── Smart UV Project ──
bpy.context.view_layer.objects.active = combined
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=1.15192, island_margin=0.005, scale_to_bounds=True)
bpy.ops.object.mode_set(mode="OBJECT")

# Verify UV layer
if combined.data.uv_layers.active:
    print(f"UV layer: {combined.data.uv_layers.active.name}")
else:
    print("WARNING: No active UV layer after Smart UV Project!")

# ── Hide trim/skip for clean rendering later ──
for obj in trim_objects + skip_objects:
    obj.hide_render = True
    obj.hide_viewport = True

# ── Save blend file ──
out_blend = os.path.join(OUTPUT_DIR, "step3_unwrapped.blend")
bpy.ops.wm.save_as_mainfile(filepath=out_blend)
print(f"\nSaved: {out_blend}")
print(f"Step 3 complete.")
