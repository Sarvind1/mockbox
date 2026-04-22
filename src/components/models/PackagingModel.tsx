"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEditorStore } from "@/lib/store";
import { SurfaceTexture } from "@/lib/types";
import { StickerLayer } from "./StickerLayer";



function getMaterialProps(finish: string, color: string) {
  const base = { color };
  switch (finish) {
    case "glossy":
      return { ...base, roughness: 0.1, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1 };
    case "satin":
      return { ...base, roughness: 0.4, metalness: 0.1, clearcoat: 0.3, clearcoatRoughness: 0.4 };
    case "metallic":
      return { ...base, roughness: 0.3, metalness: 0.8 };
    case "pearl":
      return { ...base, roughness: 0.2, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 };
    case "chrome":
      return { ...base, roughness: 0.05, metalness: 1.0 };
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
  const dropHoverZone = useEditorStore((s) => s.dropHoverZone);
  const stickerMode = useEditorStore((s) => s.stickerMode);

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
          emissive: new THREE.Color(
            stickerMode ? "#000000" :
            dropHoverZone === surface ? "#0044ff" :
            activeSurface === surface ? "#1a1a2e" : "#000000"
          ),
          emissiveIntensity: stickerMode ? 0 : dropHoverZone === surface ? 0.5 : activeSurface === surface ? 0.05 : 0,
        });
        mesh.material = newMat;

        // Make mesh clickable — pick the first plausible surface
        mesh.userData.surface = surface;
      }
    });
  }, [clonedScene, baseColor, finish, activeSurface, dropHoverZone, textures, stickerMode]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (e: any) => {
    e.stopPropagation();
    if (stickerMode) return;
    const brushMode = useEditorStore.getState().paintBrushMode;
    if (brushMode === "brush") return;
    if (brushMode === "zone") {
      const surface = (e.object as THREE.Mesh).userData.surface;
      if (surface) {
        const _store = useEditorStore.getState();
        const _prevColor = _store.surfaceTextures[surface]?.color ?? null;
        if (_prevColor !== _store.paintBrushColor) {
          _store.pushZonePaint(surface, _prevColor);
          const _newTex = { ..._store.surfaceTextures };
          _newTex[surface] = { ..._newTex[surface], color: _store.paintBrushColor };
          useEditorStore.setState({ surfaceTextures: _newTex });
        }
      }
      return;
    }
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
// useGLTF.preload("/models/package_box_mockup.glb");

// ---- Bottle Model ----
export function BottleModel() {
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);
  const dropHoverZone = useEditorStore((s) => s.dropHoverZone);
  const stickerMode = useEditorStore((s) => s.stickerMode);

  const matProps = getMaterialProps(finish, baseColor);
  const textures = useLoadedTextures(surfaceTextures);

  return (
    <group>
      {/* Bottle body */}
      <mesh
        position={[0, -0.2, 0]}
        onClick={() => {
          if (stickerMode) return;
          const brushMode = useEditorStore.getState().paintBrushMode;
          if (brushMode === "brush") return;
          if (brushMode === "zone") { const _s = useEditorStore.getState(); const _p = _s.surfaceTextures["body"]?.color ?? null; if (_p !== _s.paintBrushColor) { _s.pushZonePaint("body", _p); const _t = { ..._s.surfaceTextures }; _t["body"] = { ..._t["body"], color: _s.paintBrushColor }; useEditorStore.setState({ surfaceTextures: _t }); } return; }
          setActiveSurface("body");
        }}
        userData={{ surface: "body" }}
      >
        <cylinderGeometry args={[0.4, 0.4, 1.2, 32]} />
        <meshPhysicalMaterial
          {...matProps}
          map={textures["body"] || null}
          emissive={stickerMode ? "#000000" : (dropHoverZone === "body" ? "#0044ff" : activeSurface === "body" ? "#1a1a2e" : "#000000")}
          emissiveIntensity={stickerMode ? 0 : (dropHoverZone === "body" ? 0.5 : activeSurface === "body" ? 0.05 : 0)}
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
        onClick={() => {
          if (stickerMode) return;
          const brushMode = useEditorStore.getState().paintBrushMode;
          if (brushMode === "brush") return;
          if (brushMode === "zone") { const _s = useEditorStore.getState(); const _p = _s.surfaceTextures["cap"]?.color ?? null; if (_p !== _s.paintBrushColor) { _s.pushZonePaint("cap", _p); const _t = { ..._s.surfaceTextures }; _t["cap"] = { ..._t["cap"], color: _s.paintBrushColor }; useEditorStore.setState({ surfaceTextures: _t }); } return; }
          setActiveSurface("cap");
        }}
        userData={{ surface: "cap" }}
      >
        <cylinderGeometry args={[0.17, 0.17, 0.2, 32]} />
        <meshPhysicalMaterial
          color={dropHoverZone === "cap" ? "#aaaaff" : activeSurface === "cap" ? "#555" : "#333"}
          roughness={0.5}
          metalness={0.3}
          map={textures["cap"] || null}
          emissive={stickerMode ? "#000000" : (dropHoverZone === "cap" ? "#0044ff" : "#000000")}
          emissiveIntensity={stickerMode ? 0 : (dropHoverZone === "cap" ? 0.5 : 0)}
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
  const dropHoverZone = useEditorStore((s) => s.dropHoverZone);
  const stickerMode = useEditorStore((s) => s.stickerMode);

  const matProps = getMaterialProps(finish, baseColor);
  const textures = useLoadedTextures(surfaceTextures);

  return (
    <group>
      {/* Can body */}
      <mesh onClick={() => {
          if (stickerMode) return;
          const brushMode = useEditorStore.getState().paintBrushMode;
          if (brushMode === "brush") return;
          if (brushMode === "zone") { const _s = useEditorStore.getState(); const _p = _s.surfaceTextures["body"]?.color ?? null; if (_p !== _s.paintBrushColor) { _s.pushZonePaint("body", _p); const _t = { ..._s.surfaceTextures }; _t["body"] = { ..._t["body"], color: _s.paintBrushColor }; useEditorStore.setState({ surfaceTextures: _t }); } return; }
          setActiveSurface("body");
        }} userData={{ surface: "body" }}>
        <cylinderGeometry args={[0.33, 0.33, 1.2, 32]} />
        <meshPhysicalMaterial
          {...matProps}
          metalness={0.7}
          roughness={0.2}
          map={textures["body"] || null}
          emissive={stickerMode ? "#000000" : (dropHoverZone === "body" ? "#0044ff" : activeSurface === "body" ? "#1a1a2e" : "#000000")}
          emissiveIntensity={stickerMode ? 0 : (dropHoverZone === "body" ? 0.5 : activeSurface === "body" ? 0.05 : 0)}
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
  const dropHoverZone = useEditorStore((s) => s.dropHoverZone);
  const stickerMode = useEditorStore((s) => s.stickerMode);

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
        onClick={() => {
          if (stickerMode) return;
          const brushMode = useEditorStore.getState().paintBrushMode;
          if (brushMode === "brush") return;
          if (brushMode === "zone") { const _s = useEditorStore.getState(); const _p = _s.surfaceTextures["front"]?.color ?? null; if (_p !== _s.paintBrushColor) { _s.pushZonePaint("front", _p); const _t = { ..._s.surfaceTextures }; _t["front"] = { ..._t["front"], color: _s.paintBrushColor }; useEditorStore.setState({ surfaceTextures: _t }); } return; }
          setActiveSurface("front");
        }}
        userData={{ surface: "front" }}
      >
        <shapeGeometry args={[pouchShape]} />
        <meshPhysicalMaterial
          {...matProps}
          map={textures["front"] || null}
          emissive={stickerMode ? "#000000" : (dropHoverZone === "front" ? "#0044ff" : activeSurface === "front" ? "#1a1a2e" : "#000000")}
          emissiveIntensity={stickerMode ? 0 : (dropHoverZone === "front" ? 0.5 : activeSurface === "front" ? 0.05 : 0)}
        />
      </mesh>
      {/* Back */}
      <mesh
        position={[0, 0, -0.08]}
        rotation={[0, Math.PI, 0]}
        onClick={() => {
          if (stickerMode) return;
          const brushMode = useEditorStore.getState().paintBrushMode;
          if (brushMode === "brush") return;
          if (brushMode === "zone") { const _s = useEditorStore.getState(); const _p = _s.surfaceTextures["back"]?.color ?? null; if (_p !== _s.paintBrushColor) { _s.pushZonePaint("back", _p); const _t = { ..._s.surfaceTextures }; _t["back"] = { ..._t["back"], color: _s.paintBrushColor }; useEditorStore.setState({ surfaceTextures: _t }); } return; }
          setActiveSurface("back");
        }}
        userData={{ surface: "back" }}
      >
        <shapeGeometry args={[pouchShape]} />
        <meshPhysicalMaterial
          {...matProps}
          map={textures["back"] || null}
          emissive={stickerMode ? "#000000" : (dropHoverZone === "back" ? "#0044ff" : activeSurface === "back" ? "#1a1a2e" : "#000000")}
          emissiveIntensity={stickerMode ? 0 : (dropHoverZone === "back" ? 0.5 : activeSurface === "back" ? 0.05 : 0)}
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
  const dropHoverZone = useEditorStore((s) => s.dropHoverZone);
  const stickerMode = useEditorStore((s) => s.stickerMode);

  const matProps = getMaterialProps(finish, baseColor);
  const textures = useLoadedTextures(surfaceTextures);

  return (
    <group>
      {/* Tube body */}
      <mesh
        position={[0, -0.1, 0]}
        onClick={() => {
          if (stickerMode) return;
          const brushMode = useEditorStore.getState().paintBrushMode;
          if (brushMode === "brush") return;
          if (brushMode === "zone") { const _s = useEditorStore.getState(); const _p = _s.surfaceTextures["body"]?.color ?? null; if (_p !== _s.paintBrushColor) { _s.pushZonePaint("body", _p); const _t = { ..._s.surfaceTextures }; _t["body"] = { ..._t["body"], color: _s.paintBrushColor }; useEditorStore.setState({ surfaceTextures: _t }); } return; }
          setActiveSurface("body");
        }}
        userData={{ surface: "body" }}
      >
        <cylinderGeometry args={[0.2, 0.25, 1.0, 32]} />
        <meshPhysicalMaterial
          {...matProps}
          map={textures["body"] || null}
          emissive={stickerMode ? "#000000" : (dropHoverZone === "body" ? "#0044ff" : activeSurface === "body" ? "#1a1a2e" : "#000000")}
          emissiveIntensity={stickerMode ? 0 : (dropHoverZone === "body" ? 0.5 : activeSurface === "body" ? 0.05 : 0)}
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
        onClick={() => {
          if (stickerMode) return;
          const brushMode = useEditorStore.getState().paintBrushMode;
          if (brushMode === "brush") return;
          if (brushMode === "zone") { const _s = useEditorStore.getState(); const _p = _s.surfaceTextures["cap"]?.color ?? null; if (_p !== _s.paintBrushColor) { _s.pushZonePaint("cap", _p); const _t = { ..._s.surfaceTextures }; _t["cap"] = { ..._t["cap"], color: _s.paintBrushColor }; useEditorStore.setState({ surfaceTextures: _t }); } return; }
          setActiveSurface("cap");
        }}
        userData={{ surface: "cap" }}
      >
        <cylinderGeometry args={[0.12, 0.15, 0.15, 32]} />
        <meshPhysicalMaterial
          color={dropHoverZone === "cap" ? "#aaaaff" : activeSurface === "cap" ? "#555" : "#333"}
          roughness={0.4}
          metalness={0.2}
          map={textures["cap"] || null}
          emissive={stickerMode ? "#000000" : (dropHoverZone === "cap" ? "#0044ff" : "#000000")}
          emissiveIntensity={stickerMode ? 0 : (dropHoverZone === "cap" ? 0.5 : 0)}
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
  const dropHoverZone = useEditorStore((s) => s.dropHoverZone);
  const stickerMode = useEditorStore((s) => s.stickerMode);

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
            emissive: new THREE.Color(
              stickerMode ? "#000000" :
              dropHoverZone === "sleeve" ? "#0044ff" :
              activeSurface === "sleeve" ? "#1a1a2e" : "#000000"
            ),
            emissiveIntensity: stickerMode ? 0 : dropHoverZone === "sleeve" ? 0.5 : activeSurface === "sleeve" ? 0.05 : 0,
          });
          mesh.material = sleeveMat;
        } else {
          const bodyMat = new THREE.MeshPhysicalMaterial({
            ...matProps,
            map: textures["body"] || origMat.map || null,
            normalMap: origMat.normalMap || null,
            emissive: new THREE.Color(
              stickerMode ? "#000000" :
              dropHoverZone === "body" ? "#0044ff" :
              activeSurface === "body" ? "#1a1a2e" : "#000000"
            ),
            emissiveIntensity: stickerMode ? 0 : dropHoverZone === "body" ? 0.5 : activeSurface === "body" ? 0.05 : 0,
          });
          mesh.material = bodyMat;
        }

        mesh.userData.surface = surface;
      }
    });
  }, [clonedScene, baseColor, finish, activeSurface, dropHoverZone, textures, stickerMode]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (e: any) => {
    e.stopPropagation();
    if (stickerMode) return;
    const brushMode = useEditorStore.getState().paintBrushMode;
    if (brushMode === "brush") return;
    if (brushMode === "zone") {
      const surface = (e.object as THREE.Mesh).userData.surface;
      if (surface) {
        const _store = useEditorStore.getState();
        const _prevColor = _store.surfaceTextures[surface]?.color ?? null;
        if (_prevColor !== _store.paintBrushColor) {
          _store.pushZonePaint(surface, _prevColor);
          const _newTex = { ..._store.surfaceTextures };
          _newTex[surface] = { ..._newTex[surface], color: _store.paintBrushColor };
          useEditorStore.setState({ surfaceTextures: _newTex });
        }
      }
      return;
    }
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
// useGLTF.preload("/models/coffee_shop_cup.glb");

// ---- Dodge Charger SRT8 (GLB) — per-zone mesh objects ----
export function CarSedanModel() {
  const { scene } = useGLTF("/models/dodge_charger_panels.glb");
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const selectedZoneIds = useEditorStore((s) => s.selectedZoneIds);
  const toggleZoneInSelection = useEditorStore((s) => s.toggleZoneInSelection);
  const multiSelectMode = useEditorStore((s) => s.multiSelectMode);
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);
  const dropHoverZone = useEditorStore((s) => s.dropHoverZone);
  const stickerMode = useEditorStore((s) => s.stickerMode);
  const textures = useLoadedTextures(surfaceTextures);
  const compositeCacheRef = useRef<Map<string, THREE.CanvasTexture>>(new Map());

  const clonedScene = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const matName = (mesh.material as THREE.Material).name;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((mesh.material as any).transmission > 0) {
        mesh.material = new THREE.MeshPhysicalMaterial({ color: "#aaccff", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.25 });
      } else if (matName === "carpaint") {
        mesh.userData.surface = mesh.name;
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

      let mapTex: THREE.Texture | null = rawTex;
      if (rawTex) {
        const effectiveBg = surf?.color ?? baseColor;
        const key = `${surf?.imageUrl}:${effectiveBg}`;
        if (!compositeCache.has(key)) {
          const img = rawTex.image as HTMLImageElement | HTMLCanvasElement;
          const w = (img as HTMLImageElement).naturalWidth || img.width || 512;
          const h = (img as HTMLImageElement).naturalHeight || img.height || 512;
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = effectiveBg;
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const ct = new THREE.CanvasTexture(canvas);
          ct.colorSpace = THREE.SRGBColorSpace;
          ct.flipY = rawTex.flipY;
          ct.wrapS = rawTex.wrapS; ct.wrapT = rawTex.wrapT;
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
        emissive: new THREE.Color(
          stickerMode ? "#000000" :
          dropHoverZone === zoneName ? "#0044ff" :
          !hasTexture && isActive ? "#ff3300" :
          !hasTexture && isSelected ? "#cc2200" : "#000000"
        ),
        emissiveIntensity: stickerMode ? 0 :
          dropHoverZone === zoneName ? 0.5 :
          !hasTexture && isActive ? 0.45 :
          !hasTexture && isSelected ? 0.32 : 0,
      });
    });
  }, [clonedScene, baseColor, finish, activeSurface, selectedZoneIds, textures, surfaceTextures, dropHoverZone, stickerMode]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (e: any) => {
    e.stopPropagation();
    if (stickerMode) return;
    const brushMode = useEditorStore.getState().paintBrushMode;
    if (brushMode === "brush") return;
    const mesh = e.object as THREE.Mesh;
    const zone = mesh.userData.surface as string | undefined;
    if (!zone) return;
    if (brushMode === "zone") {
      const _store = useEditorStore.getState();
      const _prevColor = _store.surfaceTextures[zone]?.color ?? null;
      if (_prevColor !== _store.paintBrushColor) {
        _store.pushZonePaint(zone, _prevColor);
        const _newTex = { ..._store.surfaceTextures };
        _newTex[zone] = { ..._newTex[zone], color: _store.paintBrushColor };
        useEditorStore.setState({ surfaceTextures: _newTex });
      }
      return;
    }
    if (multiSelectMode || e.nativeEvent?.shiftKey) {
      toggleZoneInSelection(zone);
    } else if (activeSurface === zone && selectedZoneIds.length === 1) {
      setActiveSurface("body");
    } else {
      setActiveSurface(zone);
    }
  };

  return (
    <>
      <group scale={[35, 35, 35]} position={[0, -0.45, 0]}>
        <primitive object={clonedScene} onClick={handleClick} />
      </group>
      <StickerLayer parentScene={clonedScene} />
    </>
  );
}
// Vehicle GLBs are large — skip eager preload to avoid WebGL context loss
// useGLTF.preload("/models/dodge_charger_panels.glb");

