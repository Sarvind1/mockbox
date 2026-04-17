# Gemini-Orchestrated GLB Panel Tagging — Agent Guide

**For:** Claude sessions given a new car GLB to make pastable in MockBox.  
**How to use:** The human will say something like _"make porsche_911.glb pastable"_ or _"add Ferrari 488 using gemini"_. This guide tells you exactly what to delegate to Gemini and how to manage it.

---

## Golden Rule

**Claude writes nothing. Gemini does everything.**  
Your job is to write precise Gemini prompts, launch them with `gemini -p "..." --yolo`, monitor for stalls, and report results. Do not write scripts or edit source files directly.

---

## Overview of the 4 Gemini Invocations

| Invocation | What Gemini does | Typical duration |
|---|---|---|
| G1 — Inspect | Run inspect-glb.mjs, report materials + node hierarchy | 1–2 min |
| G2 — Split | Write + run split script, generate `*_panels.glb` | 3–6 min |
| G3 — Wire | Edit 5 source files (templates, model component, etc.) | 3–5 min |
| G4 — Verify | Fix thresholds, re-run split, start dev server, confirm 200 | 5–15 min |

Run them **sequentially** — each depends on the previous output.

---

## Before You Start: Gather These Facts

You need the following before writing any Gemini prompt:

1. **GLB filename** in `public/models/` (e.g., `porsche_911.glb`)
2. **Template id** the human wants (e.g., `"porsche-911"`)
3. **Scale** the human specifies (e.g., `[0.015, 0.015, 0.015]`)
4. **Node binary**: `/opt/homebrew/bin/node`
5. Check `scripts/` — does a `split-{car}-panels.mjs` already exist? If yes, skip G2 and just re-run it.

---

## G1 — GLB Inspection Prompt

```
gemini -p "Run this Node.js inspector on /Users/sarvind/mockbox/public/models/{car}.glb and report ALL output verbatim:

/opt/homebrew/bin/node scripts/inspect-glb.mjs public/models/{car}.glb

Report:
1. Every material name and index
2. Which material is the body paint (look for names containing: paint, carpaint, body, color, lacquer)
3. Which material is glass (look for: glass, window, windshield, crystal)
4. Which material is plastic trim (look for: plastic, trim, negro, black)
5. The full node hierarchy and any scale transforms on nodes
6. Whether there are MULTIPLE meshes sharing the same paint material — list their mesh names/indices" --yolo
```

**What to extract from G1 output:**
- `CARPAINT_MAT` = the paint material name (e.g., `"PAINT_COLOR_4"`, `"carpaint"`, `"M_Paint"`)
- `GLASS_MAT` = glass material name (or detect via `transmission > 0`)
- `TRIM_MAT` = trim/plastic material name
- `MULTI_MESH` = true/false — does the paint appear on multiple separate meshes?
- `SCALE_NODE` = does the hierarchy have a scale node wrapping everything? (Sketchfab models often do 100x)

---

## G2 — Split Script + GLB Generation Prompt

Craft this prompt based on G1 output. The critical split between **single-mesh** and **multi-mesh** cases:

### Single carpaint mesh (like BMW X5M)

