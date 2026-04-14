"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useEditorStore } from "@/lib/store";
import { SurfaceTexture } from "@/lib/types";

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

// ---- Box Model (GLB) ----
export function BoxModel() {
  const { scene } = useGLTF("/models/package_box_mockup.glb");
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);

  const textures = useLoadedTextures(surfaceTextures);

  // Clone the scene so each instance is independent
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  // Apply color/finish overrides and textures to all meshes in the model
  useEffect(() => {
    const matProps = getMaterialProps(finish, baseColor);
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        // Determine which surface this mesh represents based on its name
        const name = mesh.name.toLowerCase();
        let surface = "front";
        if (name.includes("back")) surface = "back";
        else if (name.includes("left") || name.includes("side_l")) surface = "left";
        else if (name.includes("right") || name.includes("side_r")) surface = "right";
        else if (name.includes("top") || name.includes("lid")) surface = "top";

        // Create a new material preserving the original's maps
        const origMat = mesh.material as THREE.MeshStandardMaterial;
        const newMat = new THREE.MeshPhysicalMaterial({
          ...matProps,
          map: textures[surface] || origMat.map || null,
          normalMap: origMat.normalMap || null,
          emissive: new THREE.Color(activeSurface === surface ? "#1a1a2e" : "#000000"),
          emissiveIntensity: activeSurface === surface ? 0.05 : 0,
        });
        mesh.material = newMat;

        // Make mesh clickable — pick the first plausible surface
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
    <group scale={[4, 4, 4]} position={[0, -0.5, 0]}>
      <primitive object={clonedScene} onClick={handleClick} />
    </group>
  );
}
useGLTF.preload("/models/package_box_mockup.glb");

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

// ---- Cup Model (GLB) ----
export function CupModel() {
  const { scene } = useGLTF("/models/coffee_shop_cup.glb");
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);

  const textures = useLoadedTextures(surfaceTextures);

  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  // Apply color/finish overrides and textures
  useEffect(() => {
    const matProps = getMaterialProps(finish, baseColor);
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const name = mesh.name.toLowerCase();

        // Map mesh names to surfaces: sleeve-like vs body
        let surface: "body" | "sleeve" = "body";
        if (name.includes("sleeve") || name.includes("band") || name.includes("wrap") || name.includes("cardboard")) {
          surface = "sleeve";
        }

        const origMat = mesh.material as THREE.MeshStandardMaterial;

        if (surface === "sleeve") {
          const sleeveMat = new THREE.MeshPhysicalMaterial({
            color: "#8B6914",
            roughness: 0.9,
            metalness: 0,
            map: textures["sleeve"] || origMat.map || null,
            normalMap: origMat.normalMap || null,
            emissive: new THREE.Color(activeSurface === "sleeve" ? "#1a1a2e" : "#000000"),
            emissiveIntensity: activeSurface === "sleeve" ? 0.05 : 0,
          });
          mesh.material = sleeveMat;
        } else {
          const bodyMat = new THREE.MeshPhysicalMaterial({
            ...matProps,
            map: textures["body"] || origMat.map || null,
            normalMap: origMat.normalMap || null,
            emissive: new THREE.Color(activeSurface === "body" ? "#1a1a2e" : "#000000"),
            emissiveIntensity: activeSurface === "body" ? 0.05 : 0,
          });
          mesh.material = bodyMat;
        }

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
    <group scale={[0.6, 0.6, 0.6]} position={[0, -0.7, 0]}>
      <primitive object={clonedScene} onClick={handleClick} />
    </group>
  );
}
useGLTF.preload("/models/coffee_shop_cup.glb");