// ---- Dodge Challenger SRT Hellcat (GLB) — per-zone mesh objects ----
export function CarVanModel() {
  const { scene } = useGLTF("/models/dodge_challenger_panels.glb");
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const selectedZoneIds = useEditorStore((s) => s.selectedZoneIds);
  const toggleZoneInSelection = useEditorStore((s) => s.toggleZoneInSelection);
  const multiSelectMode = useEditorStore((s) => s.multiSelectMode);
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);
  const dropHoverZone = useEditorStore((s) => s.dropHoverZone);
  const stickerMode = useEditorStore((s) => s.stickerMode);
  const textures = useLoadedTextures(surfaceTextures);
  const compositeCacheRef = useRef<Map<string, THREE.CanvasTexture>>(new Map());

  const clonedScene = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const matName = (mesh.material as THREE.Material).name;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((mesh.material as any).transmission > 0) {
        mesh.material = new THREE.MeshPhysicalMaterial({ color: "#aaccff", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.25 });
      } else if (matName === "carpaint") {
        mesh.userData.surface = mesh.name;
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

      let mapTex: THREE.Texture | null = rawTex;
      if (rawTex) {
        const effectiveBg = surf?.color ?? baseColor;
        const key = `${surf?.imageUrl}:${effectiveBg}`;
        if (!compositeCache.has(key)) {
          const img = rawTex.image as HTMLImageElement | HTMLCanvasElement;
          const w = (img as HTMLImageElement).naturalWidth || img.width || 512;
          const h = (img as HTMLImageElement).naturalHeight || img.height || 512;
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = effectiveBg;
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const ct = new THREE.CanvasTexture(canvas);
          ct.colorSpace = THREE.SRGBColorSpace;
          ct.flipY = rawTex.flipY;
          ct.wrapS = rawTex.wrapS; ct.wrapT = rawTex.wrapT;
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
        emissive: new THREE.Color(
          stickerMode ? "#000000" :
          dropHoverZone === zoneName ? "#0044ff" :
          !hasTexture && isActive ? "#ff3300" :
          !hasTexture && isSelected ? "#cc2200" : "#000000"
        ),
        emissiveIntensity: stickerMode ? 0 :
          dropHoverZone === zoneName ? 0.5 :
          !hasTexture && isActive ? 0.45 :
          !hasTexture && isSelected ? 0.32 : 0,
      });
    });
  }, [clonedScene, baseColor, finish, activeSurface, selectedZoneIds, textures, surfaceTextures, dropHoverZone, stickerMode]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (e: any) => {
    e.stopPropagation();
    if (stickerMode) return;
    const brushMode = useEditorStore.getState().paintBrushMode;
    if (brushMode === "brush") return;
    const mesh = e.object as THREE.Mesh;
    const zone = mesh.userData.surface as string | undefined;
    if (!zone) return;
    if (brushMode === "zone") {
      const _store = useEditorStore.getState();
      const _prevColor = _store.surfaceTextures[zone]?.color ?? null;
      if (_prevColor !== _store.paintBrushColor) {
        _store.pushZonePaint(zone, _prevColor);
        const _newTex = { ..._store.surfaceTextures };
        _newTex[zone] = { ..._newTex[zone], color: _store.paintBrushColor };
        useEditorStore.setState({ surfaceTextures: _newTex });
      }
      return;
    }
    if (multiSelectMode || e.nativeEvent?.shiftKey) {
      toggleZoneInSelection(zone);
    } else if (activeSurface === zone && selectedZoneIds.length === 1) {
      setActiveSurface("body");
    } else {
      setActiveSurface(zone);
    }
  };

  return (
    <>
      <group scale={[0.35, 0.35, 0.35]} position={[0, -0.45, 0]}>
        <primitive object={clonedScene} onClick={handleClick} />
      </group>
      <StickerLayer parentScene={clonedScene} />
    </>
  );
}
// useGLTF.preload("/models/dodge_challenger_panels.glb");

