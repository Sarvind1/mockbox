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

// ---- Dodge Charger SRT8 (GLB) ----
export function CarSedanModel() {
  const { scene } = useGLTF("/models/2013_dodge_charger_srt8.glb");
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);
  const textures = useLoadedTextures(surfaceTextures);
  const clonedScene = useMemo(() => {
    const cloned = scene.clone(true);
    // Neutralize transmission materials before first render — prevents WebGL state corruption
    cloned.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((mesh.material as any).transmission > 0) {
        mesh.material = new THREE.MeshPhysicalMaterial({ color: "#aaccff", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.25 });
      }
    });
    return cloned;
  }, [scene]);

  useEffect(() => {
    const matProps = getMaterialProps(finish, baseColor);
    const clearcoat = finish === "glossy" ? 1.0 : finish === "metallic" ? 0.5 : 0.1;
    const clearcoatRoughness = finish === "glossy" ? 0.05 : 0.3;
    clonedScene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const name = mesh.name;
      const origMat = mesh.material as THREE.MeshStandardMaterial;

      if (name.includes("M_Paint") || name.includes("M_PaintNormalMap")) {
        mesh.material = new THREE.MeshPhysicalMaterial({
          ...matProps, clearcoat, clearcoatRoughness,
          map: textures["body"] || null,
          normalMap: origMat.normalMap || null,
          emissive: new THREE.Color(activeSurface === "body" ? "#1a1a2e" : "#000000"),
          emissiveIntensity: activeSurface === "body" ? 0.05 : 0,
        });
        mesh.userData.surface = "body";
      } else if (name.includes("M_Glass") || name.includes("M_Light") || name.includes("M_GlassColor")) {
        mesh.material = new THREE.MeshPhysicalMaterial({
          color: name.includes("M_GlassColor") ? "#ff6600" : "#aaccff",
          roughness: 0.05, metalness: 0,
          transparent: true, opacity: name.includes("M_Light") ? 0.6 : 0.25,
        });
      }
      // Other meshes keep original material
    });
  }, [clonedScene, baseColor, finish, activeSurface, textures]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (e: any) => {
    e.stopPropagation();
    const mesh = e.object as THREE.Mesh;
    if (mesh.userData.surface) setActiveSurface(mesh.userData.surface);
  };

  return (
    <group scale={[35, 35, 35]} position={[0, -0.45, 0]}>
      <primitive object={clonedScene} onClick={handleClick} />
    </group>
  );
}
useGLTF.preload("/models/2013_dodge_charger_srt8.glb");

// ---- Dodge Challenger SRT Hellcat (GLB) ----
export function CarVanModel() {
  const { scene } = useGLTF("/models/dodge_challenger_srt_hellcat_redeye__free.glb");
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);
  const textures = useLoadedTextures(surfaceTextures);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    const matProps = getMaterialProps(finish, baseColor);
    const clearcoat = finish === "glossy" ? 1.0 : finish === "metallic" ? 0.5 : 0.1;
    const clearcoatRoughness = finish === "glossy" ? 0.05 : 0.3;
    clonedScene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const matName = (mesh.material as THREE.Material).name;
      // DCSHR_Dark_Green is the car body paint material (name is from original 3D file)
      if (matName === "DCSHR_Dark_Green") {
        const origMat = mesh.material as THREE.MeshStandardMaterial;
        mesh.material = new THREE.MeshPhysicalMaterial({
          ...matProps, clearcoat, clearcoatRoughness,
          map: textures["body"] || null,
          normalMap: origMat.normalMap || null,
          emissive: new THREE.Color(activeSurface === "body" ? "#1a1a2e" : "#000000"),
          emissiveIntensity: activeSurface === "body" ? 0.05 : 0,
        });
        mesh.userData.surface = "body";
      }
      // Everything else keeps original GLB material
    });
  }, [clonedScene, baseColor, finish, activeSurface, textures]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (e: any) => {
    e.stopPropagation();
    const mesh = e.object as THREE.Mesh;
    if (mesh.userData.surface) setActiveSurface(mesh.userData.surface);
  };

  return (
    <group scale={[0.35, 0.35, 0.35]} position={[0, -0.45, 0]}>
      <primitive object={clonedScene} onClick={handleClick} />
    </group>
  );
}
useGLTF.preload("/models/dodge_challenger_srt_hellcat_redeye__free.glb");

