# Gemini Prompt: MockBox Learning Module Generator

Copy everything below the line and paste it into Gemini.

---

You are a senior engineering educator. Create a structured, self-paced learning module for a product-engineering manager (operating as an SDE3-level IC) who wants to deeply understand every technology, concept, and platform used in their project. The learner has general software experience but wants to fill gaps and build real fluency across the full stack.

## The Project

**MockBox** is a browser-based 3D packaging mockup platform (like Pacdora). Users pick a packaging template (box, bottle, can, pouch, tube, cup), upload artwork, customize materials/colors/finishes, and export high-res renders. It is currently a Phase 1 client-side prototype with no backend, deployed on Vercel.

## Complete Technology Stack

Here is every technology, tool, library, pattern, and platform used. Organize the learning module to cover ALL of them.

### Core Framework & Language
- **Next.js 15** — React meta-framework, App Router (not Pages Router), file-based routing, dynamic routes (`/editor/[templateId]`), server vs client components (`"use client"` directive), layouts, metadata API, `next.config.ts`
- **React 19** — Hooks (useState, useEffect, useRef, useMemo, useCallback), component composition, props, conditional rendering, event handling, Suspense
- **TypeScript 5** — Interfaces, union types, generics, type narrowing, `Record<>`, module types, strict mode, `tsconfig.json`
- **Node.js** — Runtime for build tools and dev server (not used as a backend in this project)

### 3D Graphics (WebGL)
- **Three.js** — 3D library: scenes, cameras (perspective), meshes, geometries (BoxGeometry, CylinderGeometry, ShapeGeometry, PlaneGeometry, TorusGeometry, CircleGeometry), materials (MeshPhysicalMaterial with clearcoat, roughness, metalness), textures (TextureLoader, UV mapping, SRGBColorSpace), lighting (DirectionalLight, AmbientLight), raycasting for click detection
- **@react-three/fiber (R3F)** — React renderer for Three.js: `<Canvas>`, declarative 3D scene graph, R3F event system (onClick on meshes), useFrame, integration with React state
- **@react-three/drei** — Helper library: OrbitControls (camera orbit/pan/zoom), ContactShadows, Environment (HDR lighting presets), useGLTF (GLB model loading + preloading)
- **GLB/glTF format** — Binary 3D model format: loading external models, scene traversal, mesh name mapping, material override pattern, scene cloning

### State Management
- **Zustand** — Lightweight store: create/useStore pattern, selectors for granular subscriptions, actions, computed state, undo/redo with snapshot stacks

### Styling & UI
- **Tailwind CSS v4** — Utility-first CSS: responsive design, flexbox/grid, spacing, colors, hover/focus states, dark mode with CSS variables, `@tailwindcss/postcss` plugin, OKLCH color space
- **shadcn/ui** — Component registry (not a package): Button, Dialog, Slider, Select, Card, Badge, Separator, Tooltip, DropdownMenu — built on top of headless primitives
- **@base-ui/react** — Headless UI primitives (Radix-style) that shadcn/ui wraps
- **class-variance-authority (CVA)** — Type-safe component variant definitions (size, variant props)
- **tailwind-merge** — Merge conflicting Tailwind classes safely
- **clsx** — Conditional class name builder (used inside the `cn()` utility)
- **tw-animate-css** — CSS animations integrated with Tailwind
- **lucide-react** — SVG icon library with tree-shaking
- **PostCSS** — CSS transformation pipeline (used by Tailwind v4)
- **CSS Variables** — Custom properties for theming (--primary, --background, --radius, etc.)

### Code Quality
- **ESLint 9** — Linting with flat config format
- **eslint-config-next** — Next.js-specific rules (core web vitals, import checks, TypeScript)

### Build & Package Management
- **npm** — Package manager, `package.json` scripts (dev, build, start, lint)
- **Webpack** — Module bundler (Next.js 15 default for dev, used instead of Turbopack)

### Deployment & Hosting
- **Vercel** — Serverless hosting platform: CLI deployment (`vercel`), project linking, preview URLs, production domains, environment variables, build pipeline
- **Git / GitHub** — Version control and remote repository