// ---- Porsche 911 Targa 4S (GLB) ----
export function Porsche911Model() {
  const { scene } = useGLTF("/models/porsche_911.glb");
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);
  const dropHoverZone = useEditorStore((s) => s.dropHoverZone);
  const stickerMode = useEditorStore((s) => s.stickerMode);
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
          emissive: new THREE.Color(
            stickerMode ? "#000000" :
            dropHoverZone === "body" ? "#0044ff" :
            activeSurface === "body" ? "#1a1a2e" : "#000000"
          ),
          emissiveIntensity: stickerMode ? 0 : dropHoverZone === "body" ? 0.5 : activeSurface === "body" ? 0.05 : 0,
        });
        mesh.userData.surface = "body";
      }
    });
  }, [clonedScene, baseColor, finish, activeSurface, dropHoverZone, textures, stickerMode]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (e: any) => {
    e.stopPropagation();
    if (stickerMode) return;
    const brushMode = useEditorStore.getState().paintBrushMode;
    if (brushMode === "brush") return;
    if (brushMode === "zone") {
      const surface = (e.object as THREE.Mesh).userData.surface;
      if (surface) {
        const _store = useEditorStore.getState();
        const _prevColor = _store.surfaceTextures[surface]?.color ?? null;
        if (_prevColor !== _store.paintBrushColor) {
          _store.pushZonePaint(surface, _prevColor);
          const _newTex = { ..._store.surfaceTextures };
          _newTex[surface] = { ..._newTex[surface], color: _store.paintBrushColor };
          useEditorStore.setState({ surfaceTextures: _newTex });
        }
      }
      return;
    }
    const mesh = e.object as THREE.Mesh;
    if (mesh.userData.surface) setActiveSurface(mesh.userData.surface);
  };

  return (
    <>
      <group scale={[0.015, 0.015, 0.015]} position={[0, -0.45, 0]}>
        <primitive object={clonedScene} onClick={handleClick} />
      </group>
      <StickerLayer parentScene={clonedScene} />
    </>
  );
}
// useGLTF.preload("/models/porsche_911.glb");

