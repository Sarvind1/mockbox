"""Step 4d: Export UV masks from user-refined vertex groups.

Reads vertex groups from the step4c_seeded.blend (after user refinement),
generates per-zone UV-space PNG masks, validation renders, and panel_metadata.json.

This is the final mask generation step — output goes to both pipeline_output and public/masks.
"""
import sys
import os
_extra = os.path.expanduser("~/.blender_pip")
if _extra not in sys.path:
    sys.path.insert(0, _extra)

import bpy
import bmesh
import json
import math
import mathutils

OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "")
MODEL_NAME = os.environ.get("MODEL_NAME", "")
MOCKBOX_ROOT = os.environ.get("MOCKBOX_ROOT", "")
MASK_SIZE = 2048

if not OUTPUT_DIR or not MODEL_NAME:
    print("ERROR: OUTPUT_DIR and MODEL_NAME must be set")
    sys.exit(1)

MASK_DIR = os.path.join(OUTPUT_DIR, "masks")
os.makedirs(MASK_DIR, exist_ok=True)

# Also output directly to public/masks for the app
PUBLIC_MASK_DIR = ""
if MOCKBOX_ROOT:
    PUBLIC_MASK_DIR = os.path.join(MOCKBOX_ROOT, "public", "masks", MODEL_NAME)
    os.makedirs(PUBLIC_MASK_DIR, exist_ok=True)

# Load the user-refined blend
blend_path = os.path.join(OUTPUT_DIR, "step4c_seeded.blend")
if not os.path.exists(blend_path):
    print(f"ERROR: {blend_path} not found. Run step4c first and refine in Blender.")
    sys.exit(1)

bpy.ops.wm.open_mainfile(filepath=blend_path)

# Find the carpaint mesh
combined = None
for obj in bpy.data.objects:
    if obj.type == "MESH" and "carpaint" in obj.name.lower():
        combined = obj
        break
if not combined:
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    combined = max(meshes, key=lambda o: len(o.data.polygons))
    print(f"WARNING: Using largest mesh: {combined.name}")

print(f"Working with mesh: {combined.name} ({len(combined.data.polygons)} faces)")

# ── Read vertex groups ──
vgroup_names = [vg.name for vg in combined.vertex_groups]
print(f"Found {len(vgroup_names)} vertex groups: {vgroup_names}")

if not vgroup_names:
    print("ERROR: No vertex groups found. Run step4c first.")
    sys.exit(1)

# Build face → zone mapping from vertex groups using MAJORITY VOTE.
# At zone boundaries, shared-edge vertices belong to multiple groups.
# We count how many of each face's vertices belong to each group and the
# group with the most votes wins. This prevents seam artifacts.
mesh_data = combined.data
face_to_zone = {}

# Build vertex → groups lookup
vert_groups = {}  # vertex_index -> set of group names
for vg in combined.vertex_groups:
    for vert_idx in range(len(mesh_data.vertices)):
        try:
            w = vg.weight(vert_idx)
            if w > 0.5:
                if vert_idx not in vert_groups:
                    vert_groups[vert_idx] = set()
                vert_groups[vert_idx].add(vg.name)
        except RuntimeError:
            pass  # vertex not in this group

# For each face, majority vote across its vertices
from collections import Counter
zone_faces = {}
unassigned = 0
for face in mesh_data.polygons:
    vote_counter = Counter()
    for vi in face.vertices:
        for g in vert_groups.get(vi, set()):
            vote_counter[g] += 1

    if vote_counter:
        # Prefer non-body_misc zones in case of a tie
        best_count = vote_counter.most_common(1)[0][1]
        candidates = [z for z, c in vote_counter.items() if c == best_count]
        non_misc = [z for z in candidates if z != "body_misc"]
        zone = non_misc[0] if non_misc else candidates[0]
    else:
        zone = "body_misc"
        unassigned += 1

    face_to_zone[face.index] = zone
    if zone not in zone_faces:
        zone_faces[zone] = []
    zone_faces[zone].append(face.index)

print(f"\n{'='*60}")
print(f"  VERTEX GROUP CLASSIFICATION")
print(f"{'='*60}")
total = 0
for zone in sorted(zone_faces.keys()):
    count = len(zone_faces[zone])
    total += count
    print(f"  {zone:20s}: {count:5d} faces")