### File Formats & Assets
- **GLB files** — Binary glTF 3D models stored in `public/models/`
- **SVG/PNG/JPG** — Image assets for artwork upload and thumbnails
- **Google Fonts (Inter)** — Web font loaded via `next/font/google`

### Browser APIs Used
- **WebGL 2.0** — GPU-accelerated 3D rendering (via Three.js)
- **Canvas API** — `toDataURL()` for exporting renders as PNG/JPG at multiple resolutions
- **File/Blob API** — Drag-and-drop file upload, `URL.createObjectURL()` for local image preview
- **Keyboard events** — Global shortcuts (Ctrl+Z undo, Ctrl+Shift+Z redo)

### Key Design Patterns
- Server Components vs Client Components (Next.js RSC model)
- File-based routing with dynamic segments
- Component composition and the "switch" pattern (PackagingModelSwitch)
- Custom hooks (useLoadedTextures for texture caching)
- Zustand store with undo/redo snapshot pattern
- Material override pattern for GLB models (clone scene, traverse meshes, replace materials)
- Mesh name-to-surface mapping for interactive 3D
- Key-based component remounting for state reset
- Drag-and-drop upload with preview
- Canvas screenshot export at configurable resolution
- `cn()` utility pattern (clsx + tailwind-merge)

### Sketchfab (3D Model Source)
- **Sketchfab** — Online 3D model marketplace: searching for models, evaluating triangle count/file size, Creative Commons licensing (CC-BY, CC0), downloading GLB format

## Learning Module Requirements

Create the module with these sections and guidelines:

### Structure
For each topic, provide:
1. **What it is** — One-paragraph plain-English explanation
2. **Why it matters for this project** — Concrete connection to MockBox
3. **Core concepts to learn** — Bulleted list of the 5-10 most important sub-topics
4. **Hands-on exercise** — A small practical task the learner can do in 30-60 minutes (not just "read the docs")
5. **Resources** — 2-3 links (official docs, a good tutorial, a video) — prefer recent content (2024-2026)
6. **Checkpoint question** — One question the learner should be able to answer after completing the topic

### Module Organization
Organize into these learning tracks (the learner will work through them in order):

**Track 1: Frontend Foundations**
- TypeScript
- React 19 (hooks, components, state, effects)
- Next.js 15 (App Router, routing, layouts, server vs client components, metadata)

**Track 2: Styling & UI**
- Tailwind CSS v4 (utility classes, responsive design, CSS variables, dark mode)
- shadcn/ui + Radix/base-ui (component library pattern, CVA, cn() utility)
- PostCSS and the CSS build pipeline

**Track 3: 3D Graphics for the Web**
- Three.js fundamentals (scene, camera, renderer, geometry, materials, lighting, textures)
- @react-three/fiber (declarative 3D in React)
- @react-three/drei (helpers: OrbitControls, useGLTF, Environment, ContactShadows)
- GLB/glTF format and working with external 3D models
- Sketchfab as a model source

**Track 4: State Management & Architecture**
- Zustand (store creation, selectors, actions, middleware)
- Undo/redo pattern with snapshot stacks
- Application architecture patterns (component composition, custom hooks, file organization)

**Track 5: Build, Deploy & DevOps**
- npm and package.json (scripts, dependencies, semver)
- ESLint and code quality tooling
- Git and GitHub workflows
- Vercel deployment (CLI, preview URLs, production, environment variables, build pipeline)
- Webpack basics (what it does, how Next.js uses it)

**Track 6: Browser APIs & Web Platform**
- WebGL overview (what it is, how Three.js uses it)
- Canvas API (rendering, export to image)
- File/Blob API (drag-and-drop, object URLs)
- Keyboard event handling

### Tone & Level
- Write for a senior engineer who learns fast but is new to these specific tools
- Be practical, not academic — connect everything to real code patterns
- Skip beginner fluff (don't explain what a variable is) but don't assume prior knowledge of any specific library
- When explaining a concept, show a short (5-10 line) code snippet illustrating the pattern as used in a project like MockBox

### Output Format
- Use clear Markdown with headers, bullet points, and code blocks
- Estimated time per topic (most should be 1-3 hours)
- Total estimated time for the full module
- A "Quick Reference Cheat Sheet" at the end summarizing the key command/pattern for each tool (one line each)