// ---- Porsche 911 Targa 4S (GLB) with canvas panel zones ----
export function Porsche911PanelsModel() {
  const { scene } = useGLTF("/models/porsche_911_panels.glb");
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const selectedZoneIds = useEditorStore((s) => s.selectedZoneIds);
  const toggleZoneInSelection = useEditorStore((s) => s.toggleZoneInSelection);
  const multiSelectMode = useEditorStore((s) => s.multiSelectMode);
  const stickerMode = useEditorStore((s) => s.stickerMode);
  const singlePaste = useEditorStore((s) => s.singlePaste);
  const singlePasteGroups = useEditorStore((s) => s.singlePasteGroups);
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);
  const dropHoverZone = useEditorStore((s) => s.dropHoverZone);
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
      } else if ((mesh.material as THREE.Material).name === "PAINT_COLOR_4" || (mesh.material as THREE.Material).name === "carpaint") {
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
        emissive: new THREE.Color(
          stickerMode ? "#000000" :
          dropHoverZone === zoneName ? "#0044ff" :
          !hasTexture && isActive ? "#ff3300" :
          !hasTexture && isSelected ? "#cc2200" : "#000000"
        ),
        emissiveIntensity: stickerMode ? 0 :
          dropHoverZone === zoneName ? 0.5 :
          !hasTexture && isActive ? 0.45 :
          !hasTexture && isSelected ? 0.32 : 0,
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
  }, [clonedScene, baseColor, finish, activeSurface, selectedZoneIds, singlePaste, singlePasteGroups, textures, surfaceTextures, dropHoverZone, stickerMode]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (e: any) => {
    e.stopPropagation();
    if (stickerMode) return;
    const brushMode = useEditorStore.getState().paintBrushMode;
    if (brushMode === "brush") return;
    const mesh = e.object as THREE.Mesh;
    const zone = mesh.userData.surface as string | undefined;
    if (!zone) return;
    if (brushMode === "zone") {
      const _store = useEditorStore.getState();
      const _prevColor = _store.surfaceTextures[zone]?.color ?? null;
      if (_prevColor !== _store.paintBrushColor) {
        _store.pushZonePaint(zone, _prevColor);
        const _newTex = { ..._store.surfaceTextures };
        _newTex[zone] = { ..._newTex[zone], color: _store.paintBrushColor };
        useEditorStore.setState({ surfaceTextures: _newTex });
      }
      return;
    }
    if (multiSelectMode || e.nativeEvent?.shiftKey) {
      toggleZoneInSelection(zone);
    } else if (activeSurface === zone && selectedZoneIds.length === 1) {
      setActiveSurface("body");
    } else {
      setActiveSurface(zone);
    }
  };

  return (
    <>
      <group scale={[0.015, 0.015, 0.015]} position={[0, -0.45, 0]}>
        <primitive object={clonedScene} onClick={handleClick} />
      </group>
      <StickerLayer parentScene={clonedScene} />
    </>
  );
}
// useGLTF.preload("/models/porsche_911_panels.glb");