// ---- Porsche 911 Targa 4S (GLB) ----
export function Porsche911Model() {
  const { scene } = useGLTF("/models/porsche_911.glb");
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);
  const textures = useLoadedTextures(surfaceTextures);
  const clonedScene = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((mesh.material as any).transmission > 0) {
        mesh.material = new THREE.MeshPhysicalMaterial({ color: "#aaccff", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.25 });
      }
    });
    // Center Porsche at origin — the GLB has geometry heavily offset from local origin
    const box = new THREE.Box3().setFromObject(cloned);
    const center = box.getCenter(new THREE.Vector3());
    cloned.position.set(-center.x, -box.min.y, -center.z);
    return cloned;
  }, [scene]);

  useEffect(() => {
    const matProps = getMaterialProps(finish, baseColor);
    const clearcoat = finish === "glossy" ? 1.0 : finish === "metallic" ? 0.5 : 0.1;
    const clearcoatRoughness = finish === "glossy" ? 0.05 : 0.3;
    clonedScene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const matName = (mesh.material as THREE.Material).name;
      if (matName === "PAINT_COLOR_4") {
        const origMat = mesh.material as THREE.MeshStandardMaterial;
        mesh.material = new THREE.MeshPhysicalMaterial({
          ...matProps, clearcoat, clearcoatRoughness,
          map: textures["body"] || null,
          normalMap: origMat.normalMap || null,
          emissive: new THREE.Color(activeSurface === "body" ? "#1a1a2e" : "#000000"),
          emissiveIntensity: activeSurface === "body" ? 0.05 : 0,
        });
        mesh.userData.surface = "body";
      }
    });
  }, [clonedScene, baseColor, finish, activeSurface, textures]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (e: any) => {
    e.stopPropagation();
    const mesh = e.object as THREE.Mesh;
    if (mesh.userData.surface) setActiveSurface(mesh.userData.surface);
  };

  return (
    <group scale={[0.015, 0.015, 0.015]} position={[0, -0.45, 0]}>
      <primitive object={clonedScene} onClick={handleClick} />
    </group>
  );
}
useGLTF.preload("/models/porsche_911.glb");