// ---- Car Sedan Model ----
export function CarSedanModel() {
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);

  const matProps = getMaterialProps(finish, baseColor);
  const clearcoat = finish === "glossy" ? 1.0 : finish === "metallic" ? 0.4 : 0.1;
  const paintProps = { ...matProps, clearcoat, clearcoatRoughness: finish === "glossy" ? 0.05 : 0.4 };
  const textures = useLoadedTextures(surfaceTextures);

  const wheelProps = { color: "#1a1a1a", roughness: 0.9, metalness: 0 };
  const rimProps = { color: "#aaaaaa", roughness: 0.3, metalness: 0.7 };
  const glassProps = { color: "#88aacc", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.4 };

  return (
    <group scale={[0.65, 0.65, 0.65]} position={[0, -0.3, 0]}>
      {/* Main body */}
      <mesh onClick={() => setActiveSurface("body")}>
        <boxGeometry args={[2.0, 0.5, 0.9]} />
        <meshPhysicalMaterial
          {...paintProps}
          map={textures["body"] || null}
          emissive={activeSurface === "body" ? "#1a1a2e" : "#000000"}
          emissiveIntensity={activeSurface === "body" ? 0.05 : 0}
        />
      </mesh>
      {/* Cabin */}
      <mesh position={[0.05, 0.45, 0]} onClick={() => setActiveSurface("roof")}>
        <boxGeometry args={[1.1, 0.42, 0.82]} />
        <meshPhysicalMaterial
          {...paintProps}
          map={textures["roof"] || null}
          emissive={activeSurface === "roof" ? "#1a1a2e" : "#000000"}
          emissiveIntensity={activeSurface === "roof" ? 0.05 : 0}
        />
      </mesh>
      {/* Hood */}
      <mesh position={[0.72, 0.14, 0]} onClick={() => setActiveSurface("hood")}>
        <boxGeometry args={[0.54, 0.1, 0.86]} />
        <meshPhysicalMaterial
          {...paintProps}
          map={textures["hood"] || null}
          emissive={activeSurface === "hood" ? "#1a1a2e" : "#000000"}
          emissiveIntensity={activeSurface === "hood" ? 0.05 : 0}
        />
      </mesh>
      {/* Windshield */}
      <mesh position={[0.56, 0.4, 0]} rotation={[0, 0, -0.4]}>
        <boxGeometry args={[0.36, 0.02, 0.76]} />
        <meshPhysicalMaterial {...glassProps} />
      </mesh>
      {/* Rear window */}
      <mesh position={[-0.46, 0.4, 0]} rotation={[0, 0, 0.35]}>
        <boxGeometry args={[0.3, 0.02, 0.76]} />
        <meshPhysicalMaterial {...glassProps} />
      </mesh>
      {/* Wheel FL */}
      <mesh position={[0.68, -0.28, 0.52]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.12, 24]} />
        <meshPhysicalMaterial {...wheelProps} />
      </mesh>
      <mesh position={[0.68, -0.28, 0.57]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.02, 12]} />
        <meshPhysicalMaterial {...rimProps} />
      </mesh>
      {/* Wheel FR */}
      <mesh position={[0.68, -0.28, -0.52]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.12, 24]} />
        <meshPhysicalMaterial {...wheelProps} />
      </mesh>
      <mesh position={[0.68, -0.28, -0.57]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.02, 12]} />
        <meshPhysicalMaterial {...rimProps} />
      </mesh>
      {/* Wheel RL */}
      <mesh position={[-0.65, -0.28, 0.52]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.12, 24]} />
        <meshPhysicalMaterial {...wheelProps} />
      </mesh>
      <mesh position={[-0.65, -0.28, 0.57]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.02, 12]} />
        <meshPhysicalMaterial {...rimProps} />
      </mesh>
      {/* Wheel RR */}
      <mesh position={[-0.65, -0.28, -0.52]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.12, 24]} />
        <meshPhysicalMaterial {...wheelProps} />
      </mesh>
      <mesh position={[-0.65, -0.28, -0.57]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.02, 12]} />
        <meshPhysicalMaterial {...rimProps} />
      </mesh>
    </group>
  );
}