// ---- BMW X5M 2016 (GLB) — per-zone mesh objects (same pattern as Porsche 911) ----
export function BmwX5mModel() {
  const { scene } = useGLTF("/models/bmw_x5m_panels.glb");
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const selectedZoneIds = useEditorStore((s) => s.selectedZoneIds);
  const toggleZoneInSelection = useEditorStore((s) => s.toggleZoneInSelection);
  const multiSelectMode = useEditorStore((s) => s.multiSelectMode);
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);
  const dropHoverZone = useEditorStore((s) => s.dropHoverZone);
  const stickerMode = useEditorStore((s) => s.stickerMode);
  const textures = useLoadedTextures(surfaceTextures);
  const compositeCacheRef = useRef<Map<string, THREE.CanvasTexture>>(new Map());

  const clonedScene = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const matName = (mesh.material as THREE.Material).name;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((mesh.material as any).transmission > 0) {
        mesh.material = new THREE.MeshPhysicalMaterial({
          color: "#aaccff", roughness: 0.05, metalness: 0,
          transparent: true, opacity: 0.25,
        });
      } else if (matName === "carpaint") {
        // Zone mesh objects are named by zone (hood, roof, door_l, etc.)
        mesh.userData.surface = mesh.name;
      }
    });
    return cloned;
  }, [scene]);

  // Apply per-zone materials (same approach as Porsche911PanelsModel)
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
        emissive: new THREE.Color(
          stickerMode ? "#000000" :
          dropHoverZone === zoneName ? "#0044ff" :
          !hasTexture && isActive ? "#ff3300" :
          !hasTexture && isSelected ? "#cc2200" : "#000000"
        ),
        emissiveIntensity: stickerMode ? 0 :
          dropHoverZone === zoneName ? 0.5 :
          !hasTexture && isActive ? 0.45 :
          !hasTexture && isSelected ? 0.32 : 0,
      });
    });
  }, [clonedScene, baseColor, finish, activeSurface, selectedZoneIds, textures, surfaceTextures, dropHoverZone, stickerMode]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (e: any) => {
    e.stopPropagation();
    if (stickerMode) return;
    const brushMode = useEditorStore.getState().paintBrushMode;
    if (brushMode === "brush") return;
    const mesh = e.object as THREE.Mesh;
    const zone = mesh.userData.surface as string | undefined;
    if (!zone) return;
    if (brushMode === "zone") {
      const _store = useEditorStore.getState();
      const _prevColor = _store.surfaceTextures[zone]?.color ?? null;
      if (_prevColor !== _store.paintBrushColor) {
        _store.pushZonePaint(zone, _prevColor);
        const _newTex = { ..._store.surfaceTextures };
        _newTex[zone] = { ..._newTex[zone], color: _store.paintBrushColor };
        useEditorStore.setState({ surfaceTextures: _newTex });
      }
      return;
    }
    if (multiSelectMode || e.nativeEvent?.shiftKey) {
      toggleZoneInSelection(zone);
    } else if (activeSurface === zone && selectedZoneIds.length === 1) {
      setActiveSurface("body");
    } else {
      setActiveSurface(zone);
    }
  };

  return (
    <>
      <group scale={[35, 35, 35]} position={[0, -0.45, 0]}>
        <primitive object={clonedScene} onClick={handleClick} />
      </group>
      <StickerLayer parentScene={clonedScene} />
    </>
  );
}
// useGLTF.preload("/models/bmw_x5m_panels.glb");

