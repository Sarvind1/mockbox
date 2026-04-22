"""Step 1: Inspect GLB — generate mesh manifest and reference renders.

Imports the GLB, iterates all mesh objects, dumps mesh_manifest.json,
and renders from multiple angles into $OUTPUT_DIR/renders/.

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
import json
import mathutils

OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "")
MODEL_NAME = os.environ.get("MODEL_NAME", "")
GLB_INPUT = os.environ.get("GLB_INPUT", "")

if not OUTPUT_DIR or not MODEL_NAME or not GLB_INPUT:
    print("ERROR: OUTPUT_DIR, MODEL_NAME, and GLB_INPUT must be set")
    sys.exit(1)

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(os.path.join(OUTPUT_DIR, "renders"), exist_ok=True)

# Clear default scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Import GLB
bpy.ops.import_scene.gltf(filepath=GLB_INPUT)

print(f"Imported: {GLB_INPUT}")
print(f"Objects: {len(bpy.data.objects)}")

# Gather mesh manifest
meshes_info = []
for obj in bpy.data.objects:
    if obj.type != "MESH":
        continue
    mesh = obj.data
    mat_names = [m.name for m in mesh.materials if m]

    # Bounding box in world space
    bb_corners = [obj.matrix_world @ mathutils.Vector(c) for c in obj.bound_box]
    bb_min = [min(c[i] for c in bb_corners) for i in range(3)]
    bb_max = [max(c[i] for c in bb_corners) for i in range(3)]

    meshes_info.append({
        "name": obj.name,
        "vertex_count": len(mesh.vertices),
        "face_count": len(mesh.polygons),
        "material_names": mat_names,
        "bbox_min": bb_min,
        "bbox_max": bb_max,
        "parent": obj.parent.name if obj.parent else None,
    })

manifest = {
    "model_name": MODEL_NAME,
    "glb_path": GLB_INPUT,
    "meshes": meshes_info,
}

manifest_path = os.path.join(OUTPUT_DIR, "mesh_manifest.json")
with open(manifest_path, "w") as f:
    json.dump(manifest, f, indent=2)
print(f"Saved manifest: {manifest_path} ({len(meshes_info)} meshes)")

# Print summary by material
from collections import Counter
mat_counter = Counter()
for m in meshes_info:
    for mat in m["material_names"]:
        mat_counter[mat] += m["face_count"]

print("\nFaces by material:")
for mat, count in mat_counter.most_common():
    print(f"  {mat:30s}: {count:6d} faces")

# ── Render reference views ──
# Compute overall bounding box
all_bb_min = [float("inf")] * 3
all_bb_max = [float("-inf")] * 3
for obj in bpy.data.objects:
    if obj.type != "MESH":
        continue
    for corner in obj.bound_box:
        wc = obj.matrix_world @ mathutils.Vector(corner)
        for i in range(3):
            all_bb_min[i] = min(all_bb_min[i], wc[i])
            all_bb_max[i] = max(all_bb_max[i], wc[i])

center = mathutils.Vector([(all_bb_min[i] + all_bb_max[i]) / 2 for i in range(3)])
bb_size = [all_bb_max[i] - all_bb_min[i] for i in range(3)]
extent = max(bb_size)
cam_dist = extent * 2.0

# Setup render
bpy.context.scene.render.engine = "BLENDER_EEVEE"
bpy.context.scene.render.resolution_x = 1920
bpy.context.scene.render.resolution_y = 1080
bpy.context.scene.render.film_transparent = True

# Add sun light
light_data = bpy.data.lights.new("InspectSun", type="SUN")
light_data.energy = 3.0
light_obj = bpy.data.objects.new("InspectSun", light_data)
bpy.context.collection.objects.link(light_obj)
import math
light_obj.rotation_euler = (math.radians(50), math.radians(30), 0)

# Add camera
cam_data = bpy.data.cameras.new("InspectCam")
cam_obj = bpy.data.objects.new("InspectCam", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

views = {
    "front_left":  (-0.7, -0.7, 0.4),
    "front_right": (0.7, -0.7, 0.4),
    "left":        (-1, 0, 0.3),
    "right":       (1, 0, 0.3),
    "top":         (0, -0.01, 1),
    "rear_left":   (-0.7, 0.7, 0.4),
    "rear_right":  (0.7, 0.7, 0.4),
    "front":       (0, -1, 0.3),
    "rear":        (0, 1, 0.3),
}

render_dir = os.path.join(OUTPUT_DIR, "renders")
for view_name, (dx, dy, dz) in views.items():
    direction = mathutils.Vector((dx, dy, dz)).normalized()
    cam_obj.location = center + direction * cam_dist
    look_dir = center - cam_obj.location
    cam_obj.rotation_euler = look_dir.to_track_quat("-Z", "Y").to_euler()
    render_path = os.path.join(render_dir, f"{view_name}.png")
    bpy.context.scene.render.filepath = render_path
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {view_name} -> {render_path}")

print(f"\nStep 1 complete. Manifest: {manifest_path}")
