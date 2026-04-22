"""Step 4c: Dihedral angle edge detection + flood-fill zone segmentation.

Instead of spatial heuristics, this script:
1. Computes dihedral angle at every mesh edge
2. Treats edges above a threshold as zone boundaries (panel seam lines)
3. Flood-fills connected components between boundaries
4. Auto-labels clusters by normalized bounding-box position
5. Creates vertex groups for user refinement in Blender

Works on ANY car GLB with natural creases at panel seams.
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
from collections import deque

OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "")
MODEL_NAME = os.environ.get("MODEL_NAME", "")
MOCKBOX_ROOT = os.environ.get("MOCKBOX_ROOT", "")

# Dihedral angle threshold in degrees — edges above this are zone boundaries.
# 25° works well for most car GLBs. Lower = more zones, higher = fewer zones.
ANGLE_THRESHOLD = float(os.environ.get("ANGLE_THRESHOLD", "25"))

# Target number of final zones. Iterative merging continues until we hit this.
TARGET_ZONES = int(os.environ.get("TARGET_ZONES", "20"))

if not OUTPUT_DIR or not MODEL_NAME:
    print("ERROR: OUTPUT_DIR and MODEL_NAME must be set")
    sys.exit(1)

# Load the UV-unwrapped blend from Step 3
blend_path = os.path.join(OUTPUT_DIR, "step3_unwrapped.blend")
if not os.path.exists(blend_path):
    print(f"ERROR: {blend_path} not found. Run Step 3 first.")
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
    print(f"WARNING: No carpaint mesh found. Using largest mesh: {combined.name}")

print(f"Working with mesh: {combined.name} ({len(combined.data.polygons)} faces)")
print(f"Dihedral angle threshold: {ANGLE_THRESHOLD}°")
print(f"Target zones: {TARGET_ZONES}")

# ── Build adjacency graph with dihedral angle filtering ──
bm = bmesh.new()
bm.from_mesh(combined.data)
bm.edges.ensure_lookup_table()
bm.faces.ensure_lookup_table()

num_faces = len(bm.faces)
threshold_rad = math.radians(ANGLE_THRESHOLD)

# Build face adjacency: face_idx -> set of neighbor face indices (connected by soft edges)
adjacency = [set() for _ in range(num_faces)]
boundary_edge_count = 0
soft_edge_count = 0

for edge in bm.edges:
    if edge.is_boundary or len(edge.link_faces) != 2:
        continue
    angle = edge.calc_face_angle(0)
    if angle < threshold_rad:
        # Soft edge — faces are in the same zone
        f1, f2 = edge.link_faces[0].index, edge.link_faces[1].index
        adjacency[f1].add(f2)
        adjacency[f2].add(f1)
        soft_edge_count += 1
    else:
        boundary_edge_count += 1

print(f"Soft edges (< {ANGLE_THRESHOLD}°): {soft_edge_count}")
print(f"Boundary edges (>= {ANGLE_THRESHOLD}°): {boundary_edge_count}")

# ── Flood-fill connected components ──
cluster_id = [-1] * num_faces
clusters = []  # list of sets of face indices
current_id = 0

for start_face in range(num_faces):
    if cluster_id[start_face] != -1:
        continue
    # BFS flood fill
    queue = deque([start_face])
    cluster_id[start_face] = current_id
    cluster_faces = {start_face}

    while queue:
        face = queue.popleft()
        for neighbor in adjacency[face]:
            if cluster_id[neighbor] == -1:
                cluster_id[neighbor] = current_id
                cluster_faces.add(neighbor)
                queue.append(neighbor)

    clusters.append(cluster_faces)
    current_id += 1

print(f"\nFound {len(clusters)} raw clusters")

# Sort clusters by size (largest first)
clusters.sort(key=len, reverse=True)
# Reassign cluster IDs after sorting
cluster_id = [-1] * num_faces
for cid, faces in enumerate(clusters):
    for f in faces:
        cluster_id[f] = cid

# Show cluster size distribution
print(f"Top 20 clusters by size:")
for i, c in enumerate(clusters[:20]):
    print(f"  Cluster {i:3d}: {len(c):5d} faces")

# ── Build edge-based neighbor graph between clusters ──
# For each pair of adjacent clusters, count how many edges they share
cluster_neighbors = {}  # (cid_a, cid_b) -> shared_edge_count

for edge in bm.edges:
    if edge.is_boundary or len(edge.link_faces) != 2:
        continue
    f1, f2 = edge.link_faces[0].index, edge.link_faces[1].index
    c1, c2 = cluster_id[f1], cluster_id[f2]
    if c1 != c2:
        key = (min(c1, c2), max(c1, c2))
        cluster_neighbors[key] = cluster_neighbors.get(key, 0) + 1

# ── Iterative merging: keep merging smallest cluster into its best neighbor ──
# until we reach TARGET_ZONES
active_clusters = {i for i in range(len(clusters)) if len(clusters[i]) > 0}

def get_neighbors(cid):
    """Get all neighboring cluster IDs and their shared edge counts."""
    result = {}
    for (a, b), count in cluster_neighbors.items():
        if a == cid and b in active_clusters:
            result[b] = result.get(b, 0) + count
        elif b == cid and a in active_clusters:
            result[a] = result.get(a, 0) + count
    return result

iteration = 0
while len(active_clusters) > TARGET_ZONES:
    # Find the smallest active cluster
    smallest_cid = min(active_clusters, key=lambda c: len(clusters[c]))
    neighbors = get_neighbors(smallest_cid)

    if not neighbors:
        # Isolated cluster — merge into spatially nearest active cluster
        # Compute centroid of this cluster
        iso_center = mathutils.Vector((0,0,0))
        for fidx in clusters[smallest_cid]:
            face = bm.faces[fidx]
            iso_center += combined.matrix_world @ face.calc_center_median()
        iso_center /= max(len(clusters[smallest_cid]), 1)
        # Find nearest active cluster by centroid distance
        best_dist = float("inf")
        best_cid = None
        for other_cid in active_clusters:
            if other_cid == smallest_cid:
                continue
            other_center = mathutils.Vector((0,0,0))
            count = 0
            for fidx in list(clusters[other_cid])[:50]:  # sample for speed
                face = bm.faces[fidx]
                other_center += combined.matrix_world @ face.calc_center_median()
                count += 1
            if count > 0:
                other_center /= count
                d = (iso_center - other_center).length
                if d < best_dist:
                    best_dist = d
                    best_cid = other_cid
        if best_cid is None:
            active_clusters.discard(smallest_cid)
            continue
        best_neighbor = best_cid
        # Fall through to merge logic below
        neighbors = {best_neighbor: 1}

    # Merge into the neighbor sharing the most edges
    best_neighbor = max(neighbors, key=neighbors.get)

    # Transfer faces
    for fidx in clusters[smallest_cid]:
        cluster_id[fidx] = best_neighbor
    clusters[best_neighbor] |= clusters[smallest_cid]

    # Update neighbor graph: redirect all of smallest's edges to best_neighbor
    keys_to_remove = []
    keys_to_add = {}
    for (a, b), count in cluster_neighbors.items():
        if a == smallest_cid or b == smallest_cid:
            keys_to_remove.append((a, b))
            other = b if a == smallest_cid else a
            if other != best_neighbor:
                new_key = (min(other, best_neighbor), max(other, best_neighbor))
                keys_to_add[new_key] = keys_to_add.get(new_key, 0) + count

    for key in keys_to_remove:
        del cluster_neighbors[key]
    for key, count in keys_to_add.items():
        cluster_neighbors[key] = cluster_neighbors.get(key, 0) + count

    clusters[smallest_cid] = set()
    active_clusters.discard(smallest_cid)
    iteration += 1

# Rebuild final clusters
final_clusters = [clusters[cid] for cid in sorted(active_clusters, key=lambda c: len(clusters[c]), reverse=True)]
final_cluster_id = [-1] * num_faces
for new_cid, faces in enumerate(final_clusters):
    for f in faces:
        final_cluster_id[f] = new_cid

print(f"\nAfter iterative merging ({iteration} merges): {len(final_clusters)} zones")
for i, c in enumerate(final_clusters):
    print(f"  Zone {i:3d}: {len(c):5d} faces")

# ── Auto-label clusters by position ──
# Compute bounding box
bb_min = [float("inf")] * 3
bb_max = [float("-inf")] * 3
for corner in combined.bound_box:
    wc = combined.matrix_world @ mathutils.Vector(corner)
    for i in range(3):
        bb_min[i] = min(bb_min[i], wc[i])
        bb_max[i] = max(bb_max[i], wc[i])
bb_size = [bb_max[i] - bb_min[i] for i in range(3)]

# Detect axes
if bb_size[2] <= bb_size[0] and bb_size[2] <= bb_size[1]:
    HEIGHT_AXIS = 2
    remaining = [i for i in range(3) if i != 2]
    LENGTH_AXIS = max(remaining, key=lambda i: bb_size[i])
    WIDTH_AXIS = min(remaining, key=lambda i: bb_size[i])
elif bb_size[1] <= bb_size[0] and bb_size[1] <= bb_size[2]:
    HEIGHT_AXIS = 1
    remaining = [i for i in range(3) if i != 1]
    LENGTH_AXIS = max(remaining, key=lambda i: bb_size[i])
    WIDTH_AXIS = min(remaining, key=lambda i: bb_size[i])
else:
    HEIGHT_AXIS = 2
    LENGTH_AXIS = 1
    WIDTH_AXIS = 0

print(f"\nAxes: LENGTH={LENGTH_AXIS} WIDTH={WIDTH_AXIS} HEIGHT={HEIGHT_AXIS}")

def normalize(pos):
    return tuple((pos[i] - bb_min[i]) / bb_size[i] if bb_size[i] > 0 else 0.5 for i in range(3))

# Compute cluster centroids and average normals in normalized space
cluster_info = []
for cid, faces in enumerate(final_clusters):
    avg_pos = [0.0, 0.0, 0.0]
    avg_normal = [0.0, 0.0, 0.0]
    for fidx in faces:
        face = bm.faces[fidx]
        center = combined.matrix_world @ face.calc_center_median()
        normal = (combined.matrix_world.to_3x3() @ face.normal).normalized()
        npos = normalize(center)
        for i in range(3):
            avg_pos[i] += npos[i]
            avg_normal[i] += normal[i]
    n = len(faces)
    avg_pos = [p / n for p in avg_pos]
    avg_normal = [p / n for p in avg_normal]
    cluster_info.append({
        "cid": cid,
        "size": len(faces),
        "l": avg_pos[LENGTH_AXIS],   # 0=front, 1=back
        "w": avg_pos[WIDTH_AXIS],    # 0=one side, 1=other
        "h": avg_pos[HEIGHT_AXIS],   # 0=bottom, 1=top
        "nl": avg_normal[LENGTH_AXIS],
        "nw": avg_normal[WIDTH_AXIS],
        "nh": avg_normal[HEIGHT_AXIS],
    })

# Auto-label using cluster position + normal direction
def auto_label(info):
    l, w, h = info["l"], info["w"], info["h"]
    nh = info["nh"]  # up-pointing normal component

    is_top = nh > 0.4 and h > 0.6
    is_left = w < 0.4
    is_right = w > 0.6
    side = "_l" if is_left else ("_r" if is_right else "")

    # Top panels
    if is_top:
        if l < 0.35:
            return "hood"
        elif l > 0.70:
            return "trunk"
        else:
            return "roof"

    # Front/rear bumpers
    if l < 0.12:
        return "bumper_front"
    if l > 0.88:
        return "bumper_rear"

    # Bottom panels
    if h < 0.15:
        return "rocker" + side if side else "rocker_l"

    # Side panels (left or right)
    if is_left or is_right:
        if l < 0.28:
            return "fender_f" + side
        elif l < 0.48:
            return "door_f" + side
        elif l < 0.68:
            return "door_r" + side
        else:
            return "fender_r" + side

    return "cluster_" + str(info["cid"])

# Assign labels
cluster_labels = []
label_counts = {}
for info in cluster_info:
    label = auto_label(info)
    # Handle duplicate labels by appending a number
    if label in label_counts:
        label_counts[label] += 1
        label = f"{label}_{label_counts[label]}"
    else:
        label_counts[label] = 0
    cluster_labels.append(label)

print(f"\nAuto-labeled zones:")
for i, (label, info) in enumerate(zip(cluster_labels, cluster_info)):
    print(f"  {label:25s}: {info['size']:5d} faces  (l={info['l']:.2f} w={info['w']:.2f} h={info['h']:.2f})")

# ── Build face → zone mapping ──
face_to_zone = {}
for cid, faces in enumerate(final_clusters):
    label = cluster_labels[cid]
    for fidx in faces:
        face_to_zone[fidx] = label

bm.free()

# ── Create vertex groups ──
combined.vertex_groups.clear()
zone_names = list(dict.fromkeys(cluster_labels))  # preserve order, dedupe

vgroups = {}
for name in zone_names:
    vg = combined.vertex_groups.new(name=name)
    vgroups[name] = vg

mesh_data = combined.data
for face in mesh_data.polygons:
    zone = face_to_zone.get(face.index, "body_misc")
    if zone in vgroups:
        vgroups[zone].add(list(face.vertices), 1.0, 'REPLACE')

print(f"\nCreated {len(vgroups)} vertex groups")

# ── Color-code faces ──
# Generate distinct colors for each zone
import colorsys

def generate_colors(n):
    colors = {}
    for i, name in enumerate(zone_names):
        hue = i / max(n, 1)
        r, g, b = colorsys.hsv_to_rgb(hue, 0.8, 0.9)
        colors[name] = (r, g, b, 1.0)
    return colors

ZONE_COLORS = generate_colors(len(zone_names))

# Also define some fixed colors for known panel names
KNOWN_COLORS = {
    "hood":          (0.2, 0.6, 1.0, 1.0),
    "roof":          (0.0, 0.8, 0.2, 1.0),
    "trunk":         (1.0, 0.8, 0.0, 1.0),
    "bumper_front":  (1.0, 0.2, 0.2, 1.0),
    "bumper_rear":   (0.8, 0.0, 0.4, 1.0),
}
for name in zone_names:
    base = name.split("_")[0] if "_" in name else name
    # Check if any known color prefix matches
    for known, color in KNOWN_COLORS.items():
        if name == known or name.startswith(known):
            ZONE_COLORS[name] = color
            break

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

# ── Set up emission material for clear rendering ──
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

# ── Save face-to-zone mapping as JSON (reliable, no vertex group boundary issues) ──
face_zone_path = os.path.join(OUTPUT_DIR, "face_to_zone.json")
with open(face_zone_path, "w") as fzf:
    json.dump(face_to_zone, fzf)
print(f"Saved face mapping: {face_zone_path} ({len(face_to_zone)} faces)")

# ── Save the seeded blend file ──
out_blend = os.path.join(OUTPUT_DIR, "step4c_seeded.blend")
bpy.ops.wm.save_as_mainfile(filepath=out_blend)
print(f"\nSaved: {out_blend}")

# ── Hide non-carpaint meshes for clear validation renders ──
for obj in bpy.data.objects:
    if obj.type == "MESH" and obj != combined:
        obj.hide_render = True
        obj.hide_viewport = True

# ── Render validation views ──
bpy.context.scene.render.engine = "BLENDER_EEVEE"
bpy.context.scene.render.resolution_x = 1920
bpy.context.scene.render.resolution_y = 1080
bpy.context.scene.render.film_transparent = True

cam_data = bpy.data.cameras.new("ZoneCam")
cam_obj = bpy.data.objects.new("ZoneCam", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

center = mathutils.Vector([(bb_min[i] + bb_max[i]) / 2 for i in range(3)])
extent = max(bb_size)
cam_dist = extent * 1.8

views = {
    "seed_front_left":  (-0.7, -0.7, 0.4),
    "seed_front_right": (0.7, -0.7, 0.4),
    "seed_left":        (-1, 0, 0.3),
    "seed_right":       (1, 0, 0.3),
    "seed_top":         (0, -0.01, 1),
    "seed_rear_left":   (-0.7, 0.7, 0.4),
    "seed_rear_right":  (0.7, 0.7, 0.4),
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

# ── Print instructions ──
print(f"""
{'='*60}
  DIHEDRAL EDGE DETECTION COMPLETE
{'='*60}

Threshold: {ANGLE_THRESHOLD}° | Zones: {len(zone_names)} | Target: {TARGET_ZONES}

Open in Blender:  {out_blend}

Refine in Edit Mode (Tab > 3 for Face Select):
  - Click zone name in Vertex Groups > Select to see it
  - Fix boundaries: select faces > click correct zone > Assign > click old zone > Remove
  - Ctrl+S when done

Then run:  $BLENDER --background --python pipeline/step4d_export_masks.py

Zone legend:
""")
for name, color in ZONE_COLORS.items():
    r, g, b = int(color[0]*255), int(color[1]*255), int(color[2]*255)
    info = next((ci for ci in cluster_info if cluster_labels[ci["cid"]] == name), None)
    size = info["size"] if info else "?"
    print(f"  {name:25s}: RGB({r:3d}, {g:3d}, {b:3d}) — {size} faces")

print(f"\nStep 4c complete.")
