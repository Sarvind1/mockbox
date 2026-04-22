"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import { useEditorStore } from "@/lib/store";
import type { Sticker } from "@/lib/types";

export function StickerLayer({ parentScene }: { parentScene: THREE.Object3D }) {
  const stickers = useEditorStore((s) => s.stickers);
  const selectedStickerGroupId = useEditorStore((s) => s.selectedStickerGroupId);
  const selectSticker = useEditorStore((s) => s.selectSticker);

  const { gl, camera } = useThree();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controls = useThree((s) => s.controls) as any;

  const groupRef = useRef<THREE.Group>(null);
  const textureCacheRef = useRef<Map<string, THREE.Texture>>(new Map());
  const renderedKeyRef = useRef<string>("");

  // ── Per-mesh lookup ──────────────────────────────────────────────────────
  // Build a lookup from mesh name/uuid → live Mesh object from the parentScene.
  // We wait 2 frames via useFrame to ensure R3F has called updateMatrixWorld at
  // least once, then snapshot the lookup.
  const [meshLookup, setMeshLookup] = useState<Map<string, THREE.Mesh> | null>(null);
  const framesRef = useRef(0);
  const prevSceneRef = useRef<THREE.Object3D | null>(null);

  useFrame(() => {
    if (prevSceneRef.current !== parentScene) {
      prevSceneRef.current = parentScene;
      framesRef.current = 0;
      setMeshLookup(null);
    }
    framesRef.current += 1;
    if (framesRef.current !== 2) return;

    const lookup = new Map<string, THREE.Mesh>();
    parentScene.traverse((child) => {
      const m = child as THREE.Mesh;
      if (!m.isMesh || !m.userData?.surface) return;
      if (m.name) lookup.set(m.name, m);
      lookup.set(m.uuid, m);
    });
    if (lookup.size > 0) setMeshLookup(lookup);
  });

  // ── Drag-to-move ─────────────────────────────────────────────────────────
  const isDraggingRef = useRef(false);
  const dragGroupIdRef = useRef<string | null>(null);
  const dragRaycaster = useRef(new THREE.Raycaster());
  const dragPointer = useRef(new THREE.Vector2());

  // Unique car-surface meshes to raycast against during drag (exclude trim)
  const rayTargets = useMemo(() => {
    if (!meshLookup) return [];
    const seen = new Set<THREE.Mesh>();
    meshLookup.forEach((mesh) => {
      if (!seen.has(mesh) && mesh.userData.surface && mesh.userData.surface !== "trim") {
        seen.add(mesh);
      }
    });
    return Array.from(seen);
  }, [meshLookup]);

  useEffect(() => {
    const canvas = gl.domElement;

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current || !dragGroupIdRef.current || !meshLookup) return;

      const rect = canvas.getBoundingClientRect();
      dragPointer.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      dragPointer.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      dragRaycaster.current.setFromCamera(dragPointer.current, camera);
      const hits = dragRaycaster.current.intersectObjects(rayTargets, false);
      if (hits.length === 0 || !hits[0].face) return;

      const hitMesh = hits[0].object as THREE.Mesh;
      const worldPoint = hits[0].point.clone();
      const worldNormal = hits[0].face.normal.clone().transformDirection(hitMesh.matrixWorld);

      const state = useEditorStore.getState();
      const groupStickers = state.stickers.filter((s) => s.groupId === dragGroupIdRef.current);
      if (groupStickers.length === 0) return;
      const { size, rotation, imageUrl, mirror } = groupStickers[0];

      const hitMeshKey = hitMesh.name || hitMesh.uuid;
      const newStickers: Omit<Sticker, "id">[] = [
        {
          groupId: dragGroupIdRef.current,
          imageUrl,
          position: { x: worldPoint.x, y: worldPoint.y, z: worldPoint.z },
          normal: { x: worldNormal.x, y: worldNormal.y, z: worldNormal.z },
          size,
          rotation,
          meshName: hitMeshKey,
          mirror,
        },
      ];

      // Find neighboring meshes within the sticker sphere
      const stickerSphere = new THREE.Sphere(worldPoint, size * 0.8);
      const neighborBox = new THREE.Box3();
      const visited = new Set<THREE.Mesh>();
      visited.add(hitMesh);

      meshLookup.forEach((mesh) => {
        if (visited.has(mesh)) return;
        visited.add(mesh);
        if (!mesh.userData.surface || mesh.userData.surface === "trim") return;
        neighborBox.setFromObject(mesh);
        if (stickerSphere.intersectsBox(neighborBox)) {
          newStickers.push({
            groupId: dragGroupIdRef.current!,
            imageUrl,
            position: { x: worldPoint.x, y: worldPoint.y, z: worldPoint.z },
            normal: { x: worldNormal.x, y: worldNormal.y, z: worldNormal.z },
            size,
            rotation,
            meshName: mesh.name || mesh.uuid,
            mirror,
          });
        }
      });

      useEditorStore.getState().moveStickerGroup(dragGroupIdRef.current, newStickers);
    };

    const onPointerUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      dragGroupIdRef.current = null;
      if (controls) controls.enabled = true;
    };

    canvas.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      canvas.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [gl, camera, rayTargets, meshLookup, controls]);

  // ── Decal rebuild ────────────────────────────────────────────────────────
  const stickersKey = useMemo(() => {
    return (
      stickers
        .map(
          (s) =>
            `${s.id}:${s.groupId}:${s.position.x},${s.position.y},${s.position.z}:` +
            `${s.normal.x},${s.normal.y},${s.normal.z}:${s.size}:${s.rotation}:${s.imageUrl}:${s.mirror}`,
        )
        .join("|") + `|sel:${selectedStickerGroupId}|lookup:${meshLookup ? "ready" : "none"}`
    );
  }, [stickers, selectedStickerGroupId, meshLookup]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    if (renderedKeyRef.current === stickersKey) return;
    renderedKeyRef.current = stickersKey;

    // Clear old decals
    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Mesh;
      child.geometry?.dispose();
      (child.material as THREE.Material)?.dispose();
      group.remove(child);
    }

    if (!meshLookup) return;

    const loader = new THREE.TextureLoader();
    const cache = textureCacheRef.current;

    for (const sticker of stickers) {
      const targetMesh = meshLookup.get(sticker.meshName);
      if (!targetMesh) {
        console.warn("[StickerLayer] mesh not found for sticker", sticker.meshName);
        continue;
      }

      const position = new THREE.Vector3(
        sticker.position.x,
        sticker.position.y,
        sticker.position.z,
      );
      const normal = new THREE.Vector3(
        sticker.normal.x,
        sticker.normal.y,
        sticker.normal.z,
      ).normalize();

      const up =
        Math.abs(normal.y) > 0.99
          ? new THREE.Vector3(1, 0, 0)
          : new THREE.Vector3(0, 1, 0);
      const lookMatrix = new THREE.Matrix4().lookAt(
        position,
        position.clone().add(normal),
        up,
      );
      const quaternion = new THREE.Quaternion().setFromRotationMatrix(lookMatrix);
      if (sticker.rotation !== 0) {
        quaternion.premultiply(
          new THREE.Quaternion().setFromAxisAngle(normal, sticker.rotation),
        );
      }
      const orientation = new THREE.Euler().setFromQuaternion(quaternion);
      const size = new THREE.Vector3(sticker.size, sticker.size, sticker.size * 2);

      let decalGeom: THREE.BufferGeometry;
      try {
        decalGeom = new DecalGeometry(targetMesh, position, orientation, size);
      } catch {
        continue;
      }

      const posAttr = decalGeom.getAttribute("position");
      if (!posAttr || posAttr.count === 0) {
        decalGeom.dispose();
        continue;
      }

      if (sticker.mirror) {
        const uvAttr = decalGeom.getAttribute("uv");
        if (uvAttr) {
          for (let i = 0; i < uvAttr.count; i++) {
            uvAttr.setX(i, 1 - uvAttr.getX(i));
          }
          uvAttr.needsUpdate = true;
        }
      }

      const isSelected = sticker.groupId === selectedStickerGroupId;
      const material = new THREE.MeshBasicMaterial({
        color: "#ffffff",
        transparent: true,
        alphaTest: 0.05,
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
        opacity: isSelected ? 0.75 : 1,
      });

      const decalMesh = new THREE.Mesh(decalGeom, material);
      decalMesh.userData.stickerGroupId = sticker.groupId;
      decalMesh.renderOrder = 10;

      const loadAndApply = (tex: THREE.Texture) => {
        material.map = tex;
        material.needsUpdate = true;
      };

      if (cache.has(sticker.imageUrl)) {
        loadAndApply(cache.get(sticker.imageUrl)!);
      } else {
        loader.load(sticker.imageUrl, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          cache.set(sticker.imageUrl, tex);
          loadAndApply(tex);
        });
      }

      group.add(decalMesh);
    }
  }, [stickersKey, stickers, selectedStickerGroupId, meshLookup]);

  // ── Event handlers ───────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (e: any) => {
    e.stopPropagation();
    const groupId = e.object?.userData?.stickerGroupId as string | undefined;
    if (groupId) selectSticker(groupId);
  };

  // Pointer-down on a sticker that is already selected → start drag.
  // Pointer-down on an unselected sticker → just let onClick select it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePointerDown = (e: any) => {
    const groupId = e.object?.userData?.stickerGroupId as string | undefined;
    if (!groupId || groupId !== selectedStickerGroupId) return;
    e.stopPropagation();
    useEditorStore.getState().pushUndo();
    isDraggingRef.current = true;
    dragGroupIdRef.current = groupId;
    // eslint-disable-next-line react-hooks/immutability
    if (controls) controls.enabled = false; // Three.js controls mutation — intentional
  };

  return <group ref={groupRef} onClick={handleClick} onPointerDown={handlePointerDown} />;
}
