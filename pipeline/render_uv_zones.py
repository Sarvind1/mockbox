"""Render per-zone UV triangle images from face_to_zone.json.

Opens step4c_seeded.blend, extracts UV triangles for each zone,
and draws them as colored filled polygons onto a 1024x1024 canvas.

Run via:
    $BLENDER --background --python pipeline/render_uv_zones.py

Requires: OUTPUT_DIR, MODEL_NAME env vars (source .env.pipeline)
"""
import sys
import os
_extra = os.path.expanduser("~/.blender_pip")
if _extra not in sys.path:
    sys.path.insert(0, _extra)

import bpy
import bmesh
import json
import colorsys

OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "")
MODEL_NAME = os.environ.get("MODEL_NAME", "")

if not OUTPUT_DIR or not MODEL_NAME:
    print("ERROR: OUTPUT_DIR and MODEL_NAME must be set")
    sys.exit(1)

CANVAS_SIZE = 1024
OUT_DIR = os.path.join(OUTPUT_DIR, "validation", "uv_zones")
os.makedirs(OUT_DIR, exist_ok=True)

# Load blend file
blend_path = os.path.join(OUTPUT_DIR, "step4c_seeded.blend")
if not os.path.exists(blend_path):
    print(f"ERROR: {blend_path} not found. Run step4c first.")
    sys.exit(1)

bpy.ops.wm.open_mainfile(filepath=blend_path)

# Load face-to-zone mapping
fz_path = os.path.join(OUTPUT_DIR, "face_to_zone.json")
if not os.path.exists(fz_path):
    print(f"ERROR: {fz_path} not found. Run step4c first.")
    sys.exit(1)

with open(fz_path) as f:
    face_to_zone = json.load(f)

# Find carpaint mesh
combined = None
for obj in bpy.data.objects:
    if obj.type == "MESH" and "carpaint" in obj.name.lower():
        combined = obj
        break
if not combined:
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    combined = max(meshes, key=lambda o: len(o.data.polygons))
    print(f"WARNING: No carpaint mesh found. Using largest mesh: {combined.name}")

print(f"Mesh: {combined.name} ({len(combined.data.polygons)} faces)")

# Extract UV triangles per zone
bm = bmesh.new()
bm.from_mesh(combined.data)
bm.faces.ensure_lookup_table()
uv_layer = bm.loops.layers.uv.active

if not uv_layer:
    print("ERROR: No UV layer found")
    sys.exit(1)

zone_triangles = {}
for face in bm.faces:
    zone = face_to_zone.get(str(face.index), "body_misc")
    loops = list(face.loops)
    uvs = [(loop[uv_layer].uv.x, loop[uv_layer].uv.y) for loop in loops]
    if zone not in zone_triangles:
        zone_triangles[zone] = []
    # Fan-triangulate from first vertex
    for i in range(1, len(uvs) - 1):
        zone_triangles[zone].append([uvs[0], uvs[i], uvs[i + 1]])

bm.free()

zones = sorted(zone_triangles.keys())
print(f"Found {len(zones)} zones")

# Generate distinct colors per zone
zone_colors = {}
for i, name in enumerate(zones):
    hue = i / max(len(zones), 1)
    r, g, b = colorsys.hsv_to_rgb(hue, 0.8, 0.9)
    zone_colors[name] = (int(r * 255), int(g * 255), int(b * 255))

# Draw per-zone images
from PIL import Image, ImageDraw

for zone_name in zones:
    triangles = zone_triangles[zone_name]
    color = zone_colors[zone_name]

    img = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    for tri in triangles:
        points = []
        for u, v in tri:
            px = int(u * (CANVAS_SIZE - 1))
            py = int((1.0 - v) * (CANVAS_SIZE - 1))
            points.append((px, py))
        draw.polygon(points, fill=(*color, 200), outline=(0, 0, 0, 255))

    out_path = os.path.join(OUT_DIR, f"{zone_name}.png")
    img.save(out_path)
    print(f"  {zone_name}: {len(triangles)} triangles -> {out_path}")

# Draw combined all-zones image
img_all = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (20, 20, 20, 255))
draw_all = ImageDraw.Draw(img_all)

for zone_name in zones:
    triangles = zone_triangles[zone_name]
    color = zone_colors[zone_name]
    for tri in triangles:
        points = []
        for u, v in tri:
            px = int(u * (CANVAS_SIZE - 1))
            py = int((1.0 - v) * (CANVAS_SIZE - 1))
            points.append((px, py))
        draw_all.polygon(points, fill=(*color, 200), outline=(0, 0, 0, 255))

all_path = os.path.join(OUT_DIR, "_all_zones.png")
img_all.save(all_path)
print(f"\nCombined: {all_path}")
print(f"Done. {len(zones)} zone images + 1 combined image.")