print(f"  {'TOTAL':20s}: {total:5d} faces")
if unassigned > 0:
    print(f"  ({unassigned} faces had no vertex group → assigned to body_misc)")

# ── Gather UV data ──
bm = bmesh.new()
bm.from_mesh(combined.data)
bm.faces.ensure_lookup_table()
uv_layer = bm.loops.layers.uv.active

if not uv_layer:
    print("ERROR: No UV layer found")
    sys.exit(1)

# Build zone -> UV triangles
zone_triangles = {}
for face in bm.faces:
    zone = face_to_zone.get(face.index, "body_misc")
    loops = list(face.loops)
    uvs = [(loop[uv_layer].uv.x, loop[uv_layer].uv.y) for loop in loops]
    if zone not in zone_triangles:
        zone_triangles[zone] = []
    # Fan-triangulate from first vertex
    for i in range(1, len(uvs) - 1):
        zone_triangles[zone].append([uvs[0], uvs[i], uvs[i + 1]])

bm.free()

# ── Generate per-zone UV masks ──
from PIL import Image, ImageDraw, ImageFilter

panel_metadata = {"mask_size": MASK_SIZE, "zones": {}}

for zone_name, triangles in sorted(zone_triangles.items()):
    print(f"Generating mask for '{zone_name}': {len(triangles)} triangles")

    img = Image.new("RGBA", (MASK_SIZE, MASK_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    for tri in triangles:
        points = []
        for u, v in tri:
            px = int(u * (MASK_SIZE - 1))
            py = int((1.0 - v) * (MASK_SIZE - 1))
            points.append((px, py))
        draw.polygon(points, fill=(255, 255, 255, 255))

    # Dilate mask to cover UV seam gaps
    alpha = img.split()[3]
    alpha = alpha.filter(ImageFilter.MaxFilter(5))
    img.putalpha(alpha)

    # Save to pipeline output
    mask_path = os.path.join(MASK_DIR, f"{zone_name}.png")
    img.save(mask_path)
    print(f"  Saved {mask_path}")

    # Also copy to public/masks
    if PUBLIC_MASK_DIR:
        public_path = os.path.join(PUBLIC_MASK_DIR, f"{zone_name}.png")
        img.save(public_path)
        print(f"  Copied to {public_path}")

    panel_metadata["zones"][zone_name] = {
        "mask_file": f"{zone_name}.png",
        "triangle_count": len(triangles),
    }

# ── Save metadata ──
metadata_path = os.path.join(OUTPUT_DIR, "panel_metadata.json")
with open(metadata_path, "w") as f_out:
    json.dump(panel_metadata, f_out, indent=2)

if PUBLIC_MASK_DIR:
    public_metadata = os.path.join(PUBLIC_MASK_DIR, "panel_metadata.json")
    with open(public_metadata, "w") as f_out:
        json.dump(panel_metadata, f_out, indent=2)

# ── Update vertex colors to reflect final assignment ──
ZONE_COLORS = {
    "hood":          (0.2, 0.6, 1.0, 1.0),
    "roof":          (0.0, 0.8, 0.2, 1.0),
    "trunk":         (1.0, 0.8, 0.0, 1.0),
    "bumper_front":  (1.0, 0.2, 0.2, 1.0),
    "bumper_rear":   (0.8, 0.0, 0.4, 1.0),
    "fender_f_l":    (0.6, 0.3, 1.0, 1.0),
    "fender_f_r":    (0.4, 0.1, 0.8, 1.0),
    "fender_r_l":    (1.0, 0.5, 0.0, 1.0),
    "fender_r_r":    (0.8, 0.4, 0.0, 1.0),
    "door_f_l":      (0.0, 1.0, 1.0, 1.0),
    "door_f_r":      (0.0, 0.7, 0.7, 1.0),
    "door_r_l":      (0.5, 1.0, 0.5, 1.0),
    "door_r_r":      (0.3, 0.7, 0.3, 1.0),
    "rocker_l":      (0.5, 0.5, 0.5, 1.0),
    "rocker_r":      (0.4, 0.4, 0.4, 1.0),
    "body_misc":     (1.0, 1.0, 1.0, 1.0),
}

bm2 = bmesh.new()
bm2.from_mesh(combined.data)
bm2.faces.ensure_lookup_table()

for attr in list(combined.data.attributes):
    if attr.domain == 'CORNER' and attr.data_type == 'FLOAT_COLOR':
        combined.data.attributes.remove(attr)

color_layer = bm2.loops.layers.color.new("zone_colors")
for face in bm2.faces:
    zone = face_to_zone.get(face.index, "body_misc")
    color = ZONE_COLORS.get(zone, (1.0, 1.0, 1.0, 1.0))
    for loop in face.loops:
        loop[color_layer] = color

bm2.to_mesh(combined.data)
bm2.free()

# ── Render final validation views ──
vc_mat = None
for mat in bpy.data.materials:
    if mat.name == "ZoneColorMat":
        vc_mat = mat
        break
if not vc_mat:
    vc_mat = bpy.data.materials.new("ZoneColorMat")
    vc_mat.use_nodes = True
    nodes = vc_mat.node_tree.nodes
    links = vc_mat.node_tree.links
    nodes.clear()
    output_node = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    vc_node = nodes.new("ShaderNodeVertexColor")
    vc_node.layer_name = "zone_colors"
    links.new(vc_node.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(bsdf.outputs["BSDF"], output_node.inputs["Surface"])

combined.data.materials.clear()
combined.data.materials.append(vc_mat)

bpy.context.scene.render.engine = "BLENDER_EEVEE"
bpy.context.scene.render.resolution_x = 1920
bpy.context.scene.render.resolution_y = 1080
bpy.context.scene.render.film_transparent = True

# Reuse or create camera
cam_obj = None
for obj in bpy.data.objects:
    if obj.type == 'CAMERA':
        cam_obj = obj
        break
if not cam_obj:
    cam_data = bpy.data.cameras.new("ZoneCam")
    cam_obj = bpy.data.objects.new("ZoneCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

# Ensure lighting
has_light = any(obj.type == 'LIGHT' for obj in bpy.data.objects)
if not has_light:
    light_data = bpy.data.lights.new("ZoneSun", type="SUN")
    light_data.energy = 5.0
    light_obj = bpy.data.objects.new("ZoneSun", light_data)
    bpy.context.collection.objects.link(light_obj)
    light_obj.rotation_euler = (math.radians(50), math.radians(30), 0)

bb_min_v = [float("inf")] * 3
bb_max_v = [float("-inf")] * 3
for corner in combined.bound_box:
    wc = combined.matrix_world @ mathutils.Vector(corner)
    for i in range(3):
        bb_min_v[i] = min(bb_min_v[i], wc[i])
        bb_max_v[i] = max(bb_max_v[i], wc[i])

center = mathutils.Vector([(bb_min_v[i] + bb_max_v[i]) / 2 for i in range(3)])
extent = max(bb_max_v[i] - bb_min_v[i] for i in range(3))
cam_dist = extent * 1.8

views = {
    "final_front_left":  (-0.7, -0.7, 0.4),
    "final_front_right": (0.7, -0.7, 0.4),
    "final_left":        (-1, 0, 0.3),
    "final_right":       (1, 0, 0.3),
    "final_top":         (0, -0.01, 1),
    "final_rear_left":   (-0.7, 0.7, 0.4),
    "final_rear_right":  (0.7, 0.7, 0.4),
}

val_dir = os.path.join(OUTPUT_DIR, "validation")
os.makedirs(val_dir, exist_ok=True)

for view_name, (dx, dy, dz) in views.items():
    direction = mathutils.Vector((dx, dy, dz)).normalized()
    cam_obj.location = center + direction * cam_dist
    look_dir = center - cam_obj.location
    cam_obj.rotation_euler = look_dir.to_track_quat("-Z", "Y").to_euler()
    render_path = os.path.join(val_dir, f"{view_name}.png")
    bpy.context.scene.render.filepath = render_path
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {view_name} -> {render_path}")

# ── Generate zone list for templates.ts ──
zone_list = sorted(zone_faces.keys())
print(f"\n{'='*60}")
print(f"  OUTPUT SUMMARY")
print(f"{'='*60}")
print(f"  Masks:    {MASK_DIR}")
if PUBLIC_MASK_DIR:
    print(f"  Public:   {PUBLIC_MASK_DIR}")
print(f"  Metadata: {metadata_path}")
print(f"  Renders:  {val_dir}/final_*.png")
print(f"\n  Zone list for templates.ts canvasZones:")
print(f"  {json.dumps(zone_list)}")
print(f"\nStep 4d complete.")
