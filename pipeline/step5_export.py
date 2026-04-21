#!/usr/bin/env python3
"""
Step 5 — Split combined carpaint mesh into per-zone mesh objects and export GLB.

Opens step4c_seeded.blend, reads face_to_zone.json, splits carpaint_combined
into separate mesh objects per zone (hood, roof, door_l, etc.), applies a
shared carpaint material, and exports as GLB.

This produces the same structure as the Porsche 911 panels GLB — each panel
zone is a separate mesh object, enabling per-mesh materials in Three.js.

Usage:
  source .env.pipeline
  MODEL_NAME=bmw_x5m OUTPUT_DIR=pipeline_output/bmw_x5m \
    $BLENDER --background --python pipeline/step5_export.py
"""

import bpy
import bmesh
import json
import os
import sys

MODEL_NAME = os.environ.get("MODEL_NAME", "bmw_x5m")
OUTPUT_DIR = os.environ.get(
    "OUTPUT_DIR",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "pipeline_output", MODEL_NAME),
)
BLEND_FILE = os.path.join(OUTPUT_DIR, "step4c_seeded.blend")
FACE_ZONE_JSON = os.path.join(OUTPUT_DIR, "face_to_zone.json")
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_GLB = os.path.join(SCRIPT_DIR, "..", "public", "models", f"{MODEL_NAME}_panels.glb")

print(f"[step5] MODEL_NAME={MODEL_NAME}")
print(f"[step5] BLEND_FILE={BLEND_FILE}")
print(f"[step5] FACE_ZONE_JSON={FACE_ZONE_JSON}")
print(f"[step5] OUTPUT_GLB={OUTPUT_GLB}")

# ── Load face-to-zone mapping ──
with open(FACE_ZONE_JSON) as f:
    face_to_zone = json.load(f)
print(f"[step5] Loaded {len(face_to_zone)} face-to-zone entries")

# ── Open blend file ──
bpy.ops.wm.open_mainfile(filepath=BLEND_FILE)

# ── Find carpaint mesh ──
carpaint_obj = None
for obj in bpy.data.objects:
    if obj.type == "MESH" and "carpaint" in obj.name.lower():
        carpaint_obj = obj
        break

if carpaint_obj is None:
    print("[step5] ERROR: No carpaint mesh found!")
    sys.exit(1)

print(f"[step5] Carpaint mesh: {carpaint_obj.name} "
      f"({len(carpaint_obj.data.vertices)} verts, {len(carpaint_obj.data.polygons)} polys)")

# ── Create shared carpaint material (Principled BSDF for Three.js) ──
mat_carpaint = bpy.data.materials.new("carpaint")
mat_carpaint.use_nodes = True
nodes = mat_carpaint.node_tree.nodes
links = mat_carpaint.node_tree.links
nodes.clear()
bsdf = nodes.new("ShaderNodeBsdfPrincipled")
bsdf.inputs["Base Color"].default_value = (0.8, 0.8, 0.8, 1.0)
bsdf.inputs["Metallic"].default_value = 0.3
bsdf.inputs["Roughness"].default_value = 0.2
output_node = nodes.new("ShaderNodeOutputMaterial")
links.new(bsdf.outputs["BSDF"], output_node.inputs["Surface"])

# ── Group faces by zone ──
zone_face_indices = {}
for face_idx_str, zone_name in face_to_zone.items():
    face_idx = int(face_idx_str)
    if zone_name not in zone_face_indices:
        zone_face_indices[zone_name] = []
    zone_face_indices[zone_name].append(face_idx)

print(f"[step5] Zones to create: {len(zone_face_indices)}")
for zone_name in sorted(zone_face_indices.keys()):
    print(f"  {zone_name:20s}: {len(zone_face_indices[zone_name]):5d} faces")

# ── Make carpaint active and deselect all ──
bpy.context.view_layer.objects.active = carpaint_obj
bpy.ops.object.select_all(action="DESELECT")
carpaint_obj.select_set(True)

# ── Split into per-zone meshes using bmesh ──
# We'll create new mesh objects for each zone by duplicating and deleting faces.
source_mesh = carpaint_obj.data

created_zone_objects = []

for zone_name, face_indices in sorted(zone_face_indices.items()):
    face_set = set(face_indices)

    # Create a bmesh copy
    bm = bmesh.new()
    bm.from_mesh(source_mesh)
    bm.faces.ensure_lookup_table()

    # Delete faces NOT in this zone
    faces_to_delete = [f for f in bm.faces if f.index not in face_set]
    bmesh.ops.delete(bm, geom=faces_to_delete, context="FACES")

    # Remove isolated vertices
    verts_to_delete = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=verts_to_delete, context="VERTS")

    # Create new mesh data
    new_mesh = bpy.data.meshes.new(f"{zone_name}_mesh")
    bm.to_mesh(new_mesh)
    bm.free()

    # Create new object
    new_obj = bpy.data.objects.new(zone_name, new_mesh)
    new_obj.matrix_world = carpaint_obj.matrix_world.copy()

    # Assign carpaint material
    new_mesh.materials.clear()
    new_mesh.materials.append(mat_carpaint)
    for poly in new_mesh.polygons:
        poly.material_index = 0

    # Link to scene
    bpy.context.collection.objects.link(new_obj)
    created_zone_objects.append(new_obj)
    print(f"  Created: {zone_name} ({len(new_mesh.vertices)} verts, {len(new_mesh.polygons)} faces)")

# ── Remove original combined carpaint mesh ──
bpy.data.objects.remove(carpaint_obj, do_unlink=True)

# ── Un-hide all objects ──
for obj in bpy.data.objects:
    obj.hide_render = False
    obj.hide_viewport = False
    obj.hide_set(False)

# ── Remove wireframe modifiers ──
for obj in bpy.data.objects:
    if obj.type == "MESH":
        for mod in list(obj.modifiers):
            if mod.type == "WIREFRAME":
                obj.modifiers.remove(mod)

# ── Export GLB ──
os.makedirs(os.path.dirname(OUTPUT_GLB), exist_ok=True)

bpy.ops.export_scene.gltf(
    filepath=OUTPUT_GLB,
    export_format="GLB",
    use_selection=False,
    export_apply=True,
    export_yup=True,
)

file_size = os.path.getsize(OUTPUT_GLB)
print(f"\n[step5] Exported: {OUTPUT_GLB}")
print(f"[step5] File size: {file_size / 1024 / 1024:.1f} MB")
print(f"[step5] Created {len(created_zone_objects)} zone mesh objects")
print("[step5] Done!")
