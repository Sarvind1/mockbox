# MockBox — Setup Guide

Lessons learned and workarounds from initial project setup (April 2026).

## Node.js on macOS (Apple Silicon)

Node is installed via Homebrew at `/opt/homebrew/bin/node` but is **not** in the default system PATH (`/usr/bin:/bin:/usr/sbin:/sbin`). This causes issues with tools that spawn child processes (Turbopack, preview servers, etc.).

**Fix**: Always prepend homebrew to PATH before running commands:
```bash
export PATH="/opt/homebrew/bin:$PATH"
```

Or use the `dev.sh` wrapper script which does this automatically.

## Next.js Version: 15 vs 16

We initially scaffolded with Next.js 16.2.2 (latest at time of setup). **Next.js 16 defaults to Turbopack for dev**, and there is no `--no-turbopack` flag to disable it.

**Problem**: Turbopack spawns its own internal Node subprocesses for CSS/PostCSS processing. These subprocesses do NOT inherit the shell's PATH — they use the system PATH, which doesn't include `/opt/homebrew/bin`. This causes a fatal error:
```
spawning node pooled process — No such file or directory (os error 2)
```

Even wrapping with a bash script that sets PATH doesn't help — Turbopack's Rust-based process spawner bypasses the shell environment.

**Fix**: Downgrade to Next.js 15, which uses Webpack for dev by default:
```bash
npm install next@15
```

`next build` in Next.js 16 uses Webpack and works fine — the issue is only with `next dev` (Turbopack).

## create-next-app in Non-Empty Directory

`create-next-app` refuses to run in a directory that contains any files (even a `.venv/` folder).

**Fix**: Scaffold in `/tmp`, then copy files over:
```bash
npx create-next-app@latest /tmp/mockbox --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
cp -r /tmp/mockbox/* /tmp/mockbox/.* /path/to/project/
```

## pnpm Not Available

`create-next-app --use-pnpm` fails with `spawn pnpm ENOENT` if pnpm isn't installed globally.

**Fix**: Use `--use-npm` instead. npm works fine and avoids the extra dependency.

## node_modules After Copy

Copying `node_modules/` from `/tmp` to the project directory can break symlinks in `.bin/`:
```
Cannot find module '../server/require-hook'
```

**Fix**: Delete and reinstall after copy:
```bash
rm -rf node_modules && npm install
```

## shadcn/ui Setup (Tailwind v4)

shadcn/ui v4 works with Tailwind v4 out of the box:
```bash
npx shadcn@latest init -d
npx shadcn@latest add slider select dropdown-menu dialog card badge separator tooltip -y
```

No special configuration needed — it auto-detects Next.js and Tailwind v4.

## Three.js + React Three Fiber

Install the trio:
```bash
npm install three @react-three/fiber @react-three/drei
npm install -D @types/three
```

### TypeScript Gotchas

1. **Lucide icons as dynamic components**: Storing icons in `Record<string, React.ElementType>` and rendering them with `<Icon className="..." />` causes TS error: `Type 'string' is not assignable to type 'never'`.
   **Fix**: Use `Record<string, any>` with an eslint-disable comment.

2. **shadcn Slider `onValueChange`**: Returns `number | readonly number[]`, not a tuple. Destructuring `([v])` fails with TS error.
   **Fix**: Use `(v) => { const val = Array.isArray(v) ? v[0] : v; ... }`.

3. **Unused imports**: If you import `useTexture` from drei but don't use it, the build won't complain, but keep imports clean.

## Dev Server for Preview Tools

Preview tools (Claude Preview, etc.) spawn the dev server as a child process. The spawned process has a minimal PATH.

**Fix**: Use a wrapper script (`dev.sh`) with the full node path:
```bash
#!/bin/bash
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
cd "$(dirname "$0")"
exec /opt/homebrew/bin/node node_modules/.bin/next dev --port 3000
```

In `.claude/launch.json`, point to this script:
```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "MockBox Dev Server",
      "runtimeExecutable": "/bin/bash",
      "runtimeArgs": ["dev.sh"],
      "port": 3000
    }
  ]
}
```

Using `npm` or `node` directly as `runtimeExecutable` fails because the preview tool's process spawner doesn't have `/opt/homebrew/bin` in its PATH.

## Python Virtual Environment

A `.venv` was created in the project root for document processing tools:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install defusedxml
```

This is separate from the Node.js project and used only for auxiliary scripts. It's in `.gitignore` by default.

## GLB Model Integration (Sketchfab)

In Phase 1, we upgraded the Box and Cup templates from procedural Three.js primitives to real GLB models downloaded from Sketchfab.

### Why GLB?
- GLB (binary glTF) is the standard format for web 3D — single file, compressed, includes geometry + textures
- `useGLTF` from `@react-three/drei` handles loading, caching, and preloading automatically
- Real models look significantly more polished than procedural primitives

### Models sourced

| Template | File | Source | Triangles | File Size | License |
|----------|------|--------|-----------|-----------|---------|
| Tuck End Box | `package_box_mockup.glb` | Sketchfab — _simone.rizzi | 2.3k | 2.8 MB | CC-BY |
| Coffee Cup | `coffee_shop_cup.glb` | Sketchfab — David Zerba | 5.8k | 140 KB | CC-BY |

### Key learnings

1. **Triangle count matters**: Keep models under ~50k triangles for smooth web performance. Many Sketchfab models are 500k+ — always check before downloading.
2. **Scale varies wildly**: Sketchfab models have no standard unit system. The box needed `scale={[4, 4, 4]}` while the cup needed `scale={[0.6, 0.6, 0.6]}`. Always tune per model.
3. **Material override pattern**: Clone the scene (`scene.clone(true)`), then traverse all meshes in a `useEffect` to replace materials with `MeshPhysicalMaterial` using the editor's color/finish settings.
4. **Mesh name → surface mapping**: GLB meshes have names from the original DCC tool (Blender, etc.). Map them to our surface names (front, back, body, sleeve) via string matching.
5. **Preload for performance**: Call `useGLTF.preload("/models/file.glb")` after each component to start fetching the model immediately, not on first render.
6. **Download format**: On Sketchfab, choose "GLB Converted format" with the smallest texture size option (1k) to minimize download size.

### Sketchfab download tips
- Filter by "Downloadable" in search
- Look for the download icon (arrow) — models with a `$` icon are paid
- Check triangle count before downloading (visible on the model page)
- Always pick CC Attribution or CC0 licensed models
- Download the GLB format (not glTF, USDZ, or blend) — GLB is a single binary file

## Summary of What Works

| Tool | Version | Status |
|------|---------|--------|
| Node.js | v25.8.2 | Works (via `/opt/homebrew/bin`) |
| npm | 11.11.1 | Works |
| Next.js | 15.x | Works (dev + build) |
| Next.js | 16.x | Build works, dev fails (Turbopack PATH issue) |
| Three.js | 0.183.x | Works |
| @react-three/fiber | 9.x | Works |
| Tailwind CSS | v4 | Works |
| shadcn/ui | v4 | Works |