// ---- Toyota Fortuner 2021 (GLB) — per-zone mesh objects ----
export function ToyotaFortunerModel() {
  const { scene } = useGLTF("/models/toyota_fortuner_2021_panels.glb");
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const selectedZoneIds = useEditorStore((s) => s.selectedZoneIds);
  const toggleZoneInSelection = useEditorStore((s) => s.toggleZoneInSelection);
  const multiSelectMode = useEditorStore((s) => s.multiSelectMode);
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);
  const dropHoverZone = useEditorStore((s) => s.dropHoverZone);
  const stickerMode = useEditorStore((s) => s.stickerMode);
  const textures = useLoadedTextures(surfaceTextures);
  const compositeCacheRef = useRef<Map<string, THREE.CanvasTexture>>(new Map());

  const clonedScene = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const matName = (mesh.material as THREE.Material).name;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((mesh.material as any).transmission > 0) {
        mesh.material = new THREE.MeshPhysicalMaterial({
          color: "#aaccff", roughness: 0.05, metalness: 0,
          transparent: true, opacity: 0.25,
        });
      } else if (matName === "carpaint") {
        mesh.userData.surface = mesh.name;
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
        emissive: new THREE.Color(
          stickerMode ? "#000000" :
          dropHoverZone === zoneName ? "#0044ff" :
          !hasTexture && isActive ? "#ff3300" :
          !hasTexture && isSelected ? "#cc2200" : "#000000"
        ),
        emissiveIntensity: stickerMode ? 0 :
          dropHoverZone === zoneName ? 0.5 :
          !hasTexture && isActive ? 0.45 :
          !hasTexture && isSelected ? 0.32 : 0,
      });
    });
  }, [clonedScene, baseColor, finish, activeSurface, selectedZoneIds, textures, surfaceTextures, dropHoverZone, stickerMode]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (e: any) => {
    e.stopPropagation();
    if (stickerMode) return;
    const brushMode = useEditorStore.getState().paintBrushMode;
    if (brushMode === "brush") return;
    const mesh = e.object as THREE.Mesh;
    const zone = mesh.userData.surface as string | undefined;
    if (!zone) return;
    if (brushMode === "zone") {
      const _store = useEditorStore.getState();
      const _prevColor = _store.surfaceTextures[zone]?.color ?? null;
      if (_prevColor !== _store.paintBrushColor) {
        _store.pushZonePaint(zone, _prevColor);
        const _newTex = { ..._store.surfaceTextures };
        _newTex[zone] = { ..._newTex[zone], color: _store.paintBrushColor };
        useEditorStore.setState({ surfaceTextures: _newTex });
      }
      return;
    }
    if (multiSelectMode || e.nativeEvent?.shiftKey) {
      toggleZoneInSelection(zone);
    } else if (activeSurface === zone && selectedZoneIds.length === 1) {
      setActiveSurface("body");
    } else {
      setActiveSurface(zone);
    }
  };

  return (
    <>
      <group scale={[0.5, 0.5, 0.5]} position={[0, -0.45, 0]}>
        <primitive object={clonedScene} onClick={handleClick} />
      </group>
      <StickerLayer parentScene={clonedScene} />
    </>
  );
}
// useGLTF.preload("/models/toyota_fortuner_2021_panels.glb");

// ---- BMW X3 M40i (GLB) — per-zone mesh objects ----
export function BmwX3M40iModel() {
  const { scene } = useGLTF("/models/bmw_x3_m40i_panels.glb");
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const selectedZoneIds = useEditorStore((s) => s.selectedZoneIds);
  const toggleZoneInSelection = useEditorStore((s) => s.toggleZoneInSelection);
  const multiSelectMode = useEditorStore((s) => s.multiSelectMode);
  const baseColor = useEditorStore((s) => s.baseColor);
  const finish = useEditorStore((s) => s.finish);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);
  const dropHoverZone = useEditorStore((s) => s.dropHoverZone);
  const stickerMode = useEditorStore((s) => s.stickerMode);
  const paintBrushMode = useEditorStore((s) => s.paintBrushMode);
  const paintBrushColor = useEditorStore((s) => s.paintBrushColor);
  const textures = useLoadedTextures(surfaceTextures);
  const compositeCacheRef = useRef<Map<string, THREE.CanvasTexture>>(new Map());

  const clonedScene = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const matName = (mesh.material as THREE.Material).name;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((mesh.material as any).transmission > 0) {
        mesh.material = new THREE.MeshPhysicalMaterial({
          color: "#aaccff", roughness: 0.05, metalness: 0,
          transparent: true, opacity: 0.25,
        });
      } else if (matName === "carpaint") {
        mesh.userData.surface = mesh.name;
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
        emissive: new THREE.Color(
          stickerMode ? "#000000" :
          dropHoverZone === zoneName ? "#0044ff" :
          !hasTexture && isActive ? "#ff3300" :
          !hasTexture && isSelected ? "#cc2200" : "#000000"
        ),
        emissiveIntensity: stickerMode ? 0 :
          dropHoverZone === zoneName ? 0.5 :
          !hasTexture && isActive ? 0.45 :
          !hasTexture && isSelected ? 0.32 : 0,
      });
    });
  }, [clonedScene, baseColor, finish, activeSurface, selectedZoneIds, textures, surfaceTextures, dropHoverZone, stickerMode]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (e: any) => {
    e.stopPropagation();
    if (stickerMode) return;
    const brushMode = useEditorStore.getState().paintBrushMode;
    if (brushMode === "brush") return;
    const mesh = e.object as THREE.Mesh;
    const zone = mesh.userData.surface as string | undefined;
    if (!zone) return;
    if (brushMode === "zone") {
      const _store = useEditorStore.getState();
      const _prevColor = _store.surfaceTextures[zone]?.color ?? null;
      if (_prevColor !== paintBrushColor) {
        _store.pushZonePaint(zone, _prevColor);
        const _newTex = { ..._store.surfaceTextures };
        _newTex[zone] = { ..._newTex[zone], color: paintBrushColor };
        useEditorStore.setState({ surfaceTextures: _newTex });
      }
      return;
    }
    if (multiSelectMode || e.nativeEvent?.shiftKey) {
      toggleZoneInSelection(zone);
    } else if (activeSurface === zone && selectedZoneIds.length === 1) {
      setActiveSurface("body");
    } else {
      setActiveSurface(zone);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBrushDrag = (e: any) => {
    if (paintBrushMode !== "zone" || !(e.buttons & 1)) return;
    e.stopPropagation();
    const mesh = e.object as THREE.Mesh;
    const zone = mesh.userData.surface as string | undefined;
    if (zone) {
      const _store = useEditorStore.getState();
      const _prevColor = _store.surfaceTextures[zone]?.color ?? null;
      if (_prevColor !== paintBrushColor) {
        _store.pushZonePaint(zone, _prevColor);
        const _newTex = { ..._store.surfaceTextures };
        _newTex[zone] = { ..._newTex[zone], color: paintBrushColor };
        useEditorStore.setState({ surfaceTextures: _newTex });
      }
    }
  };

  return (
    <>
      <group scale={[0.7, 0.7, 0.7]} position={[0, -0.45, 0]}>
        <primitive object={clonedScene} onClick={handleClick} onPointerMove={handleBrushDrag} />
      </group>
      <StickerLayer parentScene={clonedScene} />
    </>
  );
}
// useGLTF.preload("/models/bmw_x3_m40i_panels.glb");

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
            // Skip background removal for pattern presets that are meant to tile
            const isPattern = url.startsWith("/presets/") &&
              ["carbon", "check", "stripe", "dots"].some(p => url.includes(p));
            if (!isPattern) {
              removeSolidBackground(bgCanvas);
            }
            const cleanTex = new THREE.CanvasTexture(bgCanvas);
            cleanTex.colorSpace = THREE.SRGBColorSpace;
            cleanTex.flipY = true;
            if (surf.scale !== 1) {
              cleanTex.repeat.set(1 / surf.scale, 1 / surf.scale);
            }
            cleanTex.offset.set(surf.offsetX, surf.offsetY);
            cleanTex.rotation = surf.rotation;
            cleanTex.wrapS = THREE.RepeatWrapping;
            cleanTex.wrapT = THREE.RepeatWrapping;
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

function ModelInner({ templateId }: { templateId: string }) {
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
    case "toyota-fortuner":
      return <ToyotaFortunerModel />;
    case "bmw-x3-m40i":
      return <BmwX3M40iModel />;
    default:
      return <BoxModel />;
  }
}

