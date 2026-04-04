"use client";

import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useEditorStore } from "@/lib/store";
import { SurfaceTexture } from "@/lib/types";

function useSurfaceTexture(surfaceName: string) {
  const tex = useEditorStore((s) => s.surfaceTextures[surfaceName]);
  const textureRef = useRef<THREE.Texture | null>(null);

  useEffect(() => {
    if (tex?.imageUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(tex.imageUrl, (loaded) => {
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.wrapS = THREE.RepeatWrapping;
        loaded.wrapT = THREE.RepeatWrapping;
        textureRef.current = loaded;
      });
    } else {
      textureRef.current = null;
    }
  }, [tex?.imageUrl]);

  return { texture: textureRef.current, transform: tex };
}

function getMaterialProps(finish: string, color: string) {
  const base = { color };
  switch (finish) {
    case "glossy":
      return { ...base, roughness: 0.1, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1 };
    case "metallic":
      return { ...base, roughness: 0.3, metalness: 0.8 };
    case "kraft":
      return { ...base, color: "#c4a265", roughness: 0.9, metalness: 0 };
    default: // matte
      return { ...base, roughness: 0.8, metalness: 0 };
  }
}

// ---- Box Model ----
export function BoxModel() {
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);

  const matProps = getMaterialProps(finish, baseColor);

  const textures = useLoadedTextures(surfaceTextures);

  return (
    <group>
      {/* Front face */}
      <mesh
        position={[0, 0, 0.5]}
        onClick={() => setActiveSurface("front")}
      >
        <planeGeometry args={[1, 1.4]} />
        <meshPhysicalMaterial
          {...matProps}
          map={textures["front"] || null}
          emissive={activeSurface === "front" ? "#1a1a2e" : "#000000"}
          emissiveIntensity={activeSurface === "front" ? 0.05 : 0}
        />
      </mesh>
      {/* Back face */}
      <mesh
        position={[0, 0, -0.5]}
        rotation={[0, Math.PI, 0]}
        onClick={() => setActiveSurface("back")}
      >
        <planeGeometry args={[1, 1.4]} />
        <meshPhysicalMaterial
          {...matProps}
          map={textures["back"] || null}
          emissive={activeSurface === "back" ? "#1a1a2e" : "#000000"}
          emissiveIntensity={activeSurface === "back" ? 0.05 : 0}
        />
      </mesh>
      {/* Left face */}
      <mesh
        position={[-0.5, 0, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        onClick={() => setActiveSurface("left")}
      >
        <planeGeometry args={[1, 1.4]} />
        <meshPhysicalMaterial
          {...matProps}
          map={textures["left"] || null}
          emissive={activeSurface === "left" ? "#1a1a2e" : "#000000"}
          emissiveIntensity={activeSurface === "left" ? 0.05 : 0}
        />
      </mesh>
      {/* Right face */}
      <mesh
        position={[0.5, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
        onClick={() => setActiveSurface("right")}
      >
        <planeGeometry args={[1, 1.4]} />
        <meshPhysicalMaterial
          {...matProps}
          map={textures["right"] || null}
          emissive={activeSurface === "right" ? "#1a1a2e" : "#000000"}
          emissiveIntensity={activeSurface === "right" ? 0.05 : 0}
        />
      </mesh>
      {/* Top face */}
      <mesh
        position={[0, 0.7, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={() => setActiveSurface("top")}
      >
        <planeGeometry args={[1, 1]} />
        <meshPhysicalMaterial
          {...matProps}
          map={textures["top"] || null}
          emissive={activeSurface === "top" ? "#1a1a2e" : "#000000"}
          emissiveIntensity={activeSurface === "top" ? 0.05 : 0}
        />
      </mesh>
      {/* Box body (solid) */}
      <mesh>
        <boxGeometry args={[0.99, 1.39, 0.99]} />
        <meshPhysicalMaterial {...matProps} transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

// ---- Bottle Model ----
export function BottleModel() {
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);

  const matProps = getMaterialProps(finish, baseColor);
  const textures = useLoadedTextures(surfaceTextures);

  return (
    <group>
      {/* Bottle body */}
      <mesh
        position={[0, -0.2, 0]}
        onClick={() => setActiveSurface("body")}
      >
        <cylinderGeometry args={[0.4, 0.4, 1.2, 32]} />
        <meshPhysicalMaterial
          {...matProps}
          map={textures["body"] || null}
          emissive={activeSurface === "body" ? "#1a1a2e" : "#000000"}
          emissiveIntensity={activeSurface === "body" ? 0.05 : 0}
        />
      </mesh>
      {/* Neck */}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.15, 0.3, 0.3, 32]} />
        <meshPhysicalMaterial {...matProps} />
      </mesh>
      {/* Cap */}
      <mesh
        position={[0, 0.8, 0]}
        onClick={() => setActiveSurface("cap")}
      >
        <cylinderGeometry args={[0.17, 0.17, 0.2, 32]} />
        <meshPhysicalMaterial
          color={activeSurface === "cap" ? "#555" : "#333"}
          roughness={0.5}
          metalness={0.3}
          map={textures["cap"] || null}
        />
      </mesh>
    </group>
  );
}

// ---- Can Model ----
export function CanModel() {
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);

  const matProps = getMaterialProps(finish, baseColor);
  const textures = useLoadedTextures(surfaceTextures);

  return (
    <group>
      {/* Can body */}
      <mesh onClick={() => setActiveSurface("body")}>
        <cylinderGeometry args={[0.33, 0.33, 1.2, 32]} />
        <meshPhysicalMaterial
          {...matProps}
          metalness={0.7}
          roughness={0.2}
          map={textures["body"] || null}
          emissive={activeSurface === "body" ? "#1a1a2e" : "#000000"}
          emissiveIntensity={activeSurface === "body" ? 0.05 : 0}
        />
      </mesh>
      {/* Top rim */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.28, 0.33, 0.05, 32]} />
        <meshPhysicalMaterial color="#aaa" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Pull tab */}
      <mesh position={[0, 0.63, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.12, 0.01, 0.06]} />
        <meshPhysicalMaterial color="#999" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
}

// ---- Pouch Model ----
export function PouchModel() {
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);

  const matProps = getMaterialProps(finish, baseColor);
  const textures = useLoadedTextures(surfaceTextures);

  const pouchShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.4, -0.6);
    shape.lineTo(-0.45, -0.7);
    shape.lineTo(0.45, -0.7);
    shape.lineTo(0.4, -0.6);
    shape.lineTo(0.35, 0.6);
    shape.quadraticCurveTo(0, 0.75, -0.35, 0.6);
    shape.lineTo(-0.4, -0.6);
    return shape;
  }, []);

  return (
    <group>
      {/* Front */}
      <mesh
        position={[0, 0, 0.08]}
        onClick={() => setActiveSurface("front")}
      >
        <shapeGeometry args={[pouchShape]} />
        <meshPhysicalMaterial
          {...matProps}
          map={textures["front"] || null}
          emissive={activeSurface === "front" ? "#1a1a2e" : "#000000"}
          emissiveIntensity={activeSurface === "front" ? 0.05 : 0}
        />
      </mesh>
      {/* Back */}
      <mesh
        position={[0, 0, -0.08]}
        rotation={[0, Math.PI, 0]}
        onClick={() => setActiveSurface("back")}
      >
        <shapeGeometry args={[pouchShape]} />
        <meshPhysicalMaterial
          {...matProps}
          map={textures["back"] || null}
          emissive={activeSurface === "back" ? "#1a1a2e" : "#000000"}
          emissiveIntensity={activeSurface === "back" ? 0.05 : 0}
        />
      </mesh>
      {/* Side gussets */}
      <mesh position={[0.4, -0.05, 0]}>
        <boxGeometry args={[0.02, 1.2, 0.16]} />
        <meshPhysicalMaterial {...matProps} />
      </mesh>
      <mesh position={[-0.4, -0.05, 0]}>
        <boxGeometry args={[0.02, 1.2, 0.16]} />
        <meshPhysicalMaterial {...matProps} />
      </mesh>
      {/* Bottom gusset */}
      <mesh position={[0, -0.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.9, 0.16]} />
        <meshPhysicalMaterial {...matProps} />
      </mesh>
    </group>
  );
}

