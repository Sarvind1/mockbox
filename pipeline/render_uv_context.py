"""Render per-zone UV context images with neighbor labels.

Each zone is drawn bright with UV-proximity neighbors dimmed and labeled.
Uses bounding box proximity (120px threshold) to find neighbors.

Run via:
    $BLENDER --background --python pipeline/render_uv_context.py

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
NEIGHBOR_THRESHOLD_PX = 120  # bounding box proximity in pixels
PADDING = 40  # padding around cropped region
OUT_DIR = os.path.join(OUTPUT_DIR, "validation", "uv_context")
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
    for i in range(1, len(uvs) - 1):
        zone_triangles[zone].append([uvs[0], uvs[i], uvs[i + 1]])

bm.free()

zones = sorted(zone_triangles.keys())
print(f"Found {len(zones)} zones")

# Compute UV bounding box per zone (in pixel space)
zone_bboxes = {}
for zone_name, triangles in zone_triangles.items():
    min_x, min_y = CANVAS_SIZE, CANVAS_SIZE
    max_x, max_y = 0, 0
    for tri in triangles:
        for u, v in tri:
            px = int(u * (CANVAS_SIZE - 1))
            py = int((1.0 - v) * (CANVAS_SIZE - 1))
            min_x = min(min_x, px)
            min_y = min(min_y, py)
            max_x = max(max_x, px)
            max_y = max(max_y, py)
    zone_bboxes[zone_name] = (min_x, min_y, max_x, max_y)

# Build neighbor map using bounding box proximity
zone_neighbors = {}
for zone_a in zones:
    ax0, ay0, ax1, ay1 = zone_bboxes[zone_a]
    # Expand bbox by threshold
    eax0 = ax0 - NEIGHBOR_THRESHOLD_PX
    eay0 = ay0 - NEIGHBOR_THRESHOLD_PX
    eax1 = ax1 + NEIGHBOR_THRESHOLD_PX
    eay1 = ay1 + NEIGHBOR_THRESHOLD_PX
    neighbors = []
    for zone_b in zones:
        if zone_b == zone_a:
            continue
        bx0, by0, bx1, by1 = zone_bboxes[zone_b]
        # Check overlap between expanded A and B
        if eax0 <= bx1 and eax1 >= bx0 and eay0 <= by1 and eay1 >= by0:
            neighbors.append(zone_b)
    zone_neighbors[zone_a] = neighbors

# Generate colors
zone_colors = {}
for i, name in enumerate(zones):
    hue = i / max(len(zones), 1)
    r, g, b = colorsys.hsv_to_rgb(hue, 0.8, 0.9)
    zone_colors[name] = (int(r * 255), int(g * 255), int(b * 255))

# Draw context images
from PIL import Image, ImageDraw, ImageFont

# Try to load a font for labels
font = None
try:
    font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 14)
except Exception:
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
    except Exception:
        font = ImageFont.load_default()

for zone_name in zones:
    neighbors = zone_neighbors[zone_name]
    triangles = zone_triangles[zone_name]

    # Compute crop region encompassing this zone and its neighbors
    all_involved = [zone_name] + neighbors
    crop_min_x, crop_min_y = CANVAS_SIZE, CANVAS_SIZE
    crop_max_x, crop_max_y = 0, 0
    for z in all_involved:
        bx0, by0, bx1, by1 = zone_bboxes[z]
        crop_min_x = min(crop_min_x, bx0)
        crop_min_y = min(crop_min_y, by0)
        crop_max_x = max(crop_max_x, bx1)
        crop_max_y = max(crop_max_y, by1)

    # Add padding
    crop_min_x = max(0, crop_min_x - PADDING)
    crop_min_y = max(0, crop_min_y - PADDING)
    crop_max_x = min(CANVAS_SIZE, crop_max_x + PADDING)
    crop_max_y = min(CANVAS_SIZE, crop_max_y + PADDING)

    # Draw on full canvas then crop
    img = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (10, 10, 10, 255))
    draw = ImageDraw.Draw(img)

    # Draw neighbor zones dimmed
    for nb in neighbors:
        nb_color = zone_colors[nb]
        dim_color = (nb_color[0] // 3, nb_color[1] // 3, nb_color[2] // 3, 150)
        for tri in zone_triangles[nb]:
            points = []
            for u, v in tri:
                px = int(u * (CANVAS_SIZE - 1))
                py = int((1.0 - v) * (CANVAS_SIZE - 1))
                points.append((px, py))
            draw.polygon(points, fill=dim_color, outline=(40, 40, 40, 200))

    # Draw main zone bright
    main_color = zone_colors[zone_name]
    for tri in triangles:
        points = []
        for u, v in tri:
            px = int(u * (CANVAS_SIZE - 1))
            py = int((1.0 - v) * (CANVAS_SIZE - 1))
            points.append((px, py))
        draw.polygon(points, fill=(*main_color, 255), outline=(255, 255, 255, 255))

    # Label neighbors
    for nb in neighbors:
        bx0, by0, bx1, by1 = zone_bboxes[nb]
        label_x = (bx0 + bx1) // 2
        label_y = (by0 + by1) // 2
        draw.text((label_x, label_y), nb, fill=(200, 200, 200, 255), font=font, anchor="mm")

    # Label main zone
    bx0, by0, bx1, by1 = zone_bboxes[zone_name]
    cx = (bx0 + bx1) // 2
    cy = (by0 + by1) // 2
    draw.text((cx, cy), zone_name, fill=(255, 255, 255, 255), font=font, anchor="mm")

    # Crop to region of interest
    cropped = img.crop((crop_min_x, crop_min_y, crop_max_x, crop_max_y))

    out_path = os.path.join(OUT_DIR, f"{zone_name}.png")
    cropped.save(out_path)
    print(f"  {zone_name}: {len(neighbors)} neighbors -> {out_path}")

print(f"\nDone. {len(zones)} context images.")
