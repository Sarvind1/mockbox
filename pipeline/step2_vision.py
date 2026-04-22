#!/usr/bin/env python3
"""Step 2: Generate name_mapping.json template from mesh_manifest.json.

Reads the manifest and creates a name_mapping.json with all meshes set to "unmapped".
The agent/user then fills in the mapping before step 3.

Environment variables:
  OUTPUT_DIR  — pipeline output directory
  MODEL_NAME  — model name
"""
import json
import os
import sys

OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "")
MODEL_NAME = os.environ.get("MODEL_NAME", "")

if not OUTPUT_DIR or not MODEL_NAME:
    print("ERROR: OUTPUT_DIR and MODEL_NAME must be set")
    sys.exit(1)

manifest_path = os.path.join(OUTPUT_DIR, "mesh_manifest.json")
if not os.path.exists(manifest_path):
    print(f"ERROR: {manifest_path} not found. Run step 1 first.")
    sys.exit(1)

with open(manifest_path) as f:
    manifest = json.load(f)

meshes = manifest.get("meshes", [])

# Create template mapping — all unmapped
name_mapping = {}
unmapped = []
for m in meshes:
    name = m["name"]
    unmapped.append(name)

output = {
    "name_mapping": name_mapping,
    "unmapped": unmapped,
}

out_path = os.path.join(OUTPUT_DIR, "name_mapping.json")
with open(out_path, "w") as f:
    json.dump(output, f, indent=2)

print(f"Generated name_mapping template: {out_path}")
print(f"  {len(unmapped)} meshes to map")
print(f"\nNext: fill in name_mapping.json, then run step 3.")