// ---- Tube Model ----
export function TubeModel() {
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);

  const matProps = getMaterialProps(finish, baseColor);
  const textures = useLoadedTextures(surfaceTextures);

  return (
    <group>
      {/* Tube body */}
      <mesh
        position={[0, -0.1, 0]}
        onClick={() => setActiveSurface("body")}
      >
        <cylinderGeometry args={[0.2, 0.25, 1.0, 32]} />
        <meshPhysicalMaterial
          {...matProps}
          map={textures["body"] || null}
          emissive={activeSurface === "body" ? "#1a1a2e" : "#000000"}
          emissiveIntensity={activeSurface === "body" ? 0.05 : 0}
        />
      </mesh>
      {/* Bottom seal */}
      <mesh position={[0, -0.62, 0]}>
        <boxGeometry args={[0.5, 0.04, 0.04]} />
        <meshPhysicalMaterial {...matProps} />
      </mesh>
      {/* Cap */}
      <mesh
        position={[0, 0.5, 0]}
        onClick={() => setActiveSurface("cap")}
      >
        <cylinderGeometry args={[0.12, 0.15, 0.15, 32]} />
        <meshPhysicalMaterial
          color={activeSurface === "cap" ? "#555" : "#333"}
          roughness={0.4}
          metalness={0.2}
          map={textures["cap"] || null}
        />
      </mesh>
      {/* Nozzle */}
      <mesh position={[0, 0.58, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 0.06, 16]} />
        <meshPhysicalMaterial color="#ddd" roughness={0.3} />
      </mesh>
    </group>
  );
}

