#!/usr/bin/env python3
"""Render per-zone 3D validation images.

Each zone is highlighted bright orange against a dim gray car body.
One Blender invocation per zone (required for EEVEE material_index refresh).

Run via:
    python3 pipeline/render_zone_3d.py

Requires: OUTPUT_DIR, MODEL_NAME, BLENDER env vars (source .env.pipeline)
"""

import json
import os
import subprocess
import sys

# Read env vars
BLENDER = os.environ.get("BLENDER", "")
OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "")
MODEL_NAME = os.environ.get("MODEL_NAME", "")

if not BLENDER or not OUTPUT_DIR or not MODEL_NAME:
    print("ERROR: BLENDER, OUTPUT_DIR, and MODEL_NAME must be set")
    print("Run: source .env.pipeline")
    sys.exit(1)

if not os.path.isfile(BLENDER):
    print(f"ERROR: BLENDER executable not found: {BLENDER}")
    sys.exit(1)

BLEND_FILE = os.path.join(OUTPUT_DIR, "step4c_seeded.blend")
FACE_ZONE_JSON = os.path.join(OUTPUT_DIR, "face_to_zone.json")
ZONE_3D_DIR = os.path.join(OUTPUT_DIR, "validation", "zone_3d")

if not os.path.isfile(BLEND_FILE):
    print(f"ERROR: {BLEND_FILE} not found. Run step4c first.")
    sys.exit(1)

if not os.path.isfile(FACE_ZONE_JSON):
    print(f"ERROR: {FACE_ZONE_JSON} not found. Run step4c first.")
    sys.exit(1)

os.makedirs(ZONE_3D_DIR, exist_ok=True)

# Load zone list
with open(FACE_ZONE_JSON) as f:
    face_to_zone = json.load(f)
zones = sorted(set(face_to_zone.values()))

print(f"Rendering {len(zones)} zones from {BLEND_FILE}")
print(f"Output: {ZONE_3D_DIR}")