```
gemini -p "Working in /Users/sarvind/mockbox.

Read scripts/split-bmw-panels.mjs as a reference. Create scripts/split-{car}-panels.mjs with these exact changes:
  INPUT  = 'public/models/{car}.glb'
  OUTPUT = 'public/models/{car}_panels.glb'
  TARGET_MAT = '{CARPAINT_MAT}'
  PANELS = [
    { name: 'bumper_front', test: (x,y,z) => z < 0.10 },
    { name: 'bumper_rear',  test: (x,y,z) => z > 0.90 },
    { name: 'hood',         test: (x,y,z) => y > 0.70 && z >= 0.10 && z < 0.35 },
    { name: 'roof',         test: (x,y,z) => y > 0.84 && z >= 0.35 && z <= 0.68 },
    { name: 'trunk',        test: (x,y,z) => y > 0.62 && z > 0.68 && z <= 0.90 },
    { name: 'fender_fl',    test: (x,y,z) => x < 0.25 && y > 0.42 && z >= 0.10 && z < 0.32 },
    { name: 'fender_fr',    test: (x,y,z) => x > 0.75 && y > 0.42 && z >= 0.10 && z < 0.32 },
    { name: 'door_fl',      test: (x,y,z) => x < 0.22 && y >= 0.25 && y <= 0.86 && z >= 0.28 && z < 0.50 },
    { name: 'door_fr',      test: (x,y,z) => x > 0.78 && y >= 0.25 && y <= 0.86 && z >= 0.28 && z < 0.50 },
    { name: 'door_rl',      test: (x,y,z) => x < 0.22 && y >= 0.25 && y <= 0.86 && z >= 0.50 && z <= 0.76 },
    { name: 'door_rr',      test: (x,y,z) => x > 0.78 && y >= 0.25 && y <= 0.86 && z >= 0.50 && z <= 0.76 },
    { name: 'rocker_l',     test: (x,y,z) => x < 0.20 && y < 0.35 && z > 0.12 && z < 0.88 },
    { name: 'rocker_r',     test: (x,y,z) => x > 0.80 && y < 0.35 && z > 0.12 && z < 0.88 },
    { name: 'body_misc',    test: () => true },
  ]

Use @gltf-transform/core v3 (already installed). Run with /opt/homebrew/bin/node.
Run the script after writing it. Report the bounding box and all panel triangle counts." --yolo
```

### Multi-mesh carpaint (like Porsche 911 — PAINT_COLOR_4 on 4 separate meshes)

Add these instructions to the prompt above:

```
IMPORTANT: This car has multiple separate meshes using the same paint material.
Modify the script to collect ALL meshes with material '{CARPAINT_MAT}':

  const targetPrims = [];
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial();
      if (mat && mat.getName() === TARGET_MAT) {
        for (const node of doc.getRoot().listNodes()) {
          if (node.getMesh() === mesh) {
            targetPrims.push({ prim, meshNode: node });
            break;
          }
        }
      }
    }
  }

- Compute a COMBINED bounding box from all their POSITION arrays
- Assign triangles from ALL source meshes to panels
- Attach new panel nodes to the parent of the FIRST carpaint node
- Detach ALL original carpaint mesh nodes at the end (not just one)
```

**What to extract from G2 output:**
- **Bounding box** — X[min..max] Y[min..max] Z[min..max]
- **Triangle counts** per panel — flag any panel with < 200 tris as needing threshold tuning
- **X-axis center** — compute: `nX_center = (0 - Xmin) / (Xmax - Xmin)`. If not ≈ 0.50, all left/right thresholds need shifting (see G4)
- The generated `*_panels.glb` file size (expect 5–15 MB)

---

## G3 — 5-File Wiring Prompt

Pass G2's bounding box and triangle counts into this prompt so Gemini can make informed decisions.

