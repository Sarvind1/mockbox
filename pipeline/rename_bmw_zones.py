"""Rename and merge BMW X5M dihedral canvas zones to proper panel names.

Run with:
  BLENDER --background --python pipeline/rename_bmw_zones.py
"""
import sys
import os
import json

_extra = os.path.expanduser("~/.blender_pip")
if _extra not in sys.path:
    sys.path.insert(0, _extra)

import bpy

OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "")
if not OUTPUT_DIR:
    print("ERROR: OUTPUT_DIR must be set")
    sys.exit(1)

blend_path = os.path.join(OUTPUT_DIR, "step4c_seeded.blend")
if not os.path.exists(blend_path):
    print(f"ERROR: {blend_path} not found")
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

# Print current vertex groups
vg_names = [vg.name for vg in combined.vertex_groups]
print(f"Current vertex groups ({len(vg_names)}): {vg_names}")

# ── Define the rename/merge mapping ──
# Format: { "new_name": ["old_name1", "old_name2", ...] }
# First old_name is the "primary" (rename target), rest get merged into it.
ZONE_MAPPING = {
    "bumper_front":  ["bumper_front"],
    "hood":          ["bumper_front_1"],
    "bumper_rear":   ["bumper_rear", "bumper_rear_2"],
    "tailgate":      ["bumper_rear_1", "bumper_rear_3"],
    "roof":          ["trunk", "trunk_1", "cluster_19"],
    "fender_f_l":    ["fender_f_l", "door_f_l"],
    "fender_f_r":    ["fender_f_r", "fender_f_r_1"],
    "door_l":        ["door_f_l_2"],
    "door_r":        ["door_f_r"],
    "quarter_r_l":   ["fender_r_l", "fender_r_l_1"],
    "quarter_r_r":   ["fender_r_r"],
    "body_misc":     ["door_f_l_1", "door_f_r_1"],
}

# Validate all old names exist
all_old_names = set()
for sources in ZONE_MAPPING.values():
    for name in sources:
        all_old_names.add(name)

missing = all_old_names - set(vg_names)
if missing:
    print(f"WARNING: These source vertex groups not found: {missing}")

extra = set(vg_names) - all_old_names
if extra:
    print(f"WARNING: These vertex groups are not in the mapping (will be removed): {extra}")

# ── Perform merges and renames ──
mesh_data = combined.data

for new_name, source_names in ZONE_MAPPING.items():
    # Find or create the target vertex group
    primary = source_names[0]

    # Get or create primary VG
    primary_vg = combined.vertex_groups.get(primary)
    if not primary_vg:
        print(f"  Creating new vertex group '{primary}' for target '{new_name}'")
        primary_vg = combined.vertex_groups.new(name=primary)

    # Merge secondary sources into primary
    for secondary_name in source_names[1:]:
        secondary_vg = combined.vertex_groups.get(secondary_name)
        if not secondary_vg:
            print(f"  Skipping merge of '{secondary_name}' (not found)")
            continue

        # Copy all vertex weights from secondary to primary
        sec_idx = secondary_vg.index
        for vert in mesh_data.vertices:
            try:
                w = secondary_vg.weight(vert.index)
                if w > 0:
                    try:
                        primary_vg.add([vert.index], w, 'REPLACE')
                    except Exception:
                        primary_vg.add([vert.index], w, 'ADD')
            except RuntimeError:
                pass  # vertex not in this group

        # Remove secondary vertex group
        combined.vertex_groups.remove(secondary_vg)
        print(f"  Merged '{secondary_name}' into '{primary}' and removed it")

    # Rename primary to new_name
    if primary != new_name:
        primary_vg.name = new_name
        print(f"  Renamed '{primary}' -> '{new_name}'")
    else:
        print(f"  Kept '{new_name}' as-is")

# Remove any remaining vertex groups that weren't in the mapping
for vg in list(combined.vertex_groups):
    if vg.name not in ZONE_MAPPING:
        combined.vertex_groups.remove(vg)
        print(f"  Removed unmapped vertex group: '{vg.name}'")

# Print final vertex groups
final_vg = [vg.name for vg in combined.vertex_groups]
print(f"\nFinal vertex groups ({len(final_vg)}): {final_vg}")

# ── Save the blend file ──
bpy.ops.wm.save_mainfile(filepath=blend_path)
print(f"Saved {blend_path}")

# ── Update face_to_zone.json ──
# Build old->new name mapping
old_to_new = {}
for new_name, source_names in ZONE_MAPPING.items():
    for old_name in source_names:
        old_to_new[old_name] = new_name

ftz_path = os.path.join(OUTPUT_DIR, "face_to_zone.json")
if os.path.exists(ftz_path):
    with open(ftz_path, "r") as f:
        face_to_zone = json.load(f)

    updated = {}
    for face_idx, old_zone in face_to_zone.items():
        updated[face_idx] = old_to_new.get(old_zone, "body_misc")

    with open(ftz_path, "w") as f:
        json.dump(updated, f, indent=2)

    # Print zone counts
    from collections import Counter
    counts = Counter(updated.values())
    print(f"\nUpdated face_to_zone.json ({len(updated)} faces):")
    for zone, count in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"  {zone:20s}: {count:5d} faces")
else:
    print(f"WARNING: {ftz_path} not found, skipping update")

print("\nDone! Vertex groups renamed and merged.")