BLENDER_SCRIPT_TEMPLATE = r'''
import bpy
import json
import mathutils
import os

ZONE_NAME = "{zone_name}"
FACE_ZONE_JSON = "{face_zone_json}"
OUTPUT_PATH = "{output_path}"

# Load face-to-zone mapping
with open(FACE_ZONE_JSON) as f:
    face_to_zone = json.load(f)

# Find the carpaint mesh
mesh_obj = None
for obj in bpy.data.objects:
    if obj.type == 'MESH' and 'carpaint' in obj.name.lower():
        mesh_obj = obj
        break

if mesh_obj is None:
    raise RuntimeError("Could not find carpaint mesh")

# Hide all other mesh objects
for obj in bpy.data.objects:
    if obj.type == 'MESH' and obj != mesh_obj:
        obj.hide_render = True
        obj.hide_viewport = True

# Make sure carpaint is visible
mesh_obj.hide_render = False
mesh_obj.hide_viewport = False

# Clear existing materials
mesh_obj.data.materials.clear()

# Create dim gray material (slot 0)
mat_gray = bpy.data.materials.new("zone_gray")
mat_gray.use_nodes = True
nodes = mat_gray.node_tree.nodes
links = mat_gray.node_tree.links
nodes.clear()
out = nodes.new('ShaderNodeOutputMaterial')
em = nodes.new('ShaderNodeEmission')
em.inputs['Color'].default_value = (0.08, 0.08, 0.10, 1.0)
em.inputs['Strength'].default_value = 0.6
links.new(em.outputs['Emission'], out.inputs['Surface'])

# Create bright orange material (slot 1)
mat_orange = bpy.data.materials.new("zone_highlight")
mat_orange.use_nodes = True
nodes = mat_orange.node_tree.nodes
links = mat_orange.node_tree.links
nodes.clear()
out = nodes.new('ShaderNodeOutputMaterial')
em = nodes.new('ShaderNodeEmission')
em.inputs['Color'].default_value = (1.0, 0.45, 0.0, 1.0)
em.inputs['Strength'].default_value = 2.5
links.new(em.outputs['Emission'], out.inputs['Surface'])

# Assign materials to mesh
mesh_obj.data.materials.append(mat_gray)
mesh_obj.data.materials.append(mat_orange)

# Assign material indices per face
mesh_data = mesh_obj.data
zone_centers = []
zone_normals = []

for poly in mesh_data.polygons:
    fi = str(poly.index)
    if fi in face_to_zone and face_to_zone[fi] == ZONE_NAME:
        poly.material_index = 1
        zone_centers.append(poly.center.copy())
        zone_normals.append(poly.normal.copy())
    else:
        poly.material_index = 0

mesh_data.update()

if not zone_centers:
    print(f"WARNING: No faces found for zone {{ZONE_NAME}}")
else:
    # Compute zone center and normal in world space
    world_mat = mesh_obj.matrix_world
    avg_center = mathutils.Vector((0, 0, 0))
    avg_normal = mathutils.Vector((0, 0, 0))
    for c in zone_centers:
        avg_center += world_mat @ c
    for n in zone_normals:
        avg_normal += (world_mat.to_3x3() @ n)
    avg_center /= len(zone_centers)
    avg_normal.normalize()

    # Compute bounding box extent in world space
    bbox_corners = [world_mat @ mathutils.Vector(c) for c in mesh_obj.bound_box]
    bbox_min = mathutils.Vector((min(c.x for c in bbox_corners), min(c.y for c in bbox_corners), min(c.z for c in bbox_corners)))
    bbox_max = mathutils.Vector((max(c.x for c in bbox_corners), max(c.y for c in bbox_corners), max(c.z for c in bbox_corners)))
    extent = (bbox_max - bbox_min).length

    # Place camera at zone_center + normal * (extent * 0.8)
    cam_dist = extent * 0.8
    cam_pos = avg_center + avg_normal * cam_dist

    # Get or create camera
    cam = None
    for o in bpy.data.objects:
        if o.type == 'CAMERA':
            cam = o
            break
    if cam is None:
        cam_data = bpy.data.cameras.new('ZoneCamera')
        cam = bpy.data.objects.new('ZoneCamera', cam_data)
        bpy.context.scene.collection.objects.link(cam)

    cam.location = cam_pos
    direction = avg_center - cam_pos
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam.rotation_euler = rot_quat.to_euler()

    cam.data.clip_start = 0.0001
    cam.data.clip_end = 100.0
    cam.data.lens = 50

    bpy.context.scene.camera = cam

# Add wireframe modifier for triangle edge visibility
wf = mesh_obj.modifiers.new(name="Wire", type='WIREFRAME')
wf.thickness = 0.000025
wf.use_replace = False
mat_wire = bpy.data.materials.new("zone_wire")
mat_wire.use_nodes = True
wn = mat_wire.node_tree.nodes
wl = mat_wire.node_tree.links
wn.clear()
wo = wn.new('ShaderNodeOutputMaterial')
we = wn.new('ShaderNodeEmission')
we.inputs['Color'].default_value = (0.02, 0.02, 0.02, 1.0)
we.inputs['Strength'].default_value = 0.3
wl.new(we.outputs['Emission'], wo.inputs['Surface'])
mesh_obj.data.materials.append(mat_wire)  # slot 2
wf.material_offset = 2

# Render settings
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 960
scene.render.resolution_y = 640
scene.render.film_transparent = True
scene.render.filepath = OUTPUT_PATH
scene.render.image_settings.file_format = 'PNG'

# Disable world background
if scene.world:
    scene.world.use_nodes = True
    wnodes = scene.world.node_tree.nodes
    for n in wnodes:
        if n.type == 'BACKGROUND':
            n.inputs['Strength'].default_value = 0.0

bpy.ops.render.render(write_still=True)
print(f"Rendered: {{OUTPUT_PATH}}")
'''

failed = []
for i, zone_name in enumerate(zones):
    output_path = os.path.join(ZONE_3D_DIR, f"{zone_name}.png")
    print(f"[{i+1}/{len(zones)}] Rendering zone: {zone_name}")

    script = BLENDER_SCRIPT_TEMPLATE.format(
        zone_name=zone_name,
        face_zone_json=FACE_ZONE_JSON.replace("\\", "\\\\"),
        output_path=output_path.replace("\\", "\\\\"),
    )

    cmd = [
        BLENDER,
        "--background",
        BLEND_FILE,
        "--python-expr",
        script,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

    if result.returncode != 0:
        print(f"  FAILED (rc={result.returncode}): {result.stderr[-500:] if result.stderr else 'no stderr'}")
        failed.append(zone_name)
    elif not os.path.exists(output_path):
        print(f"  FAILED: output file not created")
        failed.append(zone_name)
    else:
        print(f"  OK")

print(f"\nDone. {len(zones) - len(failed)}/{len(zones)} zones rendered successfully.")
if failed:
    print(f"Failed zones: {failed}")
