# MockBox — 3D Packaging Mockup Platform

A browser-based platform for creating, customizing, and exporting 3D product packaging mockups. Select from multiple packaging templates (boxes, bottles, cups, pouches, tubes, cans), apply custom designs, adjust materials, and preview realistic 3D renderings—all in your browser.

## Features

- **6 Pre-built Templates**: Box, Cup, Bottle, Can, Pouch, Tube
- **Interactive 3D Editor**: Real-time 3D preview with surface-level customization
- **Color & Material Control**: Adjust base colors and finishes (matte, glossy, metallic)
- **Texture Mapping**: Apply artwork and textures to individual packaging surfaces
- **Realistic Rendering**: PBR (physically-based) materials via Three.js
- **Export Ready**: High-resolution mockup imagery for marketing and design review
- **Responsive Design**: Works on desktop browsers

## Tech Stack

- **Framework**: Next.js 15 (App Router, React 19)
- **3D Rendering**: Three.js via @react-three/fiber + @react-three/drei
- **State Management**: Zustand
- **Styling**: Tailwind CSS v4 + shadcn/ui (Radix primitives)
- **Icons**: lucide-react
- **Package Manager**: npm / Node.js
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ (Homebrew: `/opt/homebrew/bin/node`)
- npm or yarn

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/mockbox.git
   cd mockbox
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables** (optional for Phase 1):
   ```bash
   cp .env.example .env.local
   # No env vars required for client-side mode, but config is here for future Phase 2+ backend
   ```

### Development

Start the dev server:
```bash
./dev.sh
# or: npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The app auto-reloads as you edit files.

**Note**: Turbopack is disabled in dev mode due to Node.js PATH constraints. The dev server uses Webpack.

### Production Build

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Usage

1. **Visit the Landing Page** ([http://localhost:3000](http://localhost:3000)): Explore features and view sample templates
2. **Browse Templates** ([http://localhost:3000/mockups](http://localhost:3000/mockups)): Select a packaging template to customize
3. **Enter the 3D Editor**: Click a template to open the interactive editor
4. **Customize**:
   - Adjust the base color slider
   - Toggle material finish (matte, glossy, metallic)
   - Click packaging surfaces to select and apply textures
   - Upload artwork for surface mapping
5. **Export**: Generate high-resolution renders (Phase 2 feature)

## Project Structure

```
.
├── public/
│   └── models/                    # GLB 3D model files
│       ├── package_box_mockup.glb
│       └── coffee_shop_cup.glb
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landing page
│   │   ├── layout.tsx            # Root layout
│   │   ├── globals.css           # Tailwind + theme
│   │   ├── editor/[templateId]/  # Dynamic editor route
│   │   ├── mockups/page.tsx      # Template library
│   │   └── pricing/page.tsx      # Pricing page
│   ├── components/
│   │   ├── editor/               # 3D editor UI (Viewport, Toolbar, Sidebars, etc.)
│   │   ├── models/               # 3D model components (GLB + procedural)
│   │   ├── shared/               # Navigation, Footer
│   │   ├── landing/              # Landing page sections
│   │   ├── mockups/              # Template grid
│   │   └── ui/                   # shadcn/ui primitives
│   ├── lib/
│   │   ├── store.ts              # Zustand state management
│   │   ├── types.ts              # TypeScript interfaces
│   │   ├── templates.ts          # Template definitions
│   │   └── utils.ts              # Utility functions
│   └── globals.css               # Global styles
├── package.json
├── tsconfig.json
├── next.config.ts
└── tailwind.config.ts
```

## 3D Models

- **GLB-based**: Box and Cup models loaded from Sketchfab-sourced `.glb` files
- **Procedural**: Bottle, Can, Pouch, Tube built with Three.js geometry primitives
- **Attribution**: Models sourced under Creative Commons licenses (see `model_guide.md`)

## Architecture Highlights

### Zustand Store (`src/lib/store.ts`)
Centralized editor state:
- Active template and surfaces
- Base color, finish, and material properties
- Surface textures (upload / removal)
- Undo/redo stacks

### Template System (`src/lib/templates.ts`)
Each template defines:
- Unique ID and display name
- Category and preview image
- List of customizable surfaces
- Default color

### 3D Model Components (`src/components/models/PackagingModel.tsx`)
- Surface click-selection
- Real-time material updates
- Support for both GLB and procedural geometry
- PBR material rendering

## Development Phases

- **Phase 1** (current): Client-side prototype — landing page + editor with 6 templates
- **Phase 2**: MVP — backend, authentication, project save/load, Stripe payment
- **Phase 3**: Dieline generator for print production
- **Phase 4**: Scene composer for multi-product scenes
- **Phase 5**: AI-powered design features

## Known Constraints

- **Turbopack**: Disabled in dev; use `./dev.sh` or `npm run dev` with Webpack
- **Node PATH**: Not in spawned process PATH by default; `./dev.sh` handles this
- **Browser Requirements**: Modern browser with WebGL support

## Contributing

This is an early-stage project. We welcome feedback, bug reports, and feature requests via GitHub Issues.

## License

Proprietary (MockBox Team) — 3D models sourced under Creative Commons Attribution (see attributions in code comments)

## Support

For questions or issues:
- Check existing [GitHub Issues](https://github.com/yourusername/mockbox/issues)
- Review the [project guide](./CLAUDE.md) for architecture decisions
- See [model_guide.md](./model_guide.md) for 3D asset sourcing details

---

**Made with ❤️ by the MockBox team**