// ---- Porsche 911 Targa 4S (GLB) with canvas panel zones ----
export function Porsche911PanelsModel() {
  const { scene } = useGLTF("/models/porsche_911_panels.glb");
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const selectedZoneIds = useEditorStore((s) => s.selectedZoneIds);
  const toggleZoneInSelection = useEditorStore((s) => s.toggleZoneInSelection);
  const multiSelectMode = useEditorStore((s) => s.multiSelectMode);
  const singlePaste = useEditorStore((s) => s.singlePaste);
  const singlePasteGroups = useEditorStore((s) => s.singlePasteGroups);
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);
  const textures = useLoadedTextures(surfaceTextures);
  const compositeCacheRef = useRef<Map<string, THREE.CanvasTexture>>(new Map());

  const clonedScene = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((mesh.material as any).transmission > 0) {
        mesh.material = new THREE.MeshPhysicalMaterial({ color: "#aaccff", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.25 });
      } else if ((mesh.material as THREE.Material).name === "PAINT_COLOR_4") {
        // Panel meshes from the split script — mesh.name is the zone id (e.g. "hood", "door_l")
        mesh.userData.surface = mesh.name;
      } else if ((mesh.material as THREE.Material).name === "PLASTI_NEGRO_3") {
        // Black plastic trim (bumper insets, mirrors, door handles, spoiler trim)
        mesh.userData.surface = "trim";
      }
    });
    // Center the Porsche at origin (GLB geometry is offset from local origin)
    const box = new THREE.Box3().setFromObject(cloned);
    const center = box.getCenter(new THREE.Vector3());
    cloned.position.set(-center.x, -box.min.y, -center.z);
    return cloned;
  }, [scene]);

  useEffect(() => {
    const clearcoat = finish === "glossy" ? 1.0 : finish === "metallic" ? 0.5 : 0.1;
    const clearcoatRoughness = finish === "glossy" ? 0.05 : 0.3;
    const compositeCache = compositeCacheRef.current;

    clonedScene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const zoneName: string | undefined = mesh.userData.surface;

      if (!zoneName) return;

      const surf = surfaceTextures[zoneName];
      const zoneColor = surf?.color ?? baseColor;
      const rawTex = textures[zoneName] ?? null;
      const isSelected = selectedZoneIds.includes(zoneName);
      const isActive = activeSurface === zoneName;

      let mapTex: THREE.Texture | null = rawTex;
      if (rawTex) {
        const effectiveBg = surf?.color ?? baseColor;
        const key = `${surf?.imageUrl}:${effectiveBg}`;
        if (!compositeCache.has(key)) {
          const img = rawTex.image as HTMLImageElement | HTMLCanvasElement;
          const w = (img as HTMLImageElement).naturalWidth || img.width || 512;
          const h = (img as HTMLImageElement).naturalHeight || img.height || 512;
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = effectiveBg;
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const ct = new THREE.CanvasTexture(canvas);
          ct.colorSpace = THREE.SRGBColorSpace;
          ct.flipY = rawTex.flipY;
          ct.wrapS = rawTex.wrapS;
          ct.wrapT = rawTex.wrapT;
          compositeCache.set(key, ct);
        }
        mapTex = compositeCache.get(key)!;
      }

      if (mapTex && surf) {
        const s = surf.scale || 1;
        mapTex.repeat.set(surf.mirrorX ? -1 / s : 1 / s, 1 / s);
        mapTex.offset.set(surf.offsetX, surf.offsetY);
        mapTex.rotation = surf.rotation;
        mapTex.center.set(0.5, 0.5);
        mapTex.needsUpdate = true;
      }

      const displayColor = new THREE.Color(zoneColor);
      if (isSelected && !rawTex) {
        displayColor.lerp(new THREE.Color("#ff2200"), isActive ? 0.72 : 0.55);
      }
      const matColorHex = rawTex ? "#ffffff" : "#" + displayColor.getHexString();
      const matProps = getMaterialProps(finish, matColorHex);

      const hasTexture = rawTex !== null;
      mesh.material = new THREE.MeshPhysicalMaterial({
        ...matProps, clearcoat, clearcoatRoughness,
        map: mapTex,
        emissive: new THREE.Color(!hasTexture && isActive ? "#ff3300" : !hasTexture && isSelected ? "#cc2200" : "#000000"),
        emissiveIntensity: !hasTexture && isActive ? 0.45 : !hasTexture && isSelected ? 0.32 : 0,
      });
    });

    // ── Single paste: world-space UV projection ──
    const activePasteGroups: string[][] = [...singlePasteGroups];
    if (singlePaste && selectedZoneIds.length > 1) {
      const isAlreadySaved = singlePasteGroups.some(
        (g) => g.length === selectedZoneIds.length && g.every((id) => selectedZoneIds.includes(id))
      );
      if (!isAlreadySaved) activePasteGroups.push([...selectedZoneIds]);
    }

    const zonesWithPasteUV = new Set<string>();

    if (activePasteGroups.length > 0) {
      clonedScene.updateMatrixWorld(true);

      const allZoneMeshes: Record<string, THREE.Mesh> = {};
      clonedScene.traverse((child) => {
        const m = child as THREE.Mesh;
        if (m.isMesh && m.userData.surface) allZoneMeshes[m.userData.surface as string] = m;
      });

      type CoordIdx = 0 | 1 | 2;
      const c = (v: THREE.Vector3, i: CoordIdx) => [v.x, v.y, v.z][i];

      for (const groupZoneIds of activePasteGroups) {
        const zoneMeshes: Record<string, THREE.Mesh> = {};
        for (const id of groupZoneIds) {
          if (allZoneMeshes[id]) zoneMeshes[id] = allZoneMeshes[id];
        }
        if (Object.keys(zoneMeshes).length < 2) continue;

        const combinedWorld = new THREE.Box3();
        for (const m of Object.values(zoneMeshes)) combinedWorld.union(new THREE.Box3().setFromObject(m));
        const worldSize = combinedWorld.getSize(new THREE.Vector3());

        const minDimIdx = [worldSize.x, worldSize.y, worldSize.z]
          .indexOf(Math.min(worldSize.x, worldSize.y, worldSize.z)) as CoordIdx;
        const [uCoord, vCoord]: [CoordIdx, CoordIdx] =
          minDimIdx === 0 ? [2, 1] :
          minDimIdx === 1 ? [0, 2] :
                            [0, 1];

        const groupMinU = c(combinedWorld.min, uCoord);
        const groupMinV = c(combinedWorld.min, vCoord);
        const groupExtU = c(worldSize, uCoord) || 1;
        const groupExtV = c(worldSize, vCoord) || 1;

        const bboxCenterX = (combinedWorld.min.x + combinedWorld.max.x) / 2;
        const autoFlipU = minDimIdx === 0 && bboxCenterX < 0;
        const userMirror = surfaceTextures[groupZoneIds[0]]?.mirrorX ?? false;
        const flipU = autoFlipU !== userMirror;

        const vertex = new THREE.Vector3();

        for (const [name, m] of Object.entries(zoneMeshes)) {
          const mat = m.material as THREE.MeshPhysicalMaterial;
          if (!mat.map) continue;

          const posAttr = m.geometry.getAttribute("position") as THREE.BufferAttribute;
          const count = posAttr.count;
          const newUVData = new Float32Array(count * 2);
          for (let i = 0; i < count; i++) {
            vertex.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
            m.localToWorld(vertex);
            const rawU = (c(vertex, uCoord) - groupMinU) / groupExtU;
            newUVData[i * 2 + 0] = flipU ? 1 - rawU : rawU;
            newUVData[i * 2 + 1] = (c(vertex, vCoord) - groupMinV) / groupExtV;
          }

          if (!m.geometry.userData.originalUV) {
            m.geometry.userData.originalUV = m.geometry.getAttribute("uv");
          }
          m.geometry.setAttribute("uv", new THREE.BufferAttribute(newUVData, 2));
          m.geometry.attributes.uv.needsUpdate = true;

          const surf = surfaceTextures[name];
          const s = surf?.scale ?? 1;
          mat.map.repeat.set(1 / s, 1 / s);
          mat.map.offset.set(surf?.offsetX ?? 0, surf?.offsetY ?? 0);
          mat.map.rotation = surf?.rotation ?? 0;
          mat.map.center.set(0.5, 0.5);
          mat.map.needsUpdate = true;
          mat.needsUpdate = true;
          zonesWithPasteUV.add(name);
        }
      }
    }

    clonedScene.traverse((child) => {
      const m = child as THREE.Mesh;
      if (m.isMesh && m.geometry?.userData?.originalUV && !zonesWithPasteUV.has(m.userData.surface as string)) {
        m.geometry.setAttribute("uv", m.geometry.userData.originalUV);
        delete m.geometry.userData.originalUV;
        m.geometry.attributes.uv.needsUpdate = true;
      }
    });
  }, [clonedScene, baseColor, finish, activeSurface, selectedZoneIds, singlePaste, singlePasteGroups, textures, surfaceTextures]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (e: any) => {
    e.stopPropagation();
    const mesh = e.object as THREE.Mesh;
    const zone = mesh.userData.surface as string | undefined;
    if (!zone) return;
    if (multiSelectMode || e.nativeEvent?.shiftKey) {
      toggleZoneInSelection(zone);
    } else if (activeSurface === zone && selectedZoneIds.length === 1) {
      setActiveSurface("body");
    } else {
      setActiveSurface(zone);
    }
  };

  return (
    <group scale={[0.015, 0.015, 0.015]} position={[0, -0.45, 0]}>
      <primitive object={clonedScene} onClick={handleClick} />
    </group>
  );
}
useGLTF.preload("/models/porsche_911_panels.glb");

