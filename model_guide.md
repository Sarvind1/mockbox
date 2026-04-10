# MockBox — Model Operator Guide

How to download, add, and update 3D models in the MockBox editor.

## Overview

MockBox uses two types of 3D models:
- **GLB models** — Real 3D files downloaded from online sources (Sketchfab, etc.)
- **Procedural models** — Built with Three.js code (cylinders, boxes, etc.)

This guide covers how to work with GLB models.

---

## Where to Find Models

### Sketchfab (recommended)
- URL: https://sketchfab.com
- Free account required for downloads
- Search for: `packaging mockup`, `product bottle`, `coffee cup`, `cosmetic tube`, `soda can`, `paper bag`, `cardboard box`, etc.
- Filter by "Downloadable" to find free models
- Always check the license (CC Attribution or CC0 preferred)

### Tips for finding good models
- **Low triangle count**: Aim for under 50k triangles. Under 10k is ideal. Check the model page for "Triangles" count.
- **Free models**: Look for the download arrow icon. Models with a `$` icon are paid.
- **Packaging-specific searches**: Try terms like `mockup`, `packaging`, `product`, `ecommerce`
- **Avoid game/scene models**: They tend to be too complex or stylized

### Current models in the project

| Template | GLB File | Source | Author | Triangles | Size | License |
|----------|----------|--------|--------|-----------|------|---------|
| Tuck End Box | `package_box_mockup.glb` | [Sketchfab](https://sketchfab.com/3d-models/package-box-mockup-3b68aaab1d7d4bce889a2803b131a375) | _simone.rizzi | 2.3k | 2.8 MB | CC-BY |
| Coffee Cup | `coffee_shop_cup.glb` | [Sketchfab](https://sketchfab.com/3d-models/coffee-shop-cup-37e6805f2b7a4158a1d61fe75f8e2a33) | David Zerba | 5.8k | 140 KB | CC-BY |

---

## Step-by-Step: Download a Model from Sketchfab

### 1. Find the model
1. Go to https://sketchfab.com
2. Search for your packaging type (e.g., `stand up pouch packaging`)
3. Sort by "Most liked" for quality
4. Look for the download arrow icon (not `$`)

### 2. Check model specs
On the model page, scroll down to verify:
- **Triangles**: Under 50k (ideally under 10k)
- **License**: CC Attribution or CC0
- **Format**: Ensure GLB is available in the download options

### 3. Download the GLB
1. Click "Download 3D Model"
2. Log in if prompted (free account)
3. Scroll to "Available downloads"
4. Find the **GLB** section (Converted format)
5. If multiple sizes are offered, choose the **smaller texture size** (1k) for web performance
6. Click "DOWNLOAD"

### 4. Add to the project
Copy the downloaded `.glb` file to the project:
```bash
cp ~/Downloads/your_model.glb public/models/
```

---

## Step-by-Step: Integrate a New GLB Model

### 1. Add the template definition

Edit `src/lib/templates.ts` and add a new entry:
```typescript
{
  id: "your-template-id",
  name: "Your Template Name",
  category: "boxes",   // boxes, bottles, cans, pouches, tubes, cups
  description: "Description of the template",
  surfaces: ["front", "back"],  // clickable surfaces
  defaultColor: "#ffffff",
  thumbnail: "/thumbnails/your-template.png",
},
```

### 2. Create the model component

Edit `src/components/models/PackagingModel.tsx`. Add a new component following this pattern:

```typescript
// ---- Your Model (GLB) ----
export function YourModel() {
  const { scene } = useGLTF("/models/your_model.glb");
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);

  const textures = useLoadedTextures(surfaceTextures);

  // Clone so each instance is independent
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  // Override materials with editor settings
  useEffect(() => {
    const matProps = getMaterialProps(finish, baseColor);
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const name = mesh.name.toLowerCase();

        // Map mesh names to your surfaces
        let surface = "front";
        if (name.includes("back")) surface = "back";
        // Add more mappings as needed

        const origMat = mesh.material as THREE.MeshStandardMaterial;
        const newMat = new THREE.MeshPhysicalMaterial({
          ...matProps,
          map: textures[surface] || origMat.map || null,
          normalMap: origMat.normalMap || null,
          emissive: new THREE.Color(
            activeSurface === surface ? "#1a1a2e" : "#000000"
          ),
          emissiveIntensity: activeSurface === surface ? 0.05 : 0,
        });
        mesh.material = newMat;
        mesh.userData.surface = surface;
      }
    });
  }, [clonedScene, baseColor, finish, activeSurface, textures]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (e: any) => {
    e.stopPropagation();
    const mesh = e.object as THREE.Mesh;
    if (mesh.userData.surface) {
      setActiveSurface(mesh.userData.surface);
    }
  };

  return (
    <group scale={[1, 1, 1]} position={[0, 0, 0]}>
      <primitive object={clonedScene} onClick={handleClick} />
    </group>
  );
}
useGLTF.preload("/models/your_model.glb");
```

### 3. Tune scale and position

Every GLB model has different dimensions. You will need to adjust:

```tsx
<group scale={[S, S, S]} position={[0, Y, 0]}>
```

- **Scale**: Start at `[1, 1, 1]` and increase/decrease until the model fills the viewport nicely. Typical values range from `0.1` to `10`.
- **Position Y**: Adjust so the model sits on or near the shadow plane. Negative values move it down.

**Reference values from current models:**

| Model | Scale | Position Y |
|-------|-------|-----------|
| Box (package_box_mockup.glb) | 4 | -0.5 |
| Cup (coffee_shop_cup.glb) | 0.6 | -0.7 |

### 4. Map mesh names to surfaces

GLB models have mesh names from the original 3D software (Blender, Maya, etc.). You need to map them to your surface names.

**How to find mesh names:**
Open the browser console and add a temporary log in your component:
```typescript
clonedScene.traverse((child) => {
  if ((child as THREE.Mesh).isMesh) {
    console.log("Mesh:", child.name);
  }
});
```

Then create your mapping logic:
```typescript
let surface = "front"; // default
if (name.includes("back")) surface = "back";
if (name.includes("sleeve") || name.includes("band")) surface = "sleeve";
if (name.includes("lid") || name.includes("cap")) surface = "cap";
```

### 5. Wire into the switch

In `PackagingModelSwitch` at the bottom of `PackagingModel.tsx`, add your case:

```typescript
case "your-template-id":
  return <YourModel />;
```

### 6. Add icon mapping

Add your template's icon in these files:
- `src/components/editor/LeftSidebar.tsx`
- `src/components/landing/TemplateShowcase.tsx`
- `src/components/mockups/TemplateGrid.tsx`

Use an appropriate icon from `lucide-react`.

### 7. Test

1. Run `./dev.sh` or `npm run dev`
2. Navigate to `http://localhost:3000/editor/your-template-id`
3. Verify:
   - Model renders at correct size
   - Color changes apply
   - Finish changes apply (matte, glossy, metallic, kraft)
   - Surface clicking works
   - Artwork upload applies to the correct surface
   - Template switching works (click between templates in the sidebar)
4. Run `npm run build` to verify production build passes

---

## Replacing an Existing Model

To swap a model (e.g., upgrade the box with a better one):

1. Download the new GLB to `public/models/`
2. Update the file path in the component's `useGLTF()` and `useGLTF.preload()` calls
3. Re-tune scale and position
4. Re-map mesh names to surfaces
5. Delete the old GLB file from `public/models/`

---

## Performance Guidelines

| Metric | Target | Why |
|--------|--------|-----|
| Triangle count | < 50k | Smooth rendering on mid-range devices |
| File size (GLB) | < 5 MB | Fast initial load |
| Texture size | 1k (1024px) | Balances quality vs download size |
| Number of meshes | < 20 | Fewer draw calls |

If a model is too heavy:
- Download the 1k texture variant from Sketchfab (instead of 2k)
- Use a simpler model
- Consider using a procedural model instead (see BottleModel/CanModel for examples)

---

## License Attribution

All CC-BY models require attribution. Keep this table updated:

| Model | Author | Source | License |
|-------|--------|--------|---------|
| Package box mockup | _simone.rizzi | [Sketchfab](https://sketchfab.com/3d-models/package-box-mockup-3b68aaab1d7d4bce889a2803b131a375) | CC Attribution |
| Coffee Shop Cup | David Zerba | [Sketchfab](https://sketchfab.com/3d-models/coffee-shop-cup-37e6805f2b7a4158a1d61fe75f8e2a33) | CC Attribution |

For production (Phase 2+), add a credits/attribution page or footer link.

---

## Troubleshooting

**Model doesn't appear**
- Check browser console for 404 errors — the GLB path might be wrong
- Verify the file is in `public/models/` (not `src/`)
- Try increasing the scale (some models are very small, e.g., millimeter units)

**Model appears but is all white**
- This is expected — we override all materials with the editor's color/finish. The original textures from Sketchfab are replaced.

**Model appears but is all black**
- The material override might be failing. Check that the `useEffect` is running (add a console.log)
- Make sure `getMaterialProps` is returning valid color values

**Color/finish changes don't apply**
- Verify that `clonedScene.traverse` is finding meshes (`isMesh` check)
- Check that the `useEffect` dependency array includes `baseColor`, `finish`, `activeSurface`, `textures`

**Clicking surfaces doesn't work**
- Ensure `mesh.userData.surface` is being set in the traverse
- Ensure `onClick={handleClick}` is on the `<primitive>` element
- Check that `e.stopPropagation()` is called to prevent event bubbling

**Build fails with TypeScript errors**
- Use `// eslint-disable-next-line @typescript-eslint/no-explicit-any` for the click handler type
- The R3F event type is not `THREE.Event` — use `any` for the click handler parameter