// ---- Cup Model ----
export function CupModel() {
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);

  const matProps = getMaterialProps(finish, baseColor);
  const textures = useLoadedTextures(surfaceTextures);

  return (
    <group>
      {/* Cup body */}
      <mesh
        position={[0, -0.05, 0]}
        onClick={() => setActiveSurface("body")}
      >
        <cylinderGeometry args={[0.4, 0.3, 1.1, 32, 1, true]} />
        <meshPhysicalMaterial
          {...matProps}
          side={THREE.DoubleSide}
          map={textures["body"] || null}
          emissive={activeSurface === "body" ? "#1a1a2e" : "#000000"}
          emissiveIntensity={activeSurface === "body" ? 0.05 : 0}
        />
      </mesh>
      {/* Bottom */}
      <mesh position={[0, -0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.3, 32]} />
        <meshPhysicalMaterial {...matProps} />
      </mesh>
      {/* Rim */}
      <mesh position={[0, 0.5, 0]}>
        <torusGeometry args={[0.4, 0.03, 8, 32]} />
        <meshPhysicalMaterial {...matProps} />
      </mesh>
      {/* Sleeve */}
      <mesh
        position={[0, -0.15, 0]}
        onClick={() => setActiveSurface("sleeve")}
      >
        <cylinderGeometry args={[0.37, 0.32, 0.5, 32, 1, true]} />
        <meshPhysicalMaterial
          color="#8B6914"
          roughness={0.9}
          metalness={0}
          side={THREE.DoubleSide}
          map={textures["sleeve"] || null}
          emissive={activeSurface === "sleeve" ? "#1a1a2e" : "#000000"}
          emissiveIntensity={activeSurface === "sleeve" ? 0.05 : 0}
        />
      </mesh>
    </group>
  );
}

// Texture loader hook
function useLoadedTextures(
  surfaceTextures: Record<string, SurfaceTexture>
): Record<string, THREE.Texture | null> {
  const texturesRef = useRef<Record<string, THREE.Texture | null>>({});
  const prevUrls = useRef<Record<string, string | null>>({});

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    for (const [name, surf] of Object.entries(surfaceTextures)) {
      if (surf.imageUrl !== prevUrls.current[name]) {
        prevUrls.current[name] = surf.imageUrl;
        if (surf.imageUrl) {
          loader.load(surf.imageUrl, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.flipY = true;
            if (surf.scale !== 1) {
              tex.repeat.set(1 / surf.scale, 1 / surf.scale);
            }
            tex.offset.set(surf.offsetX, surf.offsetY);
            tex.rotation = surf.rotation;
            tex.wrapS = THREE.ClampToEdgeWrapping;
            tex.wrapT = THREE.ClampToEdgeWrapping;
            tex.needsUpdate = true;
            texturesRef.current = {
              ...texturesRef.current,
              [name]: tex,
            };
          });
        } else {
          texturesRef.current = {
            ...texturesRef.current,
            [name]: null,
          };
        }
      }
    }
  }, [surfaceTextures]);

  return texturesRef.current;
}

export function PackagingModelSwitch({
  templateId,
}: {
  templateId: string;
}) {
  switch (templateId) {
    case "tuck-end-box":
      return <BoxModel />;
    case "bottle":
      return <BottleModel />;
    case "beverage-can":
      return <CanModel />;
    case "stand-up-pouch":
      return <PouchModel />;
    case "cosmetic-tube":
      return <TubeModel />;
    case "coffee-cup":
      return <CupModel />;
    default:
      return <BoxModel />;
  }
}
