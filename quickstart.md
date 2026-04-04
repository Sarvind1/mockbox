# MockBox — Quickstart

Get MockBox running locally in under 5 minutes.

## Prerequisites

- **Node.js** v18 or later
- **npm** v9 or later
- **Git**

Verify your setup:
```bash
node --version   # Should print v18+
npm --version    # Should print 9+
```

## 1. Clone the Repository

```bash
git clone <repo-url> mockbox
cd mockbox
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Start the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **macOS (Apple Silicon) note**: If `npm run dev` fails with a PATH error, use the wrapper script instead:
> ```bash
> ./dev.sh
> ```
> See `setup_guide.md` for details.

## 4. What You'll See

| URL | Page |
|-----|------|
| `/` | Landing page — hero, features, template gallery, pricing |
| `/mockups` | Template library with category filters |
| `/editor/tuck-end-box` | 3D editor with the box model |
| `/editor/bottle` | 3D editor with the bottle model |
| `/editor/beverage-can` | 3D editor with the can model |
| `/editor/stand-up-pouch` | 3D editor with the pouch model |
| `/editor/cosmetic-tube` | 3D editor with the tube model |
| `/editor/coffee-cup` | 3D editor with the cup model |
| `/pricing` | Pricing plans page |

## 5. Using the Editor

1. **Pick a template** — Click any template in the left sidebar
2. **Upload artwork** — Drag and drop an image (PNG/JPG/SVG) onto the upload area. It applies to the currently selected surface.
3. **Select a surface** — Click a surface button in the right sidebar (e.g. Front, Back, Body, Cap) to choose where artwork is applied
4. **Change color** — Click a color swatch or use the color picker in the right sidebar
5. **Change finish** — Click Matte, Glossy, Metallic, or Kraft
6. **Change background** — Pick a background color from the swatches at the bottom of the right sidebar
7. **Rotate the model** — Click and drag on the 3D viewport
8. **Zoom** — Scroll wheel
9. **Pan** — Right-click and drag
10. **Export** — Click the Export button in the toolbar, choose resolution and format, then download

**Keyboard shortcuts:**
- `Ctrl+Z` / `Cmd+Z` — Undo
- `Ctrl+Shift+Z` / `Cmd+Shift+Z` — Redo

## 6. Build for Production

```bash
npm run build
npm start
```

The production build runs on [http://localhost:3000](http://localhost:3000).

## 7. Deploy

MockBox is a standard Next.js app. Deploy to any platform that supports it:

**Vercel (recommended):**
```bash
npm i -g vercel
vercel
```

**Docker / self-hosted:**
```bash
npm run build
npm start    # Serves on port 3000
```

## Project Structure (at a Glance)

```
src/
  app/                  → Pages (Next.js App Router)
  components/
    landing/            → Landing page sections
    editor/             → 3D editor UI panels
    models/             → Three.js 3D packaging models
    shared/             → Navbar, Footer
    ui/                 → shadcn/ui components
  lib/
    store.ts            → Zustand state management
    templates.ts        → Template definitions
    types.ts            → TypeScript types
```

## Troubleshooting

**Blank page / Turbopack error in dev mode**
→ You're on Next.js 16+ which uses Turbopack by default. Downgrade to Next.js 15:
```bash
npm install next@15
```

**`command not found: node` on macOS**
→ Node is likely installed via Homebrew but not in your PATH. Add it:
```bash
export PATH="/opt/homebrew/bin:$PATH"
```
Or add this line to your `~/.zshrc` to make it permanent.

**`node_modules` errors after cloning**
→ Delete and reinstall:
```bash
rm -rf node_modules
npm install
```

**3D viewport is black or empty**
→ Ensure your browser supports WebGL 2.0. Try Chrome or Edge. Safari may have issues with some WebGL features.

## Further Reading

- `CLAUDE.md` — Architecture, conventions, and how to add templates
- `setup_guide.md` — Detailed setup learnings and workarounds
