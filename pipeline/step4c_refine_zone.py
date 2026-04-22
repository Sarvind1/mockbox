"""Step 4c-refine: Targeted zone refinement via curvature split or local dihedral re-threshold.

Called per-zone by the orchestrator. Operates on step4c_seeded.blend + face_to_zone.json.
Splits a single zone into sub-zones, updates face_to_zone.json, then re-renders each
sub-zone individually using separate Blender processes (same approach as render_zone_3d.py).

Environment variables:
  OUTPUT_DIR        — pipeline output directory
  MODEL_NAME        — model name
  BLENDER           — path to Blender executable
  ZONE_NAME         — which zone to refine
  FIX_STRATEGY      — "curvature", "dihedral", or "both"
  NEW_THRESHOLD     — dihedral angle threshold for re-segmentation (default 15)
  CURVATURE_PERCENTILE — faces above this percentile of curvature are split out (default 90)
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
import subprocess
from collections import deque, defaultdict, Counter

OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "")
MODEL_NAME = os.environ.get("MODEL_NAME", "")
BLENDER = os.environ.get("BLENDER", "")
ZONE_NAME = os.environ.get("ZONE_NAME", "")
FIX_STRATEGY = os.environ.get("FIX_STRATEGY", "both")
NEW_THRESHOLD = float(os.environ.get("NEW_THRESHOLD", "15"))
CURVATURE_PERCENTILE = float(os.environ.get("CURVATURE_PERCENTILE", "90"))

if not OUTPUT_DIR or not MODEL_NAME or not ZONE_NAME:
    print("ERROR: OUTPUT_DIR, MODEL_NAME, and ZONE_NAME must be set")
    sys.exit(1)

# ── Load data ──
blend_path = os.path.join(OUTPUT_DIR, "step4c_seeded.blend")
ftz_path = os.path.join(OUTPUT_DIR, "face_to_zone.json")

bpy.ops.wm.open_mainfile(filepath=blend_path)

with open(ftz_path) as f:
    face_to_zone = {int(k): v for k, v in json.load(f).items()}

# Find carpaint mesh
combined = None
for obj in bpy.data.objects:
    if obj.type == "MESH" and "carpaint" in obj.name.lower():
        combined = obj
        break
if not combined:
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    combined = max(meshes, key=lambda o: len(o.data.polygons))

# Get faces belonging to this zone
zone_face_indices = {fidx for fidx, z in face_to_zone.items() if z == ZONE_NAME}

if not zone_face_indices:
    print(f"ERROR: Zone '{ZONE_NAME}' not found in face_to_zone.json")
    sys.exit(1)

zone_size = len(zone_face_indices)

print(f"Refining zone: {ZONE_NAME} ({zone_size} faces)")
print(f"Strategy: {FIX_STRATEGY}")

bm = bmesh.new()
bm.from_mesh(combined.data)
bm.edges.ensure_lookup_table()
bm.faces.ensure_lookup_table()

# ── Progressive threshold schedule (3 iterations, increasingly aggressive) ──
ITERATION_SCHEDULE = [
    {"min_cluster_pct": 0.05, "min_cluster_floor": 20, "curv_pct": 90, "label": "conservative"},
    {"min_cluster_pct": 0.02, "min_cluster_floor": 10, "curv_pct": 95, "label": "moderate"},
    {"min_cluster_pct": 0.01, "min_cluster_floor": 5,  "curv_pct": 97, "label": "aggressive"},
]
# Dihedral threshold also lowers each iteration: user value, -3°, -5°
DIHEDRAL_STEPS = [0, -3, -5]  # offsets from NEW_THRESHOLD

new_sub_zones = {}  # face_idx -> sub_zone_name


# ── Strategy 1: Curvature-based splitting ──
def curvature_split(min_cluster, curv_pct):
    """Find high-curvature face clusters within the zone and split them as trim."""
    print(f"\n  Curvature analysis (percentile={curv_pct}, min_cluster={min_cluster})...")

    face_curvatures = {}
    for fidx in zone_face_indices:
        face = bm.faces[fidx]
        angles = []
        for edge in face.edges:
            if len(edge.link_faces) == 2:
                angles.append(edge.calc_face_angle(0))
        face_curvatures[fidx] = sum(angles) / len(angles) if angles else 0.0

    sorted_curvatures = sorted(face_curvatures.values())
    if not sorted_curvatures:
        return {}

    p_idx = min(int(len(sorted_curvatures) * curv_pct / 100), len(sorted_curvatures) - 1)
    threshold = sorted_curvatures[p_idx]

    print(f"  Threshold (p{curv_pct}): {math.degrees(threshold):.1f}°")

    high_curv = {f for f, c in face_curvatures.items() if c >= threshold}
    if len(high_curv) < min_cluster:
        print(f"  Too few high-curvature faces ({len(high_curv)}) — skipping")
        return {}

    # Flood-fill clusters among high-curvature faces
    visited = set()
    clusters = []
    for start in high_curv:
        if start in visited:
            continue
        queue = deque([start])
        visited.add(start)
        cluster = {start}
        while queue:
            fidx = queue.popleft()
            for edge in bm.faces[fidx].edges:
                for lf in edge.link_faces:
                    if lf.index in high_curv and lf.index not in visited:
                        visited.add(lf.index)
                        cluster.add(lf.index)
                        queue.append(lf.index)
        clusters.append(cluster)

    significant = [c for c in clusters if len(c) >= min_cluster]
    print(f"  Clusters: {len(clusters)} total, {len(significant)} significant (>= {min_cluster} faces)")

    result = {}
    for i, cluster in enumerate(significant):
        name = f"{ZONE_NAME}_trim" if i == 0 else f"{ZONE_NAME}_trim_{i}"
        for fidx in cluster:
            result[fidx] = name
        print(f"    {name}: {len(cluster)} faces")
    return result


# ── Strategy 2: Local dihedral re-threshold ──
def dihedral_resegment(target_faces, threshold_deg, min_cluster):
    """Re-run dihedral detection at a lower threshold on the given faces."""
    print(f"\n  Local dihedral re-segmentation (threshold={threshold_deg}°, min_cluster={min_cluster}, {len(target_faces)} faces)...")

    threshold_rad = math.radians(threshold_deg)
    adjacency = defaultdict(set)
    boundary_count = 0

    for fidx in target_faces:
        for edge in bm.faces[fidx].edges:
            if len(edge.link_faces) != 2:
                continue
            f1, f2 = edge.link_faces[0].index, edge.link_faces[1].index
            if f1 not in target_faces or f2 not in target_faces:
                continue
            if edge.calc_face_angle(0) < threshold_rad:
                adjacency[f1].add(f2)
                adjacency[f2].add(f1)
            else:
                boundary_count += 1

    print(f"  Boundary edges: {boundary_count}")
    if boundary_count == 0:
        print("  No new boundaries — zone is uniformly smooth")
        return {}

    # Flood-fill
    visited = set()
    clusters = []
    for start in target_faces:
        if start in visited:
            continue
        queue = deque([start])
        visited.add(start)
        cluster = {start}
        while queue:
            fidx = queue.popleft()
            for nb in adjacency[fidx]:
                if nb not in visited:
                    visited.add(nb)
                    cluster.add(nb)
                    queue.append(nb)
        clusters.append(cluster)

    clusters.sort(key=len, reverse=True)
    print(f"  Sub-clusters: {len(clusters)}")

    if len(clusters) <= 1:
        print("  Only one cluster — no split")
        return {}

    significant = [c for c in clusters[1:] if len(c) >= min_cluster]
    noise_count = len(clusters) - 1 - len(significant)
    print(f"  Significant (>= {min_cluster}): {len(significant)}, noise discarded: {noise_count}")

    result = {}
    for i, cluster in enumerate(significant):
        name = f"{ZONE_NAME}_sub_{i+1}"
        for fidx in cluster:
            result[fidx] = name
        print(f"    {name}: {len(cluster)} faces")
    print(f"  Main cluster retains: {len(clusters[0])} faces")
    return result


# ── Progressive iteration loop ──
for iteration, params in enumerate(ITERATION_SCHEDULE):
    min_cluster = max(params["min_cluster_floor"], int(zone_size * params["min_cluster_pct"]))
    curv_pct = params["curv_pct"]
    dihed_threshold = max(10, NEW_THRESHOLD + DIHEDRAL_STEPS[iteration])

    print(f"\n{'='*50}")
    print(f"  ITERATION {iteration + 1}/3 — {params['label']}")
    print(f"  min_cluster={min_cluster}, curvature_p={curv_pct}, dihedral={dihed_threshold}°")
    print(f"{'='*50}")

    if FIX_STRATEGY in ("curvature", "both"):
        new_sub_zones.update(curvature_split(min_cluster, curv_pct))

    if FIX_STRATEGY in ("dihedral", "both"):
        remaining = zone_face_indices - set(new_sub_zones.keys())
        if remaining:
            new_sub_zones.update(dihedral_resegment(remaining, dihed_threshold, min_cluster))

    if new_sub_zones:
        print(f"\n  Found {len(set(new_sub_zones.values()))} sub-zones — stopping iteration")
        break
    else:
        print(f"\n  Nothing found at {params['label']} level — {'trying next level' if iteration < 2 else 'giving up'}")

bm.free()

# ── Apply & save ──
if not new_sub_zones:
    print(f"\nNo sub-elements found in {ZONE_NAME}. Zone is clean.")
    sys.exit(0)

for fidx, sub_zone in new_sub_zones.items():
    face_to_zone[fidx] = sub_zone

remaining_main = len(zone_face_indices) - len(new_sub_zones)
result_counts = Counter(new_sub_zones.values())
print(f"\nSplit results:")
print(f"  {ZONE_NAME}: {remaining_main} faces (main panel)")
for sub, count in sorted(result_counts.items()):
    print(f"  {sub}: {count} faces (split out)")

face_to_zone_str = {str(k): v for k, v in face_to_zone.items()}
with open(ftz_path, "w") as f:
    json.dump(face_to_zone_str, f)
print(f"Updated: {ftz_path}")

# ── Render each sub-zone individually via render_zone_3d approach ──
# Spawn one Blender process per sub-zone for EEVEE material_index refresh
if not BLENDER:
    print("BLENDER env var not set — skipping renders")
    sys.exit(0)

all_new_zones = [ZONE_NAME] + sorted(set(new_sub_zones.values()))
refine_dir = os.path.join(OUTPUT_DIR, "validation", "refine")
os.makedirs(refine_dir, exist_ok=True)

# Re-read face_to_zone from disk (we just wrote it)
RENDER_SCRIPT = r'''
import bpy, json, mathutils

ZONE = "{zone}"
FTZ = "{ftz}"
OUT = "{out}"

with open(FTZ) as f:
    ftz = json.load(f)

obj = None
for o in bpy.data.objects:
    if o.type == 'MESH' and 'carpaint' in o.name.lower():
        obj = o
        break
if not obj:
    obj = max((o for o in bpy.data.objects if o.type == 'MESH'), key=lambda o: len(o.data.polygons))

for o in bpy.data.objects:
    if o.type == 'MESH' and o != obj:
        o.hide_render = True
        o.hide_viewport = True

obj.data.materials.clear()

mat_dim = bpy.data.materials.new("dim")
mat_dim.use_nodes = True
n = mat_dim.node_tree.nodes; n.clear(); l = mat_dim.node_tree.links
o = n.new('ShaderNodeOutputMaterial'); e = n.new('ShaderNodeEmission')
e.inputs['Color'].default_value = (0.08, 0.08, 0.10, 1.0)
e.inputs['Strength'].default_value = 0.6
l.new(e.outputs[0], o.inputs[0])

mat_hi = bpy.data.materials.new("hi")
mat_hi.use_nodes = True
n = mat_hi.node_tree.nodes; n.clear(); l = mat_hi.node_tree.links
o = n.new('ShaderNodeOutputMaterial'); e = n.new('ShaderNodeEmission')
e.inputs['Color'].default_value = (1.0, 0.45, 0.0, 1.0)
e.inputs['Strength'].default_value = 2.5
l.new(e.outputs[0], o.inputs[0])

obj.data.materials.append(mat_dim)
obj.data.materials.append(mat_hi)

centers = []; normals = []
wm = obj.matrix_world
for p in obj.data.polygons:
    if ftz.get(str(p.index)) == ZONE:
        p.material_index = 1
        centers.append(wm @ p.center.copy())
        normals.append((wm.to_3x3() @ p.normal).normalized())
    else:
        p.material_index = 0
obj.data.update()

if not centers:
    print(f"No faces for zone"); import sys; sys.exit(0)

avg_c = mathutils.Vector((0,0,0))
avg_n = mathutils.Vector((0,0,0))
for c in centers: avg_c += c
for n in normals: avg_n += n
avg_c /= len(centers); avg_n.normalize()

bb = [wm @ mathutils.Vector(c) for c in obj.bound_box]
extent = (mathutils.Vector((max(c.x for c in bb), max(c.y for c in bb), max(c.z for c in bb))) -
          mathutils.Vector((min(c.x for c in bb), min(c.y for c in bb), min(c.z for c in bb)))).length

cam = None
for o in bpy.data.objects:
    if o.type == 'CAMERA': cam = o; break
if not cam:
    cd = bpy.data.cameras.new('C'); cam = bpy.data.objects.new('C', cd)
    bpy.context.scene.collection.objects.link(cam)
cam.location = avg_c + avg_n * extent * 0.8
cam.rotation_euler = (avg_c - cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.clip_start = 0.0001; cam.data.clip_end = 100; cam.data.lens = 50
bpy.context.scene.camera = cam

s = bpy.context.scene
s.render.engine = 'BLENDER_EEVEE'
s.render.resolution_x = 960; s.render.resolution_y = 640
s.render.film_transparent = True; s.render.filepath = OUT
if s.world:
    s.world.use_nodes = True
    for n in s.world.node_tree.nodes:
        if n.type == 'BACKGROUND': n.inputs['Strength'].default_value = 0.0
bpy.ops.render.render(write_still=True)
print(f"Rendered: " + OUT)
'''

print(f"\nRendering {len(all_new_zones)} sub-zones...")
for zone in all_new_zones:
    out_path = os.path.join(refine_dir, f"{zone}.png")
    script = RENDER_SCRIPT.format(
        zone=zone,
        ftz=ftz_path.replace("\\", "\\\\"),
        out=out_path.replace("\\", "\\\\"),
    )
    cmd = [BLENDER, "--background", blend_path, "--python-expr", script]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if r.returncode == 0 and os.path.exists(out_path):
        print(f"  {zone}: OK")
    else:
        print(f"  {zone}: FAILED")

print(f"\nRefinement of '{ZONE_NAME}' complete.")
print(f"Review images in: {refine_dir}/")
