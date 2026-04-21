# Car Wrap / Car Branding Mockup — Research Notes

**Date**: 2026-04-14  
**Context**: Exploring extension of MockBox into vehicle wrap/branding visualization — letting users apply custom images, logos, and graphics onto 3D car models in the browser, similar to how MockBox handles packaging mockups.

---

## The Opportunity

- Global vehicle wrap market: **~$10.6B (2024), growing at 18–22% CAGR**
- Projected to reach ~$95B by 2035
- North America holds 35%+ market share
- Thousands of wrap shops, detailing studios, fleet operators, and brand teams need visualization tools

---

## Competitive Landscape

| Tool | Type | Price | Key Gap |
|---|---|---|---|
| xix3D Zeno | Desktop app | $20–$250/month | Requires download, not browser-based |
| 3D Changer | Desktop app | One-time purchase | No cloud/collaboration |
| 2wrap.com | Browser | $19–$500 (time blocks) | Vinyl color swatches only, no custom artwork |
| Wrapmate | Marketplace | % cut | Human designer workflow, not real-time 3D |
| AutoStyle.AI | AI photo tool | Freemium | AI image, not interactive 3D |
| Avery Dennison Visualizer | Free/marketing | Free | Limited models, no custom upload |

### Gaps Nobody Is Filling
1. **Browser-native + full custom artwork upload** — no one does both
2. **Animated textures** (GIF/video wraps) — unexplored territory
3. **Embeddable widget** for wrap shops' own websites
4. **Fleet multi-vehicle workflow** — one livery across sedan/van/truck simultaneously
5. **Shareable approval links** for client review without install

---

## Technical Approach

### Core Architecture (maps directly to MockBox's existing stack)

```
User uploads image/logo
    → Fabric.js 2D canvas (drag, resize, rotate artwork in UV space)
    → THREE.CanvasTexture wrapping Fabric.js canvas element
    → material.map = canvasTexture on car body mesh
    → texture.needsUpdate = true on every Fabric.js change
    → React Three Fiber renders car model in real-time
```

### MockBox Mapping

| MockBox (packaging) | Car Wrap |
|---|---|
| GLB packaging models | GLB car models (same loader) |
| Per-surface color/texture | Per-panel UV texture (door, hood, roof) |
| `MeshPhysicalMaterial` finishes | Same + `clearcoat` for car paint |
| `CanvasTexture` for uploads | Fabric.js + CanvasTexture for artwork |
| Export PNG/JPEG | Same export pipeline |

The only new dependency needed: **Fabric.js** (2D canvas artwork placement layer).

### Material Setup for Car Paint

```jsx
<meshPhysicalMaterial
  map={wrapTexture}
  metalness={0.0}
  roughness={0.4}
  clearcoat={1.0}
  clearcoatRoughness={0.05}
  envMapIntensity={1.5}
/>
```

### Texture Application Options

| Approach | Best For | Curved Surfaces | Complexity |
|---|---|---|---|
| **Canvas Texture (UV-space)** | Full wraps, full coverage | Excellent | Medium |
| Decal (`@react-three/drei <Decal>`) | Logos, stickers, spot graphics | Poor on sharp curves | Low |
| Per-panel UV texture | Panel-by-panel customization | Excellent | Medium-High |

**Recommended starting point**: Decal approach for MVP (logo/image placement per panel) — simplest, no Fabric.js needed initially. Upgrade to Canvas Texture for full wrap coverage later.

### Environment / Lighting

Use Polyhaven CC0 HDR maps with `@react-three/drei <Environment>`:
```jsx
<Environment preset="studio" />
// or load custom .hdr from polyhaven.com
```

---

## 3D Car Model Sources

### Free (Good for Prototyping)
- **Quaternius** (quaternius.com) — CC0, no attribution, commercial use OK. Low-poly stylized. Good for fast prototyping.
- **Poly Pizza** — CC0/CC-BY low-poly models

### Paid (Production Use)
- **CGTrader** — Royalty-free license, $15–$150/model. Unlimited commercial use including SaaS.
- **TurboSquid** — "CheckMate" certified models, proper UV maps, real-time optimized. $20–$300/model.

### Priority Vehicle Types to Source
1. Sedan (most common personal vehicle)
2. SUV / Crossover
3. Pickup Truck
4. Cargo Van / Sprinter (fleet/commercial use case)
5. Box Truck (fleet branding)

### File Spec Targets
- Format: **GLB** (single binary, works with existing `useGLTF` setup)
- Polygons: 50K–150K for web real-time
- Size: 2–5MB (use Draco compression + KTX2 textures)
- UV requirement: **Wrap-specific UV unwrap** — separate UV islands per body panel (hood, doors, roof, trunk)

### Optimization Tools
- `gltf-pipeline` — Draco compression
- `gltfpack` — aggressive mesh/texture optimization
- Blender GLTF exporter with Draco enabled

---

## Monetization

| Tier | Target | Price |
|---|---|---|
| Wrap Shop | Per seat/month | $49–$149/month |
| Fleet / Corporate | Multi-vehicle workflow | $299–$999/month |
| White-label embed | Vinyl brands, dealer networks | $500–$2,000/month |
| Pay-per-render | Low-friction entry | $0.50–$2.00/export |

---

## Open-Source References
- [pmndrs/drei Decal](https://github.com/pmndrs/drei) — `<Decal>` component
- [spite/THREE.DecalGeometry](https://github.com/spite/THREE.DecalGeometry) — original decal impl
- [adityakumar48/carshow](https://github.com/adityakumar48/carshow) — R3F car model demo
- [Three.js + Fabric.js forum thread](https://discourse.threejs.org/t/three-js-fabric-js/2111)
- [3D T-Shirt Configurator (Three.js + Fabric.js)](https://dev.to/apcliff/3d-tshirt-configurator-with-threejs-and-fabricjs-31j9)
- [Car Visualizer Example](https://carvisualizer.plus360degrees.com/threejs/)

---

## Implementation Plan (MVP)

### Phase 1 — Prototype (minimum recode)
1. Download a free Quaternius CC0 car GLB
2. Add `car-wrap` as a new template category in `src/lib/templates.ts`
3. Create `CarModel.tsx` in `src/components/models/` (same pattern as existing models)
4. Add entry point to existing MockBox editor UI (new tab/section in template picker)
5. Use existing `<Decal>` from drei for logo/image placement per panel
6. Reuse existing export pipeline

### Phase 2 — Full Wrap
1. Add Fabric.js for 2D artwork placement in UV space
2. Switch to `CanvasTexture` approach for full-coverage wraps
3. Source 5–10 commercial car GLBs from CGTrader
4. Add HDRI environment presets for photorealistic renders

### Phase 3 — Product
1. Fleet multi-vehicle workflow
2. Shareable approval links
3. White-label embed API
4. Animated texture support (GIF/video)
