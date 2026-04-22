"""Step 4c-symmetry: Automated mirror-symmetry review and correction.

Runs after step4c, before step4d. Loads step4c_seeded.blend + face_to_zone.json,
detects the car's mirror plane, pairs left/right zones, identifies asymmetries,
and fixes them by mirroring face assignments from the "better" side.

Outputs:
  - Updated face_to_zone.json (backed up as face_to_zone_pre_symmetry.json)
  - Updated step4c_seeded.blend with rebuilt vertex groups + colors
  - Symmetry report printed to stdout
  - Re-rendered validation views
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
import colorsys
from collections import Counter, defaultdict

OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "")
MODEL_NAME = os.environ.get("MODEL_NAME", "")
MOCKBOX_ROOT = os.environ.get("MOCKBOX_ROOT", "")

# Symmetry tolerance: paired zones with face count ratio below this are "asymmetric"
SYMMETRY_TOLERANCE = float(os.environ.get("SYMMETRY_TOLERANCE", "0.25"))

# Expected zones for a standard car (with min face fraction of total carpaint)
STANDARD_ZONES = {
    "hood":          {"min_frac": 0.02, "center": True},
    "roof":          {"min_frac": 0.01, "center": True},
    "trunk":         {"min_frac": 0.01, "center": True},
    "bumper_front":  {"min_frac": 0.02, "center": True},
    "bumper_rear":   {"min_frac": 0.02, "center": True},
    "fender_f_l":    {"min_frac": 0.01, "center": False, "mirror": "fender_f_r"},
    "fender_f_r":    {"min_frac": 0.01, "center": False, "mirror": "fender_f_l"},
    "door_f_l":      {"min_frac": 0.01, "center": False, "mirror": "door_f_r"},
    "door_f_r":      {"min_frac": 0.01, "center": False, "mirror": "door_f_l"},
}

if not OUTPUT_DIR or not MODEL_NAME:
    print("ERROR: OUTPUT_DIR and MODEL_NAME must be set")
    sys.exit(1)

# ── Load data ──
blend_path = os.path.join(OUTPUT_DIR, "step4c_seeded.blend")
ftz_path = os.path.join(OUTPUT_DIR, "face_to_zone.json")

if not os.path.exists(blend_path):
    print(f"ERROR: {blend_path} not found. Run Step 4c first.")
    sys.exit(1)
if not os.path.exists(ftz_path):
    print(f"ERROR: {ftz_path} not found. Run Step 4c first.")
    sys.exit(1)

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
    print(f"WARNING: No carpaint mesh found. Using largest mesh: {combined.name}")

print(f"Mesh: {combined.name} ({len(combined.data.polygons)} faces)")
print(f"Zones in face_to_zone.json: {len(set(face_to_zone.values()))}")

# ── Compute face centroids in world space ──
bm = bmesh.new()
bm.from_mesh(combined.data)
bm.faces.ensure_lookup_table()

num_faces = len(bm.faces)
face_centroids = {}
face_normals = {}
for face in bm.faces:
    center = combined.matrix_world @ face.calc_center_median()
    normal = (combined.matrix_world.to_3x3() @ face.normal).normalized()
    face_centroids[face.index] = center
    face_normals[face.index] = normal

# ── Detect mirror plane ──
# Compute overall centroid of all carpaint vertices
all_verts = []
for v in bm.verts:
    all_verts.append(combined.matrix_world @ v.co)

centroid = mathutils.Vector((0, 0, 0))
for v in all_verts:
    centroid += v
centroid /= len(all_verts)

# Test each axis: reflect all vertices across centroid, measure how well they match
def mirror_score(axis):
    """Lower = more symmetric. Measures average nearest-neighbor distance after reflection."""
    from mathutils import kdtree
    size = len(all_verts)
    kd = kdtree.KDTree(size)
    for i, v in enumerate(all_verts):
        kd.insert(v, i)
    kd.balance()

    total_dist = 0
    for v in all_verts:
        mirrored = v.copy()
        mirrored[axis] = 2 * centroid[axis] - mirrored[axis]
        _, _, dist = kd.find(mirrored)
        total_dist += dist
    return total_dist / size

scores = [(axis, mirror_score(axis)) for axis in range(3)]
scores.sort(key=lambda x: x[1])
MIRROR_AXIS = scores[0][0]
MIRROR_CENTER = centroid[MIRROR_AXIS]
axis_names = ["X", "Y", "Z"]

print(f"\n{'='*60}")
print(f"  MIRROR PLANE DETECTION")
print(f"{'='*60}")
for axis, score in scores:
    marker = " <-- BEST" if axis == MIRROR_AXIS else ""
    print(f"  {axis_names[axis]}-axis: avg mirror distance = {score:.4f}{marker}")
print(f"  Mirror plane: {axis_names[MIRROR_AXIS]} = {MIRROR_CENTER:.3f}")

# ── Detect axes (same logic as step4c) ──
bb_min = [float("inf")] * 3
bb_max = [float("-inf")] * 3
for corner in combined.bound_box:
    wc = combined.matrix_world @ mathutils.Vector(corner)
    for i in range(3):
        bb_min[i] = min(bb_min[i], wc[i])
        bb_max[i] = max(bb_max[i], wc[i])
bb_size = [bb_max[i] - bb_min[i] for i in range(3)]

# WIDTH_AXIS should be the mirror axis
WIDTH_AXIS = MIRROR_AXIS
remaining = [i for i in range(3) if i != WIDTH_AXIS]
if bb_size[remaining[0]] >= bb_size[remaining[1]]:
    LENGTH_AXIS = remaining[0]
    HEIGHT_AXIS = remaining[1]
else:
    LENGTH_AXIS = remaining[1]
    HEIGHT_AXIS = remaining[0]

print(f"  Axes: LENGTH={axis_names[LENGTH_AXIS]} WIDTH={axis_names[WIDTH_AXIS]} HEIGHT={axis_names[HEIGHT_AXIS]}")

# ── Classify each face as left/right/center ──
SIDE_THRESHOLD = 0.03 * bb_size[MIRROR_AXIS]  # faces within 3% of center are "center"

def face_side(fidx):
    c = face_centroids[fidx]
    offset = c[MIRROR_AXIS] - MIRROR_CENTER
    if abs(offset) < SIDE_THRESHOLD:
        return "center"
    elif offset < 0:
        return "left"
    else:
        return "right"

# ── Build zone statistics ──
zone_faces = defaultdict(set)
for fidx, zone in face_to_zone.items():
    zone_faces[zone].add(fidx)

zone_stats = {}
for zone, faces in zone_faces.items():
    sides = Counter(face_side(f) for f in faces)
    total = len(faces)
    centroid_z = mathutils.Vector((0, 0, 0))
    for f in faces:
        centroid_z += face_centroids[f]
    centroid_z /= total

    zone_stats[zone] = {
        "count": total,
        "left": sides.get("left", 0),
        "right": sides.get("right", 0),
        "center": sides.get("center", 0),
        "centroid": centroid_z,
        "side": "left" if sides.get("left", 0) > sides.get("right", 0) * 2 else
                "right" if sides.get("right", 0) > sides.get("left", 0) * 2 else
                "center",
    }

# ── Pair zones by name ──
# Pattern: _l <-> _r, _fl <-> _fr, _rl <-> _rr
def mirror_zone_name(name):
    """Return the expected mirror zone name, or None for center zones."""
    replacements = [
        ("_f_l", "_f_r"), ("_f_r", "_f_l"),
        ("_r_l", "_r_r"), ("_r_r", "_r_l"),
        ("_fl", "_fr"), ("_fr", "_fl"),
        ("_rl", "_rr"), ("_rr", "_rl"),
        ("_l_", "_r_"), ("_r_", "_l_"),
        ("_l", "_r"), ("_r", "_l"),
    ]
    for old, new in replacements:
        if name.endswith(old):
            return name[:-len(old)] + new
        # Handle suffixed versions like door_f_l_1 -> door_f_r_1
        for i in range(len(name) - len(old)):
            if name[i:i+len(old)] == old and (i + len(old) == len(name) or name[i+len(old)] == '_'):
                candidate = name[:i] + new + name[i+len(old):]
                return candidate
    return None

print(f"\n{'='*60}")
print(f"  ZONE PAIRING & SYMMETRY ANALYSIS")
print(f"{'='*60}")

paired = set()
pairs = []
unpaired_sides = []
center_zones = []

all_zones = sorted(zone_faces.keys())
for zone in all_zones:
    if zone in paired:
        continue
    mirror_name = mirror_zone_name(zone)
    stats = zone_stats[zone]

    if mirror_name and mirror_name in zone_faces:
        # Found a pair
        mirror_stats = zone_stats[mirror_name]
        paired.add(zone)
        paired.add(mirror_name)

        # Compute asymmetry ratio
        count_a, count_b = stats["count"], mirror_stats["count"]
        ratio = abs(count_a - count_b) / max(count_a, count_b)
        is_symmetric = ratio <= SYMMETRY_TOLERANCE

        pairs.append({
            "left": zone if stats["side"] == "left" else mirror_name,
            "right": mirror_name if stats["side"] == "left" else zone,
            "left_count": stats["count"] if stats["side"] == "left" else mirror_stats["count"],
            "right_count": mirror_stats["count"] if stats["side"] == "left" else stats["count"],
            "ratio": ratio,
            "symmetric": is_symmetric,
        })
    elif mirror_name and mirror_name not in zone_faces:
        # Side zone with no mirror counterpart
        unpaired_sides.append(zone)
    else:
        # Center zone or unclassified
        center_zones.append(zone)

# Also try to pair by spatial proximity: for unpaired side zones, find their mirror match
# among other unpaired zones or among zones with suffixed names
spatially_paired = []
remaining_unpaired = []
for zone in unpaired_sides:
    stats = zone_stats[zone]
    mirror_pos = stats["centroid"].copy()
    mirror_pos[MIRROR_AXIS] = 2 * MIRROR_CENTER - mirror_pos[MIRROR_AXIS]

    best_match = None
    best_dist = float("inf")
    for other in unpaired_sides:
        if other == zone or other in paired:
            continue
        other_stats = zone_stats[other]
        if other_stats["side"] == stats["side"]:
            continue  # Same side, can't be a mirror
        dist = (other_stats["centroid"] - mirror_pos).length
        if dist < best_dist:
            best_dist = dist
            best_match = other

    # Also check among all zones not yet paired
    for other in all_zones:
        if other == zone or other in paired:
            continue
        other_stats = zone_stats[other]
        if other_stats["side"] == stats["side"]:
            continue
        dist = (other_stats["centroid"] - mirror_pos).length
        if dist < best_dist:
            best_dist = dist
            best_match = other

    # Accept if within reasonable distance (< 10% of car length)
    if best_match and best_dist < bb_size[LENGTH_AXIS] * 0.1:
        paired.add(zone)
        paired.add(best_match)
        left_z = zone if stats["side"] == "left" else best_match
        right_z = best_match if stats["side"] == "left" else zone
        count_a = zone_stats[left_z]["count"]
        count_b = zone_stats[right_z]["count"]
        ratio = abs(count_a - count_b) / max(count_a, count_b)
        pairs.append({
            "left": left_z,
            "right": right_z,
            "left_count": count_a,
            "right_count": count_b,
            "ratio": ratio,
            "symmetric": ratio <= SYMMETRY_TOLERANCE,
            "spatial_match": True,
        })
    else:
        remaining_unpaired.append(zone)

# Print pairing results
for p in pairs:
    status = "OK" if p["symmetric"] else "ASYMMETRIC"
    spatial = " (spatial)" if p.get("spatial_match") else ""
    print(f"  [{status:10s}] {p['left']:25s} ({p['left_count']:5d}) <-> {p['right']:25s} ({p['right_count']:5d})  ratio={p['ratio']:.2f}{spatial}")

if center_zones:
    print(f"\n  Center zones (no mirror pair expected):")
    for z in center_zones:
        print(f"    {z:25s} ({zone_stats[z]['count']:5d} faces, side={zone_stats[z]['side']})")

if remaining_unpaired:
    print(f"\n  Unpaired side zones (missing mirror counterpart):")
    for z in remaining_unpaired:
        print(f"    {z:25s} ({zone_stats[z]['count']:5d} faces, side={zone_stats[z]['side']})")

# ── Check against standard zones ──
print(f"\n{'='*60}")
print(f"  STANDARD ZONE CHECK")
print(f"{'='*60}")

total_faces = len(face_to_zone)
existing_zones = set(zone_faces.keys())

# Aggregate zones with suffixes (e.g., bumper_rear + bumper_rear_1 + ...)
def aggregate_base_name(zone_name):
    """Strip trailing _N suffix to get base name."""
    parts = zone_name.rsplit("_", 1)
    if len(parts) == 2 and parts[1].isdigit():
        return parts[0]
    return zone_name

base_zone_counts = defaultdict(int)
base_zone_members = defaultdict(list)
for zone, stats in zone_stats.items():
    base = aggregate_base_name(zone)
    base_zone_counts[base] += stats["count"]
    base_zone_members[base].append(zone)

for expected, spec in STANDARD_ZONES.items():
    base = aggregate_base_name(expected)
    if base in base_zone_counts:
        frac = base_zone_counts[base] / total_faces
        min_frac = spec["min_frac"]
        status = "OK" if frac >= min_frac else "SMALL"
        members = base_zone_members[base]
        member_str = ", ".join(members) if len(members) > 1 else ""
        extra = f" [{member_str}]" if member_str else ""
        print(f"  [{status:5s}] {expected:20s}: {base_zone_counts[base]:5d} faces ({frac*100:.1f}%){extra}")
    else:
        print(f"  [MISS ] {expected:20s}: not found!")

# ── Build face correspondence map for mirror fixes ──
print(f"\n{'='*60}")
print(f"  SYMMETRY FIXES")
print(f"{'='*60}")

asymmetric_pairs = [p for p in pairs if not p["symmetric"]]
needs_fix = len(asymmetric_pairs) > 0 or len(remaining_unpaired) > 0

if not needs_fix:
    print("  No asymmetric pairs or unpaired zones found. All zones are symmetric!")
    bm.free()
else:
    # Build KD-tree for all face centroids on each side
    from mathutils import kdtree

    left_faces = [f for f in range(num_faces) if face_side(f) == "left"]
    right_faces = [f for f in range(num_faces) if face_side(f) == "right"]

    kd_left = kdtree.KDTree(len(left_faces))
    for i, fidx in enumerate(left_faces):
        kd_left.insert(face_centroids[fidx], fidx)
    kd_left.balance()

    kd_right = kdtree.KDTree(len(right_faces))
    for i, fidx in enumerate(right_faces):
        kd_right.insert(face_centroids[fidx], fidx)
    kd_right.balance()

    fixes_applied = 0
    faces_reassigned = 0

    # ── First: merge fragmented sub-zones into their base zone ──
    print(f"\n  Merging fragmented sub-zones...")
    merge_count = 0

    for pair in pairs:
        left_base = pair["left"]
        right_base = pair["right"]

        for base_zone, side in [(left_base, "left"), (right_base, "right")]:
            base_name = aggregate_base_name(base_zone)
            suffixed = [z for z in all_zones if z != base_zone
                        and aggregate_base_name(z) == base_name
                        and zone_stats[z]["side"] == side]
            for suffix_zone in suffixed:
                for fidx in list(zone_faces[suffix_zone]):
                    face_to_zone[fidx] = base_zone
                    merge_count += 1
                print(f"    Merged {suffix_zone} ({zone_stats[suffix_zone]['count']} faces) -> {base_zone}")

    # Also merge suffixed center zones
    for zone in center_zones:
        base_name = aggregate_base_name(zone)
        if base_name != zone:
            # This is a suffixed center zone — find the base
            base_candidates = [z for z in center_zones if z == base_name]
            if base_candidates:
                for fidx in list(zone_faces[zone]):
                    face_to_zone[fidx] = base_candidates[0]
                    merge_count += 1
                print(f"    Merged {zone} ({zone_stats[zone]['count']} faces) -> {base_candidates[0]}")

    print(f"    Total faces merged: {merge_count}")

    # Rebuild zone_faces after merging
    zone_faces = defaultdict(set)
    for fidx, zone in face_to_zone.items():
        zone_faces[zone].add(fidx)

    # ── Inverse mirror: for each target-side face, find which zone it belongs to ──
    # by mirroring its centroid to the reference side and looking up the zone there.
    # This is more robust than the forward approach because every target face gets
    # exactly one assignment — no many-to-one collisions.

    # Build KD-tree of ALL face centroids (not per-side) for reference lookups
    kd_all = kdtree.KDTree(num_faces)
    for fidx in range(num_faces):
        kd_all.insert(face_centroids[fidx], fidx)
    kd_all.balance()

    # Determine which side is the "reference" side based on zone quality.
    # Count how many zones exist on each side — the side with more distinct zones
    # (less merging happened) is likely the better-segmented side.
    left_zone_count = sum(1 for z, s in zone_stats.items() if s["side"] == "left")
    right_zone_count = sum(1 for z, s in zone_stats.items() if s["side"] == "right")
    ref_side = "left" if left_zone_count >= right_zone_count else "right"
    target_side = "right" if ref_side == "left" else "left"
    target_face_list = right_faces if ref_side == "left" else left_faces
    print(f"\n  Reference side: {ref_side} ({left_zone_count if ref_side == 'left' else right_zone_count} zones)")
    print(f"  Target side: {target_side} ({len(target_face_list)} faces to reassign)")

    # For each face on the target side, mirror it to the reference side,
    # find the nearest reference face, and adopt its zone (with L/R name flip)
    reassigned = 0
    for target_fidx in target_face_list:
        mirrored_pos = face_centroids[target_fidx].copy()
        mirrored_pos[MIRROR_AXIS] = 2 * MIRROR_CENTER - mirrored_pos[MIRROR_AXIS]

        # Find nearest face on the reference side
        co, ref_fidx, dist = kd_all.find(mirrored_pos)
        if ref_fidx is None:
            continue

        # Check the reference face is actually on the reference side
        if face_side(ref_fidx) != ref_side and face_side(ref_fidx) != "center":
            # Fell on the wrong side — skip (rare, means mirror plane is off)
            continue

        ref_zone = face_to_zone.get(ref_fidx)
        if ref_zone is None:
            continue

        # Flip the zone name to the target side
        target_zone = mirror_zone_name(ref_zone)
        if target_zone is None:
            # Center zone — keep as-is
            target_zone = ref_zone

        old_zone = face_to_zone.get(target_fidx)
        if old_zone != target_zone:
            face_to_zone[target_fidx] = target_zone
            reassigned += 1

    print(f"  Reassigned {reassigned} faces on {target_side} side via inverse mirror")
    fixes_applied += 1
    faces_reassigned += reassigned

    bm.free()

    # ── Rebuild zone_faces from updated face_to_zone ──
    zone_faces_new = defaultdict(set)
    for fidx, zone in face_to_zone.items():
        zone_faces_new[zone].add(fidx)

    # Remove empty zones
    empty_zones = [z for z, faces in zone_faces_new.items() if len(faces) == 0]
    for z in empty_zones:
        print(f"    Removed empty zone: {z}")

    # ── Print final zone summary ──
    print(f"\n{'='*60}")
    print(f"  FINAL ZONE SUMMARY (after symmetry fixes)")
    print(f"{'='*60}")

    final_zones = {z: faces for z, faces in zone_faces_new.items() if len(faces) > 0}
    for zone in sorted(final_zones.keys()):
        count = len(final_zones[zone])
        mirror = mirror_zone_name(zone)
        if mirror and mirror in final_zones:
            mirror_count = len(final_zones[mirror])
            ratio = abs(count - mirror_count) / max(count, mirror_count)
            sym_status = "OK" if ratio <= SYMMETRY_TOLERANCE else "ASYM"
            print(f"  {zone:25s}: {count:5d} faces  (mirror: {mirror} = {mirror_count}, ratio={ratio:.2f} [{sym_status}])")
        else:
            print(f"  {zone:25s}: {count:5d} faces")

    print(f"\n  Total zones: {len(final_zones)}")
    print(f"  Fixes applied: {fixes_applied}")
    print(f"  Faces reassigned: {faces_reassigned}")
    print(f"  Sub-zones merged: {merge_count}")

    # ── Back up old face_to_zone.json ──
    import shutil
    backup_path = os.path.join(OUTPUT_DIR, "face_to_zone_pre_symmetry.json")
    shutil.copy2(ftz_path, backup_path)
    print(f"\n  Backed up original: {backup_path}")

    # ── Write updated face_to_zone.json ──
    # Convert keys to strings for JSON
    face_to_zone_str = {str(k): v for k, v in face_to_zone.items()}
    with open(ftz_path, "w") as f:
        json.dump(face_to_zone_str, f)
    print(f"  Updated: {ftz_path}")

    # ── Rebuild vertex groups from face_to_zone ──
    combined.vertex_groups.clear()
    zone_names = sorted(final_zones.keys())
    vgroups = {}
    for name in zone_names:
        vg = combined.vertex_groups.new(name=name)
        vgroups[name] = vg

    mesh_data = combined.data
    for face in mesh_data.polygons:
        zone = face_to_zone.get(face.index)
        if zone and zone in vgroups:
            vgroups[zone].add(list(face.vertices), 1.0, 'REPLACE')

    print(f"  Rebuilt {len(vgroups)} vertex groups")

    # ── Rebuild color-coded faces ──
    def generate_colors(names):
        colors = {}
        KNOWN_COLORS = {
            "hood":          (0.2, 0.6, 1.0, 1.0),
            "roof":          (0.0, 0.8, 0.2, 1.0),
            "trunk":         (1.0, 0.8, 0.0, 1.0),
            "bumper_front":  (1.0, 0.2, 0.2, 1.0),
            "bumper_rear":   (0.8, 0.0, 0.4, 1.0),
        }
        for i, name in enumerate(names):
            hue = i / max(len(names), 1)
            r, g, b = colorsys.hsv_to_rgb(hue, 0.8, 0.9)
            colors[name] = (r, g, b, 1.0)
            for known, color in KNOWN_COLORS.items():
                if name == known or name.startswith(known):
                    colors[name] = color
                    break
        return colors

    ZONE_COLORS = generate_colors(zone_names)

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

    # ── Re-setup emission material ──
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
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Strength"].default_value = 1.0
    vc_node = nodes.new("ShaderNodeVertexColor")
    vc_node.layer_name = "zone_colors"
    links.new(vc_node.outputs["Color"], emission.inputs["Color"])
    links.new(emission.outputs["Emission"], output_node.inputs["Surface"])

    combined.data.materials.clear()
    combined.data.materials.append(vc_mat)

    # ── Save blend file ──
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"  Saved: {blend_path}")

    # ── Hide non-carpaint meshes ──
    for obj in bpy.data.objects:
        if obj.type == "MESH" and obj != combined:
            obj.hide_render = True
            obj.hide_viewport = True

    # ── Re-render validation views ──
    bpy.context.scene.render.engine = "BLENDER_EEVEE"
    bpy.context.scene.render.resolution_x = 1920
    bpy.context.scene.render.resolution_y = 1080
    bpy.context.scene.render.film_transparent = True

    cam_data = bpy.data.cameras.new("SymCam")
    cam_obj = bpy.data.objects.new("SymCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj

    center = mathutils.Vector([(bb_min[i] + bb_max[i]) / 2 for i in range(3)])
    extent = max(bb_size)
    cam_dist = extent * 1.8

    views = {
        "sym_front_left":  (-0.7, -0.7, 0.4),
        "sym_front_right": (0.7, -0.7, 0.4),
        "sym_left":        (-1, 0, 0.3),
        "sym_right":       (1, 0, 0.3),
        "sym_top":         (0, -0.01, 1),
        "sym_rear_left":   (-0.7, 0.7, 0.4),
        "sym_rear_right":  (0.7, 0.7, 0.4),
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
        print(f"  Rendered {view_name} -> {render_path}")

print(f"\n{'='*60}")
print(f"  Step 4c-symmetry complete.")
print(f"{'='*60}")
print(f"\nNext steps:")
print(f"  1. Review sym_*.png renders in $OUTPUT_DIR/validation/")
print(f"  2. Re-run render_zone_3d.py for per-zone 3D views")
print(f"  3. Proceed to step4d_export_masks.py")