```
gemini -p "Working in /Users/sarvind/mockbox. Wire the Porsche 911 (or {car}) into MockBox by editing these 5 files.

## Context from GLB split
Carpaint material name: {CARPAINT_MAT}
Trim material name: {TRIM_MAT}
Glass material name: {GLASS_MAT}
Template id: '{template-id}'
Scale: [{scale}]
Panels GLB: 'public/models/{car}_panels.glb'
Panel names from split script: {list all panel names that had > 0 tris}

## File 1: src/lib/templates.ts
Find the existing '{template-id}' entry and REPLACE its canvasZones and zoneGroups.
Add canvasZones for every panel name that had > 0 triangles PLUS a 'trim' zone.
Add sensible zoneGroups: racing_stripe (hood+roof+trunk/engine_lid), full_left, full_right, front_end, both_doors/all_doors, both_sides.
Pattern to follow: the bmw-x5m entry.

## File 2: src/components/models/PackagingModel.tsx
Copy BmwX5mModel VERBATIM and make exactly these changes:
1. Function name: BmwX5mModel → {CarName}PanelsModel
2. useGLTF path: '/models/2016_bmw_x5m_panels.glb' → '/models/{car}_panels.glb'
3. useMemo traverse — carpaint check: === 'carpaint' → === '{CARPAINT_MAT}'
4. useMemo traverse — trim check: === 'phong9' → === '{TRIM_MAT}'
5. Glass: if (mesh.material as any).transmission > 0 — keep this check as-is
6. In the useMemo: add bounding-box centering AFTER the traverse loop (needed if the GLB origin is far from model center):
   const box = new THREE.Box3().setFromObject(cloned);
   const center = box.getCenter(new THREE.Vector3());
   cloned.position.set(-center.x, -box.min.y, -center.z);
7. <group scale={[{scale}]} position={[0, -0.45, 0]}>
8. After the function: useGLTF.preload('/models/{car}_panels.glb');
9. Update PackagingModelSwitch: case '{template-id}': return <{CarName}PanelsModel />;
   Replace the old non-panel case if one exists (e.g., Porsche911Model → Porsche911PanelsModel).

## File 3: src/components/editor/EditorViewport.tsx
Find the isVehicle line. Add || activeTemplateId === '{template-id}' if not already present.

## Files 4 & 5: src/lib/store.ts and src/lib/types.ts
Read both. Verify allSurfaces() helper exists in store.ts and CanvasZone/ZoneGroup types exist in types.ts.
If they exist, make no changes. If missing, add them following the bmw-x5m pattern.

Do NOT install packages. Make all edits now." --yolo
```

---

## G4 — Threshold Iteration + Verification Prompt

Run this after G2 and G3 complete. Pass the actual bounding box numbers.

```
gemini -p "Working in /Users/sarvind/mockbox.

## GLB split results to verify
Bounding box: X[{Xmin}..{Xmax}] Y[{Ymin}..{Ymax}] Z[{Zmin}..{Zmax}]
Current triangle counts: {paste all panel: count lines}

## Task A — Fix thresholds if needed

1. Compute X centerline: nX_center = (0 - ({Xmin})) / ({Xmax} - ({Xmin})) = ?
   If nX_center is NOT between 0.45–0.55, shift ALL left/right thresholds:
   - Left panels (x < threshold): new threshold = nX_center - 0.25 (adjust for fender/door widths)
   - Right panels (x > threshold): new threshold = nX_center + 0.25

2. Any panel with < 200 tris: lower its Y threshold by 0.06–0.10, or expand its Z range.

3. Edit scripts/split-{car}-panels.mjs with corrected thresholds.
   Re-run with /opt/homebrew/bin/node scripts/split-{car}-panels.mjs
   Report new triangle counts.

## Task B — Dev server + GLB verification

1. Check if dev server is already running: curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/
   If not 200, start it: PORT=3000 ./dev.sh &> /tmp/mockbox-dev.log & ; sleep 10

2. Verify editor loads (follow redirects): curl -s -o /dev/null -w '%{http_code}' -L http://localhost:3000/editor/{template-id}
   Expected: 200.

3. Run inspect-glb.mjs on the panels GLB and confirm all expected panel mesh names appear:
   /opt/homebrew/bin/node scripts/inspect-glb.mjs public/models/{car}_panels.glb 2>&1 | grep -E '^\s+\[' | head -40

## Task C — Report
Report: updated triangle counts, 200/error on editor URL, panel mesh names confirmed." --yolo
```

---

## Monitoring Gemini — The Polling Pattern

Gemini writes output to a file. Since it runs in background, poll it:

```
# Right after launch (run_in_background: true), poll every 30–60s:
tail -N <output_file>
ps aux | grep gemini | grep -v grep | wc -l   # 0 = finished/dead, 1+ = alive
```

**Healthy signs:**
- New lines appear every 30–90s (Gemini narrates each action before executing)
- Process count stays at 1
- File timestamp on `*_panels.glb` changes (script ran)
- Line count grows over time

