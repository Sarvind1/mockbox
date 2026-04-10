@AGENTS.md

# MockBox — 3D Packaging Mockup Platform

## Project Overview

MockBox is a browser-based 3D packaging mockup and design platform (inspired by Pacdora). Users select a packaging template, upload artwork, customize materials, and export high-res renders. Currently in Phase 1 (client-side prototype, no backend).

## Tech Stack

- **Framework**: Next.js 15 (App Router, React 19)
- **3D Engine**: Three.js via @react-three/fiber + @react-three/drei
- **State**: Zustand
- **UI**: Tailwind CSS v4 + shadcn/ui (Radix primitives)
- **Icons**: lucide-react
- **Package manager**: npm
- **Node**: /opt/homebrew/bin/node (not in default PATH — use full path or dev.sh)

## Commands

- `npm run dev` — Start dev server (port 3000). Use `./dev.sh` to ensure PATH includes node.
- `npm run build` — Production build (uses Webpack, not Turbopack)
- `npm run lint` — ESLint
- `npm start` — Serve production build

## Project Structure

```
public/
├── models/                         # GLB 3D model files (loaded at runtime)
│   ├── package_box_mockup.glb      # Sketchfab — _simone.rizzi (CC-BY)
│   └── coffee_shop_cup.glb         # Sketchfab — David Zerba (CC-BY)
src/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── layout.tsx                  # Root layout (Inter font, metadata)
│   ├── globals.css                 # Tailwind + shadcn theme variables
│   ├── mockups/page.tsx            # Template library page
│   ├── pricing/page.tsx            # Pricing page
│   └── editor/[templateId]/page.tsx # 3D editor (dynamic route)
├── components/
│   ├── landing/                    # Landing page sections (Hero, Features, Pricing, etc.)
│   ├── shared/                     # Navbar, Footer
│   ├── mockups/                    # TemplateGrid
│   ├── editor/                     # EditorLayout, Toolbar, Viewport, LeftSidebar, RightSidebar, ExportDialog
│   ├── models/                     # PackagingModel.tsx (all 3D models — GLB + procedural)
│   └── ui/                         # shadcn/ui primitives (button, slider, dialog, etc.)
├── lib/
│   ├── store.ts                    # Zustand store (editor state, undo/redo)
│   ├── types.ts                    # TypeScript types (PackagingTemplate, SurfaceTexture, etc.)
│   ├── templates.ts                # Template definitions (6 templates)
│   └── utils.ts                    # shadcn cn() utility
```

## Key Architecture Decisions

- **Hybrid 3D models**: Models use either GLB files (downloaded from Sketchfab) or procedural Three.js primitives. Box and Cup use GLB; Bottle, Can, Pouch, Tube use procedural geometry.
- **GLB loading**: Uses `useGLTF` from `@react-three/drei` with `.preload()` for eager fetching. Models are stored in `public/models/`.
- **Client-side only**: No backend, no auth, no database. Everything runs in the browser.
- **Zustand store** (`src/lib/store.ts`): Single store for all editor state including active template, surface textures, material settings, undo/redo stacks.
- **Template switching**: Changes both Zustand state and URL via `router.replace()`.
- **Texture loading**: Uses `THREE.TextureLoader` in a `useEffect` with ref-based caching to avoid re-renders.

## 3D Models

All models are in `src/components/models/PackagingModel.tsx`. Two types:

### GLB-based models (Box, Cup)
- Load `.glb` files from `public/models/` using `useGLTF` from drei
- Clone the scene with `scene.clone(true)` so each instance is independent
- Override materials in a `useEffect` — apply `MeshPhysicalMaterial` with editor color/finish
- Map mesh names to surfaces (e.g. mesh named "back" → surface "back")
- Call `useGLTF.preload("/models/file.glb")` after the component for eager loading
- Models sourced from Sketchfab (CC Attribution license)

### Procedural models (Bottle, Can, Pouch, Tube)
- Built with Three.js primitives (cylinderGeometry, boxGeometry, shapeGeometry, etc.)
- Each surface is a separate `<mesh>` with click handler

### Common patterns (both types)
- Read state from Zustand store (baseColor, finish, surfaceTextures)
- Support click-to-select surfaces
- Use `meshPhysicalMaterial` for PBR rendering
- `PackagingModelSwitch` maps templateId → component

## Adding a New Template

1. Add entry to `src/lib/templates.ts` with id, name, category, surfaces, defaultColor
2. Create model component in `src/components/models/PackagingModel.tsx`
   - For GLB: follow the BoxModel/CupModel pattern (useGLTF, clone, override materials)
   - For procedural: follow the BottleModel/CanModel pattern (primitive geometry)
3. Add case to `PackagingModelSwitch`
4. Add icon mapping in `LeftSidebar.tsx`, `TemplateShowcase.tsx`, `TemplateGrid.tsx`
5. If using GLB: place the `.glb` file in `public/models/` and add `useGLTF.preload()` call

See `model_guide.md` for step-by-step instructions on sourcing and integrating GLB models.

## Known Constraints

- Turbopack doesn't work in dev mode due to node not being in the spawned process PATH. Use `./dev.sh` or `next dev` with Webpack (Next.js 15 default).
- Icon components from lucide-react need `Record<string, any>` typing to avoid TS errors with dynamic rendering.
- The `Slider` component's `onValueChange` returns `number | readonly number[]` — always use `Array.isArray(v) ? v[0] : v`.

## Development Phases

- **Phase 1** (current): Client-side prototype — landing page + 3D editor with 6 models
- **Phase 2**: MVP — backend, auth, project save/load, full template library, Stripe
- **Phase 3**: Dieline generator
- **Phase 4**: Scene composer
- **Phase 5**: AI features
