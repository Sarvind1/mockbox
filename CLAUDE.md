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
│   ├── models/                     # PackagingModel.tsx (all 3D models)
│   └── ui/                         # shadcn/ui primitives (button, slider, dialog, etc.)
├── lib/
│   ├── store.ts                    # Zustand store (editor state, undo/redo)
│   ├── types.ts                    # TypeScript types (PackagingTemplate, SurfaceTexture, etc.)
│   ├── templates.ts                # Template definitions (6 templates)
│   └── utils.ts                    # shadcn cn() utility
```

## Key Architecture Decisions

- **Procedural 3D models**: All packaging models (box, bottle, can, pouch, tube, cup) are built with Three.js primitives and proper geometry — no external GLB files needed for Phase 1.
- **Client-side only**: No backend, no auth, no database. Everything runs in the browser.
- **Zustand store** (`src/lib/store.ts`): Single store for all editor state including active template, surface textures, material settings, undo/redo stacks.
- **Template switching**: Changes both Zustand state and URL via `router.replace()`.
- **Texture loading**: Uses `THREE.TextureLoader` in a `useEffect` with ref-based caching to avoid re-renders.

## 3D Models

All models are in `src/components/models/PackagingModel.tsx`. Each model:
- Is a React component using R3F JSX
- Reads state from the Zustand store (baseColor, finish, surfaceTextures)
- Supports click-to-select surfaces
- Uses `meshPhysicalMaterial` for PBR rendering
- `PackagingModelSwitch` maps templateId → component

## Adding a New Template

1. Add entry to `src/lib/templates.ts` with id, name, category, surfaces, defaultColor
2. Create model component in `src/components/models/PackagingModel.tsx`
3. Add case to `PackagingModelSwitch`
4. Add icon mapping in `LeftSidebar.tsx`, `TemplateShowcase.tsx`, `TemplateGrid.tsx`

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