**Stuck/dead signs:**
- Line count unchanged for 3+ minutes AND process count = 0 → task died silently; relaunch
- Line count unchanged for 3+ minutes AND process count = 1 → Gemini is mid-execution (heavy GLB processing can take 2–3 min silently); wait longer

**Rate limiting:**
- Gemini auto-retries with `Attempt N failed: You have exhausted your capacity... Retrying after Xs`
- This is normal. Do not intervene. It resumes automatically within 5–10s.

**When to intervene:**
- Process gone AND output ends mid-sentence → relaunch with same prompt
- Gemini chasing wrong URLs / wrong route names → send a correction prompt with specific guidance (`gemini -p "The editor URL is /editor/{id} not /wrap/{id}..."`)

---

## Gemini Prompt Engineering Tips (from Porsche 911 experience)

### DO:
- Give Gemini the **exact bounding box numbers** — it can do the threshold math itself
- Tell it exactly **which lines to change** in a verbatim copy (e.g., "change line with === 'carpaint' to === 'PAINT_COLOR_4'")
- Specify `Use /opt/homebrew/bin/node for all Node commands` — Gemini sometimes uses wrong node
- Specify `Do NOT install any new packages` — it will try to install things otherwise
- Give it a **fallback task** if Playwright unavailable: "if no browser, run inspect-glb.mjs and confirm mesh names"

### DON'T:
- Ask Gemini to do too many unrelated things in one prompt — it loses focus
- Expect Gemini to know your project's routing convention (`/editor/` vs `/wrap/`) — tell it explicitly
- Wait for it to finish one subtask before giving the next — structure the prompt with explicit numbered Tasks A/B/C so it works through them sequentially

### Multi-mesh gotcha (critical):
If the GLB inspector shows the paint material on more than one mesh, you MUST tell Gemini about it explicitly and provide the multi-mesh collection loop in the G2 prompt. Gemini will default to the single-mesh BMW pattern otherwise, silently missing 3 of the 4 paint meshes.

---

## 5-File Checklist (what changes per car vs what's generic)

| File | Per-car change? | What changes |
|---|---|---|
| `src/lib/templates.ts` | YES | Add `canvasZones` + `zoneGroups` to the car's entry |
| `src/components/models/PackagingModel.tsx` | YES | Copy BmwX5mModel, change 4 things: name, GLB path, carpaint mat name, trim mat name |
| `src/components/editor/EditorViewport.tsx` | Maybe | Add `\|\| activeTemplateId === '{id}'` to `isVehicle` if not present |
| `src/lib/store.ts` | NO | `allSurfaces()` is generic; no changes needed |
| `src/lib/types.ts` | NO | `CanvasZone`/`ZoneGroup` already exist; no changes needed |

---

## Reference: Completed Cars

| Car | Template ID | GLB | Carpaint mat | Trim mat | Scale | Multi-mesh? |
|---|---|---|---|---|---|---|
| BMW X5M 2016 | `bmw-x5m` | `2016_bmw_x5m_panels.glb` | `carpaint` | `phong9` | `[35,35,35]` | No |
| Porsche 911 Targa 4S | `porsche-911` | `porsche_911_panels.glb` | `PAINT_COLOR_4` | `PLASTI_NEGRO_3` | `[0.015,0.015,0.015]` | Yes (4 meshes) |

---

## Minimal Claude Session Script

When a new session receives "make `{car}.glb` pastable with template id `{id}`, scale `[s,s,s]`":

1. Read `AGENT_GUIDE_GLB_PASTABLE.md` and this file
2. Run **G1** (inspect) — background, monitor until done
3. Extract carpaint/glass/trim mat names and multi-mesh flag from G1 output
4. Run **G2** (split script) — background, monitor; note bounding box + tri counts
5. Run **G3** (5-file wiring) — background, monitor
6. Run **G4** (threshold fix + verify) — background, monitor until 200 confirmed
7. Report final panel triangle counts and editor URL to user