export function PackagingModelSwitch({
  templateId,
}: {
  templateId: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const selectedZoneIds = useEditorStore((s) => s.selectedZoneIds);
  const stickerMode = useEditorStore((s) => s.stickerMode);
  const paintBrushMode = useEditorStore((s) => s.paintBrushMode);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);
  const baseColor = useEditorStore((s) => s.baseColor);
  const brushAction = useEditorStore((s) => s.brushAction);
  const _baseCol = useMemo(() => new THREE.Color(baseColor), [baseColor]);
  const _tmpCol = useMemo(() => new THREE.Color(), []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controls = useThree((s) => s.controls) as any;
  const camera = useThree((s) => s.camera);

  // ── Canvas UV painting refs ──────────────────────────────────────────────
  const BRUSH_CANVAS_SIZE = 1024;
  const brushCanvasMap = useRef<Map<string, { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture }>>(new Map());
  const overlayMeshes = useRef<Map<string, THREE.Mesh>>(new Map());
  const lastUV = useRef<{ u: number; v: number; meshName: string } | null>(null);
  const brushUndoStack = useRef<Array<{ meshName: string; imageData: ImageData }>>([]);
  const isPainting = useRef(false);

  // Get or create a brush canvas + texture for a mesh
  const getBrushCanvas = (meshName: string) => {
    if (brushCanvasMap.current.has(meshName)) {
      return brushCanvasMap.current.get(meshName)!;
    }
    const canvas = document.createElement("canvas");
    canvas.width = BRUSH_CANVAS_SIZE;
    canvas.height = BRUSH_CANVAS_SIZE;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, BRUSH_CANVAS_SIZE, BRUSH_CANVAS_SIZE);
    const texture = new THREE.CanvasTexture(canvas);
    texture.flipY = true;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    const entry = { canvas, ctx, texture };
    brushCanvasMap.current.set(meshName, entry);
    return entry;
  };

  // Paint a stroke segment on the UV canvas
  const paintStroke = (meshName: string, u: number, v: number, brushColor: string) => {
    const { ctx, texture } = getBrushCanvas(meshName);
    const px = u * BRUSH_CANVAS_SIZE;
    const py = (1 - v) * BRUSH_CANVAS_SIZE; // UV Y is flipped vs canvas Y
    const brushSize = useEditorStore.getState().paintBrushSize;
    const radius = BRUSH_CANVAS_SIZE * 0.02 * brushSize; // ~20px at size 1

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = brushColor;

    // Interpolate between previous and current point for smooth strokes
    if (lastUV.current && lastUV.current.meshName === meshName) {
      const prevPx = lastUV.current.u * BRUSH_CANVAS_SIZE;
      const prevPy = (1 - lastUV.current.v) * BRUSH_CANVAS_SIZE;
      const dist = Math.hypot(px - prevPx, py - prevPy);
      const steps = Math.max(1, Math.ceil(dist / (radius * 0.3)));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const ix = prevPx + (px - prevPx) * t;
        const iy = prevPy + (py - prevPy) * t;
        ctx.beginPath();
        ctx.arc(ix, iy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Single dot
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    lastUV.current = { u, v, meshName };
    texture.needsUpdate = true;
  };

  // Save snapshot for undo (called on pointerdown before starting a stroke)
  const saveBrushSnapshot = (meshName: string) => {
    const entry = brushCanvasMap.current.get(meshName);
    if (!entry) return;
    const imageData = entry.ctx.getImageData(0, 0, BRUSH_CANVAS_SIZE, BRUSH_CANVAS_SIZE);
    brushUndoStack.current.push({ meshName, imageData });
    // Cap at 20 snapshots (~80MB worst-case)
    if (brushUndoStack.current.length > 20) {
      brushUndoStack.current.shift();
    }
  };

  // Create an overlay mesh for the brush texture on a given source mesh
  const ensureOverlay = (sourceMesh: THREE.Mesh, meshName: string) => {
    if (overlayMeshes.current.has(meshName)) return;
    const { texture } = getBrushCanvas(meshName);
    const overlay = new THREE.Mesh(
      sourceMesh.geometry, // Share geometry — do NOT clone
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        side: THREE.FrontSide,
      }),
    );
    overlay.renderOrder = 5;
    // Parent to the same parent so transforms match
    if (sourceMesh.parent) {
      sourceMesh.parent.add(overlay);
      overlay.position.copy(sourceMesh.position);
      overlay.rotation.copy(sourceMesh.rotation);
      overlay.scale.copy(sourceMesh.scale);
    }
    overlayMeshes.current.set(meshName, overlay);
  };

  // Teardown: remove all overlays, dispose materials (NOT geometry), clear maps
  const teardownBrushSystem = () => {
    overlayMeshes.current.forEach((mesh) => {
      mesh.parent?.remove(mesh);
      (mesh.material as THREE.Material).dispose();
    });
    overlayMeshes.current.clear();
    brushCanvasMap.current.forEach(({ texture }) => texture.dispose());
    brushCanvasMap.current.clear();
    brushUndoStack.current = [];
    lastUV.current = null;
    isPainting.current = false;
  };

  // Clean up when template changes (ModelInner swaps but this component stays mounted)
  useEffect(() => {
    return () => teardownBrushSystem();
  }, [templateId]);

  // Handle brush action signals from the store (undo / clear)
  useEffect(() => {
    if (!brushAction) return;
    if (brushAction === "undo") {
      const snapshot = brushUndoStack.current.pop();
      if (snapshot) {
        const entry = brushCanvasMap.current.get(snapshot.meshName);
        if (entry) {
          entry.ctx.putImageData(snapshot.imageData, 0, 0);
          entry.texture.needsUpdate = true;
        }
      }
    } else if (brushAction === "clear") {
      teardownBrushSystem();
    }
    // Reset the action signal
    useEditorStore.setState({ brushAction: null });
  }, [brushAction]);

  // ── useFrame for zone selection pulse (unchanged) ────────────────────────
  useFrame(({ clock }) => {
    if (!groupRef.current || stickerMode || selectedZoneIds.length === 0) return;
    const t = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 3);
    groupRef.current.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshPhysicalMaterial;
      if (!mat || !mesh.userData.surface) return;
      const zoneName = mesh.userData.surface as string;
      const isSelected = selectedZoneIds.includes(zoneName);
      const customColor = surfaceTextures[zoneName]?.color;
      if (isSelected && customColor) {
        _tmpCol.set(customColor);
        _tmpCol.lerp(_baseCol, t * 0.4);
        mat.color.copy(_tmpCol);
        mat.emissive.setRGB(0, 0, 0);
        mat.emissiveIntensity = 0;
      }
    });
  });

  // Check if surface is at a grazing angle (>75°) to the camera — skip painting if so
  const isGrazingAngle = (e: { point?: THREE.Vector3; face?: THREE.Face; object?: THREE.Object3D }) => {
    if (!e.point || !e.face || !e.object) return true;
    const worldNormal = e.face.normal.clone();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(e.object.matrixWorld);
    worldNormal.applyMatrix3(normalMatrix).normalize();
    const viewDir = camera.position.clone().sub(e.point).normalize();
    const dot = worldNormal.dot(viewDir);
    return dot < 0.26; // cos(75°) ≈ 0.259
  };

  // ── Brush event handlers ─────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBrushClick = (e: any) => {
    if (paintBrushMode !== "brush") return;
    e.stopPropagation();
    isPainting.current = true;

    if (!e.uv || !e.object) return;
    if (isGrazingAngle(e)) return;
    const meshName = e.object.userData?.surface || e.object.name || "";
    if (!meshName) return;

    // Save undo snapshot at start of stroke
    saveBrushSnapshot(meshName);

    const color = useEditorStore.getState().paintBrushColor;
    lastUV.current = null; // Reset so first point is a dot
    paintStroke(meshName, e.uv.x, e.uv.y, color);

    // Create overlay mesh lazily on first paint
    ensureOverlay(e.object as THREE.Mesh, meshName);

    // eslint-disable-next-line react-hooks/immutability
    if (controls) controls.enabled = false; // Three.js controls mutation — intentional
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBrushDrag = (e: any) => {
    if (paintBrushMode !== "brush" || !isPainting.current || !(e.buttons & 1)) return;
    e.stopPropagation();

    if (!e.uv || !e.object) return;
    if (isGrazingAngle(e)) return;
    const meshName = e.object.userData?.surface || e.object.name || "";
    if (!meshName) return;

    const color = useEditorStore.getState().paintBrushColor;
    paintStroke(meshName, e.uv.x, e.uv.y, color);

    // Ensure overlay exists (may have moved to a new mesh mid-stroke)
    ensureOverlay(e.object as THREE.Mesh, meshName);
  };

  const handleBrushUp = () => {
    isPainting.current = false;
    lastUV.current = null;
    // eslint-disable-next-line react-hooks/immutability
    if (paintBrushMode === "brush" && controls) controls.enabled = true; // Three.js controls mutation — intentional
  };

  // Safety-net: re-enable orbit if pointer is released outside the car mesh
  useEffect(() => {
    if (paintBrushMode !== "brush") return;
    const handleUp = () => {
      isPainting.current = false;
      lastUV.current = null;
      // eslint-disable-next-line react-hooks/immutability
      if (controls) controls.enabled = true; // Three.js controls mutation — intentional
    };
    window.addEventListener("pointerup", handleUp);
    return () => window.removeEventListener("pointerup", handleUp);
  }, [paintBrushMode, controls]);

  return (
    <group ref={groupRef} onPointerDown={handleBrushClick} onPointerMove={handleBrushDrag} onPointerUp={handleBrushUp}>
      <ModelInner templateId={templateId} />
    </group>
  );
}
