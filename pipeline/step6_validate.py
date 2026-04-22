#!/usr/bin/env python3
"""Step 6: Validate masks — check that every zone has a non-zero-size PNG mask.

Reads panel_metadata.json and verifies masks exist in both pipeline_output/masks/
and public/masks/$MODEL_NAME/.

Environment variables:
  OUTPUT_DIR   — pipeline output directory
  MODEL_NAME   — model name
  MOCKBOX_ROOT — project root
"""
import json
import os
import sys

OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "")
MODEL_NAME = os.environ.get("MODEL_NAME", "")
MOCKBOX_ROOT = os.environ.get("MOCKBOX_ROOT", "")

if not OUTPUT_DIR or not MODEL_NAME:
    print("ERROR: OUTPUT_DIR and MODEL_NAME must be set")
    sys.exit(1)

metadata_path = os.path.join(OUTPUT_DIR, "panel_metadata.json")
if not os.path.exists(metadata_path):
    print(f"ERROR: {metadata_path} not found. Run step 4d first.")
    sys.exit(1)

with open(metadata_path) as f:
    metadata = json.load(f)

zones = metadata.get("zones", {})
mask_size = metadata.get("mask_size", 0)

print(f"Mask size: {mask_size}x{mask_size}")
print(f"Zones to validate: {len(zones)}")

errors = []
warnings = []

# Check pipeline output masks
mask_dir = os.path.join(OUTPUT_DIR, "masks")
for zone_name, zone_info in sorted(zones.items()):
    mask_file = zone_info.get("mask_file", f"{zone_name}.png")
    mask_path = os.path.join(mask_dir, mask_file)

    if not os.path.exists(mask_path):
        errors.append(f"  MISSING: {mask_path}")
    else:
        size = os.path.getsize(mask_path)
        if size == 0:
            errors.append(f"  EMPTY: {mask_path}")
        else:
            tri_count = zone_info.get("triangle_count", 0)
            print(f"  OK  {zone_name:25s}: {size:8d} bytes, {tri_count:5d} triangles")

# Check public masks
if MOCKBOX_ROOT:
    public_dir = os.path.join(MOCKBOX_ROOT, "public", "masks", MODEL_NAME)
    print(f"\nPublic masks dir: {public_dir}")
    if not os.path.exists(public_dir):
        warnings.append(f"  Public masks dir does not exist: {public_dir}")
    else:
        for zone_name, zone_info in sorted(zones.items()):
            mask_file = zone_info.get("mask_file", f"{zone_name}.png")
            mask_path = os.path.join(public_dir, mask_file)
            if not os.path.exists(mask_path):
                warnings.append(f"  MISSING public mask: {mask_path}")
            elif os.path.getsize(mask_path) == 0:
                warnings.append(f"  EMPTY public mask: {mask_path}")
            else:
                print(f"  OK  {zone_name}")

# Check GLB output
glb_path = os.path.join(MOCKBOX_ROOT, "public", "models", f"{MODEL_NAME}_panels.glb") if MOCKBOX_ROOT else None
if glb_path and os.path.exists(glb_path):
    size_mb = os.path.getsize(glb_path) / 1024 / 1024
    print(f"\nPanels GLB: {glb_path} ({size_mb:.1f} MB)")
else:
    warnings.append(f"  Panels GLB not found: {glb_path}")

print(f"\n{'='*60}")
if errors:
    print(f"  ERRORS ({len(errors)}):")
    for e in errors:
        print(e)
if warnings:
    print(f"  WARNINGS ({len(warnings)}):")
    for w in warnings:
        print(w)
if not errors and not warnings:
    print("  ALL CHECKS PASSED")
print(f"{'='*60}")

sys.exit(1 if errors else 0)