// ---- Cargo Van Model ----
export function CarVanModel() {
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);

  const matProps = getMaterialProps(finish, baseColor);
  const clearcoatVan = finish === "glossy" ? 1.0 : finish === "metallic" ? 0.4 : 0.1;
  const paintProps = { ...matProps, clearcoat: clearcoatVan, clearcoatRoughness: finish === "glossy" ? 0.05 : 0.4 };
  const textures = useLoadedTextures(surfaceTextures);

  const wheelProps = { color: "#1a1a1a", roughness: 0.9, metalness: 0 };
  const rimProps = { color: "#aaaaaa", roughness: 0.3, metalness: 0.7 };
  const glassProps = { color: "#88aacc", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.35 };

  return (
    <group scale={[0.6, 0.6, 0.6]} position={[0, -0.4, 0]}>
      {/* Main van body */}
      <mesh position={[0, 0.25, 0]} onClick={() => setActiveSurface("body")}>
        <boxGeometry args={[2.2, 1.0, 0.98]} />
        <meshPhysicalMaterial
          {...paintProps}
          map={textures["body"] || null}
          emissive={activeSurface === "body" ? "#1a1a2e" : "#000000"}
          emissiveIntensity={activeSurface === "body" ? 0.05 : 0}
        />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 0.79, 0]} onClick={() => setActiveSurface("roof")}>
        <boxGeometry args={[2.2, 0.08, 0.98]} />
        <meshPhysicalMaterial
          {...paintProps}
          map={textures["roof"] || null}
          emissive={activeSurface === "roof" ? "#1a1a2e" : "#000000"}
          emissiveIntensity={activeSurface === "roof" ? 0.05 : 0}
        />
      </mesh>
      {/* Cab / hood */}
      <mesh position={[0.88, 0.0, 0]} onClick={() => setActiveSurface("hood")}>
        <boxGeometry args={[0.44, 0.6, 0.94]} />
        <meshPhysicalMaterial
          {...paintProps}
          map={textures["hood"] || null}
          emissive={activeSurface === "hood" ? "#1a1a2e" : "#000000"}
          emissiveIntensity={activeSurface === "hood" ? 0.05 : 0}
        />
      </mesh>
      {/* Windshield */}
      <mesh position={[0.74, 0.42, 0]}>
        <boxGeometry args={[0.02, 0.44, 0.86]} />
        <meshPhysicalMaterial {...glassProps} />
      </mesh>
      {/* Wheel FL */}
      <mesh position={[0.74, -0.32, 0.56]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.14, 24]} />
        <meshPhysicalMaterial {...wheelProps} />
      </mesh>
      <mesh position={[0.74, -0.32, 0.62]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.02, 12]} />
        <meshPhysicalMaterial {...rimProps} />
      </mesh>
      {/* Wheel FR */}
      <mesh position={[0.74, -0.32, -0.56]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.14, 24]} />
        <meshPhysicalMaterial {...wheelProps} />
      </mesh>
      <mesh position={[0.74, -0.32, -0.62]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.02, 12]} />
        <meshPhysicalMaterial {...rimProps} />
      </mesh>
      {/* Wheel RL */}
      <mesh position={[-0.74, -0.32, 0.56]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.14, 24]} />
        <meshPhysicalMaterial {...wheelProps} />
      </mesh>
      <mesh position={[-0.74, -0.32, 0.62]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.02, 12]} />
        <meshPhysicalMaterial {...rimProps} />
      </mesh>
      {/* Wheel RR */}
      <mesh position={[-0.74, -0.32, -0.56]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.14, 24]} />
        <meshPhysicalMaterial {...wheelProps} />
      </mesh>
      <mesh position={[-0.74, -0.32, -0.62]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.02, 12]} />
        <meshPhysicalMaterial {...rimProps} />
      </mesh>
    </group>
  );
}

// Texture loader hook
function useLoadedTextures(
  surfaceTextures: Record<string, SurfaceTexture>
): Record<string, THREE.Texture | null> {
  const [textures, setTextures] = useState<Record<string, THREE.Texture | null>>({});
  const prevUrls = useRef<Record<string, string | null>>({});

  // Derive which URLs need loading/clearing
  const urlMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const [name, surf] of Object.entries(surfaceTextures)) {
      map[name] = surf.imageUrl;
    }
    return map;
  }, [surfaceTextures]);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    for (const [name, url] of Object.entries(urlMap)) {
      if (url !== prevUrls.current[name]) {
        prevUrls.current[name] = url;
        if (url) {
          const surf = surfaceTextures[name];
          loader.load(url, (tex) => {
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
            setTextures((prev) => ({ ...prev, [name]: tex }));
          });
        } else {
          // Use setTimeout to avoid synchronous setState in effect body
          setTimeout(() => setTextures((prev) => ({ ...prev, [name]: null })), 0);
        }
      }
    }
  }, [urlMap, surfaceTextures]);

  return textures;
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
    case "car-sedan":
      return <CarSedanModel />;
    case "car-van":
      return <CarVanModel />;
    default:
      return <BoxModel />;
  }
}