// ---- BMW X5M 2016 (GLB) with canvas panel zones ----
export function BmwX5mModel() {
  const { scene } = useGLTF("/models/2016_bmw_x5m_panels.glb");
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const selectedZoneIds = useEditorStore((s) => s.selectedZoneIds);
  const toggleZoneInSelection = useEditorStore((s) => s.toggleZoneInSelection);
  const multiSelectMode = useEditorStore((s) => s.multiSelectMode);
  const singlePaste = useEditorStore((s) => s.singlePaste);
  const singlePasteGroups = useEditorStore((s) => s.singlePasteGroups);
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);
  const textures = useLoadedTextures(surfaceTextures);
  // Cache for composite textures (color background + logo on top)
  const compositeCacheRef = useRef<Map<string, THREE.CanvasTexture>>(new Map());

  const clonedScene = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((mesh.material as any).transmission > 0) {
        // Neutralize transmission materials before first render to avoid WebGL corruption
        mesh.material = new THREE.MeshPhysicalMaterial({ color: "#aaccff", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.25 });
      } else if ((mesh.material as THREE.Material).name === "carpaint") {
        // Tag canvas zone panel meshes by their node name (e.g. "hood", "roof", …)
        mesh.userData.surface = mesh.name;
      } else if ((mesh.material as THREE.Material).name === "phong9") {
        // 99 black trim meshes (B-pillar, window surrounds, door frames, A-pillar trim).
        // Group them all under a single "trim" zone so they default to body color
        // and can be overridden as one unit from the editor.
        mesh.userData.surface = "trim";
      }
    });
    return cloned;
  }, [scene]);

  useEffect(() => {
    const clearcoat = finish === "glossy" ? 1.0 : finish === "metallic" ? 0.5 : 0.1;
    const clearcoatRoughness = finish === "glossy" ? 0.05 : 0.3;
    const compositeCache = compositeCacheRef.current;

    clonedScene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const zoneName: string | undefined = mesh.userData.surface;

      if (!zoneName) return;

      const surf = surfaceTextures[zoneName];
      const zoneColor = surf?.color ?? baseColor;
      const rawTex = textures[zoneName] ?? null;
      const isSelected = selectedZoneIds.includes(zoneName);
      const isActive = activeSurface === zoneName;

      // Always composite when there's a texture: fill canvas with effective background color
      // (zone override or body base color) then draw the logo on top.
      // This ensures transparent/removed-background pixels show the material color,
      // not black or the image's own edge color.
      let mapTex: THREE.Texture | null = rawTex;
      if (rawTex) {
        const effectiveBg = surf?.color ?? baseColor;
        const key = `${surf?.imageUrl}:${effectiveBg}`;
        if (!compositeCache.has(key)) {
          const img = rawTex.image as HTMLImageElement | HTMLCanvasElement;
          const w = (img as HTMLImageElement).naturalWidth || img.width || 512;
          const h = (img as HTMLImageElement).naturalHeight || img.height || 512;
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = effectiveBg;
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const ct = new THREE.CanvasTexture(canvas);
          ct.colorSpace = THREE.SRGBColorSpace;
          ct.flipY = rawTex.flipY;
          ct.wrapS = rawTex.wrapS;
          ct.wrapT = rawTex.wrapT;
          compositeCache.set(key, ct);
        }
        mapTex = compositeCache.get(key)!;
      }

      // Apply user transforms to the active texture
      if (mapTex && surf) {
        const s = surf.scale || 1;
        mapTex.repeat.set(surf.mirrorX ? -1 / s : 1 / s, 1 / s);
        mapTex.offset.set(surf.offsetX, surf.offsetY);
        mapTex.rotation = surf.rotation;
        mapTex.center.set(0.5, 0.5);
        mapTex.needsUpdate = true;
      }

      // Selection highlight:
      // Textured zones → emissive-only (don't tint the logo with material.color lerp)
      // Untextured zones → lerp color toward signal red
      const displayColor = new THREE.Color(zoneColor);
      if (isSelected && !rawTex) {
        displayColor.lerp(new THREE.Color("#ff2200"), isActive ? 0.72 : 0.55);
      }
      // White material color when textured so material.color doesn't multiply/tint the map
      const matColorHex = rawTex ? "#ffffff" : "#" + displayColor.getHexString();
      const matProps = getMaterialProps(finish, matColorHex);

      // No emissive glow when zone has a texture — emissive bleeds through dark
      // parts of the logo creating an ugly red halo. Untextured zones keep the
      // signal-red emissive so selection is still visually distinct.
      const hasTexture = rawTex !== null;
      mesh.material = new THREE.MeshPhysicalMaterial({
        ...matProps, clearcoat, clearcoatRoughness,
        map: mapTex,
        emissive: new THREE.Color(!hasTexture && isActive ? "#ff3300" : !hasTexture && isSelected ? "#cc2200" : "#000000"),
        emissiveIntensity: !hasTexture && isActive ? 0.45 : !hasTexture && isSelected ? 0.32 : 0,
      });
    });

    // ── Single paste: world-space UV projection ──
    // Apply for all active paste groups: saved groups + current selection if singlePaste is on
    const activePasteGroups: string[][] = [...singlePasteGroups];
    if (singlePaste && selectedZoneIds.length > 1) {
      const isAlreadySaved = singlePasteGroups.some(
        (g) => g.length === selectedZoneIds.length && g.every((id) => selectedZoneIds.includes(id))
      );
      if (!isAlreadySaved) activePasteGroups.push([...selectedZoneIds]);
    }

    const zonesWithPasteUV = new Set<string>();

    if (activePasteGroups.length > 0) {
      clonedScene.updateMatrixWorld(true);

      // Build a zone-name → mesh lookup once
      const allZoneMeshes: Record<string, THREE.Mesh> = {};
      clonedScene.traverse((child) => {
        const m = child as THREE.Mesh;
        if (m.isMesh && m.userData.surface) allZoneMeshes[m.userData.surface as string] = m;
      });

      type CoordIdx = 0 | 1 | 2;
      const c = (v: THREE.Vector3, i: CoordIdx) => [v.x, v.y, v.z][i];

      for (const groupZoneIds of activePasteGroups) {
        const zoneMeshes: Record<string, THREE.Mesh> = {};
        for (const id of groupZoneIds) {
          if (allZoneMeshes[id]) zoneMeshes[id] = allZoneMeshes[id];
        }
        if (Object.keys(zoneMeshes).length < 2) continue;

        const combinedWorld = new THREE.Box3();
        for (const m of Object.values(zoneMeshes)) combinedWorld.union(new THREE.Box3().setFromObject(m));
        const worldSize = combinedWorld.getSize(new THREE.Vector3());

        const minDimIdx = [worldSize.x, worldSize.y, worldSize.z]
          .indexOf(Math.min(worldSize.x, worldSize.y, worldSize.z)) as CoordIdx;
        const [uCoord, vCoord]: [CoordIdx, CoordIdx] =
          minDimIdx === 0 ? [2, 1] :  // thin in X → side panels  → U=Z, V=Y
          minDimIdx === 1 ? [0, 2] :  // thin in Y → top panels   → U=X, V=Z
                            [0, 1];   // thin in Z → front/rear   → U=X, V=Y

        const groupMinU = c(combinedWorld.min, uCoord);
        const groupMinV = c(combinedWorld.min, vCoord);
        const groupExtU = c(worldSize, uCoord) || 1;
        const groupExtV = c(worldSize, vCoord) || 1;

        // For left-side panels (thin in X, bbox center X < 0), invert U so the
        // image reads correctly when viewed from outside the car.
        // When U=Z and you look at the left side, front is to your right → U
        // goes right-to-left → text appears mirrored. Flipping U corrects this.
        const bboxCenterX = (combinedWorld.min.x + combinedWorld.max.x) / 2;
        const autoFlipU = minDimIdx === 0 && bboxCenterX < 0;
        // mirrorX from the first zone in the group drives the user-requested flip
        const userMirror = surfaceTextures[groupZoneIds[0]]?.mirrorX ?? false;
        const flipU = autoFlipU !== userMirror; // XOR: either auto-flip or user-flip, not both

        const vertex = new THREE.Vector3();

        for (const [name, m] of Object.entries(zoneMeshes)) {
          const mat = m.material as THREE.MeshPhysicalMaterial;
          if (!mat.map) continue;

          const posAttr = m.geometry.getAttribute("position") as THREE.BufferAttribute;
          const count = posAttr.count;
          const newUVData = new Float32Array(count * 2);
          for (let i = 0; i < count; i++) {
            vertex.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
            m.localToWorld(vertex);
            const rawU = (c(vertex, uCoord) - groupMinU) / groupExtU;
            newUVData[i * 2 + 0] = flipU ? 1 - rawU : rawU;
            newUVData[i * 2 + 1] = (c(vertex, vCoord) - groupMinV) / groupExtV;
          }

          if (!m.geometry.userData.originalUV) {
            m.geometry.userData.originalUV = m.geometry.getAttribute("uv");
          }
          m.geometry.setAttribute("uv", new THREE.BufferAttribute(newUVData, 2));
          m.geometry.attributes.uv.needsUpdate = true;

          const surf = surfaceTextures[name];
          const s = surf?.scale ?? 1;
          mat.map.repeat.set(1 / s, 1 / s);
          mat.map.offset.set(surf?.offsetX ?? 0, surf?.offsetY ?? 0);
          mat.map.rotation = surf?.rotation ?? 0;
          mat.map.center.set(0.5, 0.5);
          mat.map.needsUpdate = true;
          mat.needsUpdate = true;
          zonesWithPasteUV.add(name);
        }
      }
    }

    // Restore original UVs only for zones not covered by any paste group
    clonedScene.traverse((child) => {
      const m = child as THREE.Mesh;
      if (m.isMesh && m.geometry?.userData?.originalUV && !zonesWithPasteUV.has(m.userData.surface as string)) {
        m.geometry.setAttribute("uv", m.geometry.userData.originalUV);
        delete m.geometry.userData.originalUV;
        m.geometry.attributes.uv.needsUpdate = true;
      }
    });
  }, [clonedScene, baseColor, finish, activeSurface, selectedZoneIds, singlePaste, singlePasteGroups, textures, surfaceTextures]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (e: any) => {
    e.stopPropagation();
    const mesh = e.object as THREE.Mesh;
    const zone = mesh.userData.surface as string | undefined;
    if (!zone) return;
    if (multiSelectMode || e.nativeEvent?.shiftKey) {
      toggleZoneInSelection(zone);
    } else if (activeSurface === zone && selectedZoneIds.length === 1) {
      // Click active zone again → deselect back to primary surface
      setActiveSurface("body");
    } else {
      setActiveSurface(zone);
    }
  };

  return (
    <group scale={[35, 35, 35]} position={[0, -0.45, 0]}>
      <primitive object={clonedScene} onClick={handleClick} />
    </group>
  );
}
useGLTF.preload("/models/2016_bmw_x5m_panels.glb");

// Flood-fill background removal: BFS from image edges, remove pixels similar to the corner bg color.
// Also feathers alpha on anti-aliased fringe pixels so they blend smoothly with the zone color
// instead of retaining dark (background-tinted) halos.
function removeSolidBackground(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width, h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const px = imgData.data;
  // If top-left pixel is already transparent, nothing to do
  if (px[3] < 128) return;
  const bgR = px[0], bgG = px[1], bgB = px[2];
  const threshold = 32;
  // fringeMax: pixels within this distance of bg color get proportional alpha
  const fringeMax = 80;
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  const tryPush = (x: number, y: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const idx = y * w + x;
    if (visited[idx]) return;
    const pi = idx * 4;
    const dr = px[pi] - bgR, dg = px[pi + 1] - bgG, db = px[pi + 2] - bgB;
    if (Math.sqrt(dr * dr + dg * dg + db * db) >= threshold) return;
    visited[idx] = 1;
    stack.push(x, y);
  };
  // Seed from all four edges
  for (let x = 0; x < w; x++) { tryPush(x, 0); tryPush(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { tryPush(0, y); tryPush(w - 1, y); }
  while (stack.length > 0) {
    const sy = stack.pop()!, sx = stack.pop()!;
    px[(sy * w + sx) * 4 + 3] = 0;
    tryPush(sx + 1, sy); tryPush(sx - 1, sy); tryPush(sx, sy + 1); tryPush(sx, sy - 1);
  }

  // Second pass: feather anti-aliased fringe pixels.
  // Any non-visited pixel within a 2-pixel radius of a removed pixel and whose
  // color is somewhat close to the background gets its alpha reduced proportionally.
  // This eliminates the dark halo from anti-aliased edges blending with a black bg.
  const fringeRadius = 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (visited[idx]) continue; // already fully transparent
      // Check if any pixel in the neighborhood was removed
      let bordersRemoved = false;
      outer:
      for (let dy = -fringeRadius; dy <= fringeRadius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -fringeRadius; dx <= fringeRadius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          if (visited[ny * w + nx]) { bordersRemoved = true; break outer; }
        }
      }
      if (!bordersRemoved) continue;

      const pi = idx * 4;
      const dr = px[pi] - bgR, dg = px[pi + 1] - bgG, db = px[pi + 2] - bgB;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist < fringeMax) {
        // Scale alpha: at dist=threshold → mostly transparent, at dist=fringeMax → keep original
        const t = Math.max(0, (dist - threshold) / (fringeMax - threshold));
        px[pi + 3] = Math.round(px[pi + 3] * t);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
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
            // Strip solid background so edge-bleed pixels become transparent
            const img = tex.image as HTMLImageElement;
            const bgCanvas = document.createElement("canvas");
            bgCanvas.width = img.naturalWidth || img.width || 512;
            bgCanvas.height = img.naturalHeight || img.height || 512;
            const bgCtx = bgCanvas.getContext("2d")!;
            bgCtx.drawImage(img, 0, 0, bgCanvas.width, bgCanvas.height);
            removeSolidBackground(bgCanvas);
            const cleanTex = new THREE.CanvasTexture(bgCanvas);
            cleanTex.colorSpace = THREE.SRGBColorSpace;
            cleanTex.flipY = true;
            if (surf.scale !== 1) {
              cleanTex.repeat.set(1 / surf.scale, 1 / surf.scale);
            }
            cleanTex.offset.set(surf.offsetX, surf.offsetY);
            cleanTex.rotation = surf.rotation;
            cleanTex.wrapS = THREE.ClampToEdgeWrapping;
            cleanTex.wrapT = THREE.ClampToEdgeWrapping;
            cleanTex.needsUpdate = true;
            setTextures((prev) => ({ ...prev, [name]: cleanTex }));
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
    case "porsche-911":
      return <Porsche911PanelsModel />;
    case "bmw-x5m":
      return <BmwX5mModel />;
    default:
      return <BoxModel />;
  }
}
