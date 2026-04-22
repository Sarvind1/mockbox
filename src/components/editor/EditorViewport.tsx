"use client";

import { Suspense, useRef, useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import type { RootState } from "@react-three/fiber";
import * as THREE from "three";
import { useEditorStore } from "@/lib/store";
import { PackagingModelSwitch } from "@/components/models/PackagingModel";
import { Loader2, Box } from "lucide-react";

const LOCAL_HDRI = "/hdri/studio_small_03_1k.hdr";

function DragDropHandler() {
  const { gl, camera, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const pointer = useRef(new THREE.Vector2());
  const lastHoveredZone = useRef<string | null>(null);
  const lastHoveredTime = useRef<number>(0);

  useEffect(() => {
    const canvas = gl.domElement;

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = "copy";

      const rect = canvas.getBoundingClientRect();
      pointer.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.current.setFromCamera(pointer.current, camera);
      const hits = raycaster.current.intersectObjects(scene.children, true);
      const hit = hits.find((h) => (h.object as THREE.Mesh).userData?.surface);

      if (hit) {
        const zone = (hit.object as THREE.Mesh).userData.surface as string;
        lastHoveredZone.current = zone;
        lastHoveredTime.current = Date.now();
        useEditorStore.getState().setDropHoverZone(zone);
      }
      // If no hit: keep lastHoveredZone alive (sticky), don't clear dropHoverZone
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      useEditorStore.getState().setDropHoverZone(null);

      const store = useEditorStore.getState();
      const stickerMode = store.stickerMode;

      // Determine target zone: direct hit first, then sticky fallback (500ms)
      const rect = canvas.getBoundingClientRect();
      pointer.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(pointer.current, camera);
      const hits = raycaster.current.intersectObjects(scene.children, true);
      const directHit = hits.find((h) => (h.object as THREE.Mesh).userData?.surface);

      // Resolve the image URL from the drop event
      let resolvedUrl: string | null = null;
      const file = e.dataTransfer?.files[0];
      if (file?.type.startsWith("image/")) {
        resolvedUrl = URL.createObjectURL(file);
      } else {
        const presetUrl = e.dataTransfer?.getData("text/plain");
        if (presetUrl) resolvedUrl = presetUrl;
      }
      if (!resolvedUrl) return;

      if (stickerMode && directHit && directHit.face) {
        // Sticker mode: multi-mesh projection so stickers crossing panel boundaries
        // render seamlessly. Each nearby mesh gets its own DecalGeometry sharing a groupId.
        const hitMesh = directHit.object as THREE.Mesh;
        const worldPoint = directHit.point.clone();
        const worldNormal = directHit.face.normal.clone()
          .transformDirection(hitMesh.matrixWorld);

        // Size as a fraction of the hit mesh's world-space bounding box diagonal.
        const meshBox = new THREE.Box3().setFromObject(hitMesh);
        const meshSize = new THREE.Vector3();
        meshBox.getSize(meshSize);
        const meshDiag = meshSize.length();
        const defaultSize = Math.min(meshDiag * 0.2, 0.15);
        const groupId = crypto.randomUUID();

        // Use the raw drop point — no AABB clamping. Multi-mesh projection
        // handles boundary crossings, so clamping away from edges is unnecessary.
        const dropPoint = worldPoint;

        console.log("[sticker:drop]", {
          mesh: hitMesh.name || hitMesh.uuid,
          surface: hitMesh.userData.surface,
          worldPoint: dropPoint.toArray().map(v => +v.toFixed(4)),
          worldNormal: worldNormal.toArray().map(v => +v.toFixed(4)),
          meshDiag: +meshDiag.toFixed(4),
          size: +defaultSize.toFixed(4),
        });

        store.pushUndo();

        // Primary sticker on the directly hit mesh
        const hitMeshKey = hitMesh.name || hitMesh.uuid;
        store.addSticker({
          id: crypto.randomUUID(),
          groupId,
          imageUrl: resolvedUrl,
          position: { x: dropPoint.x, y: dropPoint.y, z: dropPoint.z },
          normal: { x: worldNormal.x, y: worldNormal.y, z: worldNormal.z },
          size: defaultSize,
          rotation: 0,
          meshName: hitMeshKey,
          mirror: true,
        });

        // Find nearby carpaint meshes whose bounding box intersects the sticker
        // sphere. Project the same sticker onto each so the decal spans panel seams.
        const stickerSphere = new THREE.Sphere(dropPoint, defaultSize * 0.8);
        const neighborBox = new THREE.Box3();

        scene.traverse((child) => {
          const m = child as THREE.Mesh;
          if (!m.isMesh) return;
          const surf = m.userData?.surface;
          if (!surf || surf === "trim") return;

          // Skip the mesh we already added
          const key = m.name || m.uuid;
          if (key === hitMeshKey) return;

          neighborBox.setFromObject(m);
          if (stickerSphere.intersectsBox(neighborBox)) {
            store.addSticker({
              id: crypto.randomUUID(),
              groupId,
              imageUrl: resolvedUrl,
              position: { x: dropPoint.x, y: dropPoint.y, z: dropPoint.z },
              normal: { x: worldNormal.x, y: worldNormal.y, z: worldNormal.z },
              size: defaultSize,
              rotation: 0,
              meshName: key,
              mirror: true,
            });
          }
        });
      } else if (!stickerMode) {
        // Zone-fill mode: existing behavior
        let surface: string | null = null;
        if (directHit) {
          surface = (directHit.object as THREE.Mesh).userData.surface as string;
        } else if (lastHoveredZone.current && Date.now() - lastHoveredTime.current < 500) {
          surface = lastHoveredZone.current;
        }
        if (!surface) return;
        store.uploadTexture(surface, resolvedUrl);
      }
    };

    const onDragLeave = (e: DragEvent) => {
      if (!canvas.contains(e.relatedTarget as Node)) {
        lastHoveredZone.current = null;
        useEditorStore.getState().setDropHoverZone(null);
      }
    };

    // Click-to-place sticker when a pending sticker URL is queued (from upload)
    const onClick = (e: MouseEvent) => {
      const store = useEditorStore.getState();
      if (!store.stickerMode || !store.pendingStickerUrl) return;

      const rect = canvas.getBoundingClientRect();
      pointer.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(pointer.current, camera);
      const hits = raycaster.current.intersectObjects(scene.children, true);
      const directHit = hits.find((h) => (h.object as THREE.Mesh).userData?.surface);

      if (!directHit || !directHit.face) return;

      const hitMesh = directHit.object as THREE.Mesh;
      const worldPoint = directHit.point.clone();
      const worldNormal = directHit.face.normal.clone().transformDirection(hitMesh.matrixWorld);

      const meshBox = new THREE.Box3().setFromObject(hitMesh);
      const meshSize = new THREE.Vector3();
      meshBox.getSize(meshSize);
      const meshDiag = meshSize.length();
      const defaultSize = Math.min(meshDiag * 0.2, 0.15);
      const groupId = crypto.randomUUID();
      const resolvedUrl = store.pendingStickerUrl;

      store.pushUndo();

      const hitMeshKey = hitMesh.name || hitMesh.uuid;
      store.addSticker({
        id: crypto.randomUUID(),
        groupId,
        imageUrl: resolvedUrl,
        position: { x: worldPoint.x, y: worldPoint.y, z: worldPoint.z },
        normal: { x: worldNormal.x, y: worldNormal.y, z: worldNormal.z },
        size: defaultSize,
        rotation: 0,
        meshName: hitMeshKey,
        mirror: true,
      });

      // Project onto neighboring meshes for cross-panel stickers
      const stickerSphere = new THREE.Sphere(worldPoint, defaultSize * 0.8);
      const neighborBox = new THREE.Box3();
      scene.traverse((child) => {
        const m = child as THREE.Mesh;
        if (!m.isMesh) return;
        const surf = m.userData?.surface;
        if (!surf || surf === "trim") return;
        const key = m.name || m.uuid;
        if (key === hitMeshKey) return;
        neighborBox.setFromObject(m);
        if (stickerSphere.intersectsBox(neighborBox)) {
          store.addSticker({
            id: crypto.randomUUID(),
            groupId,
            imageUrl: resolvedUrl,
            position: { x: worldPoint.x, y: worldPoint.y, z: worldPoint.z },
            normal: { x: worldNormal.x, y: worldNormal.y, z: worldNormal.z },
            size: defaultSize,
            rotation: 0,
            meshName: key,
            mirror: true,
          });
        }
      });

      URL.revokeObjectURL(resolvedUrl);
      store.setPendingStickerUrl(null);
    };

    canvas.addEventListener("dragover", onDragOver);
    canvas.addEventListener("drop", onDrop);
    canvas.addEventListener("dragleave", onDragLeave);
    canvas.addEventListener("click", onClick);
    return () => {
      canvas.removeEventListener("dragover", onDragOver);
      canvas.removeEventListener("drop", onDrop);
      canvas.removeEventListener("dragleave", onDragLeave);
      canvas.removeEventListener("click", onClick);
    };
  }, [gl, camera, scene]);

  return null;
}

function SceneContent({ onReady }: { onReady: () => void }) {
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId);

  useEffect(() => {
    // Model component has mounted — signal ready after a frame
    const raf = requestAnimationFrame(() => onReady());
    return () => cancelAnimationFrame(raf);
  }, [activeTemplateId, onReady]);

  return (
    <Suspense fallback={null}>
      <PackagingModelSwitch templateId={activeTemplateId} />
    </Suspense>
  );
}

function DeferredEnvironment({ ready }: { ready: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (ready) {
      // Defer HDRI processing until after model shaders have compiled
      const t = setTimeout(() => setShow(true), 100);
      return () => clearTimeout(t);
    }
  }, [ready]);
  if (!show) return null;
  return <Environment files={LOCAL_HDRI} />;
}

function Scene({ onReady }: { onReady: () => void }) {
  const backgroundColor = useEditorStore((s) => s.backgroundColor);
  const [modelReady, setModelReady] = useState(false);

  const handleReady = useCallback(() => {
    setModelReady(true);
    onReady();
  }, [onReady]);

  return (
    <>
      <color attach="background" args={[backgroundColor]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-3, 4, -3]} intensity={0.3} />
      <directionalLight position={[0, -2, 5]} intensity={0.2} />

      <SceneContent onReady={handleReady} />
      <DragDropHandler />

      <ContactShadows
        position={[0, -0.75, 0]}
        opacity={0.4}
        scale={4}
        blur={2.5}
        far={1.5}
        frames={1}
      />

      <DeferredEnvironment ready={modelReady} />
      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        minDistance={1}
        maxDistance={8}
        target={[0, 0, 0]}
      />
    </>
  );
}

function ViewportLoader() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10 pointer-events-none">
      <div className="flex flex-col items-center gap-4 animate-in fade-in duration-200">
        <div className="relative">
          <Box className="h-10 w-10 text-muted-foreground/30" />
          <Loader2 className="h-6 w-6 text-primary absolute -bottom-1 -right-1 animate-spin" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">
            Loading 3D scene...
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Setting up lighting and materials
          </p>
        </div>
      </div>
    </div>
  );
}

function ViewportInner({ cameraPosition }: { cameraPosition: [number, number, number] }) {
  // Defer Canvas mount by one frame so React Strict Mode's
  // mount → unmount → remount cycle completes before we ever
  // create a WebGL context. Without this, 3 contexts are created
  // and the browser kills the orphaned ones.
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleReady = useCallback(() => {
    setReady(true);
  }, []);

  const handleCreated = useCallback(({ gl }: RootState) => {
    const canvas = gl.domElement;

    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      // Only remount if context is genuinely dead AND stays dead.
      // Spurious events from devtools/HMR self-recover within a frame.
      setTimeout(() => {
        const ctx = gl.getContext() as WebGL2RenderingContext | null;
        if (ctx?.isContextLost?.() ?? canvas.getContext("webgl2")?.isContextLost()) {
          console.warn("WebGL context lost — remounting Canvas");
          setCanvasKey((k) => k + 1);
        }
      }, 500);
    });
  }, []);

  return (
    <>
      {(!mounted || !ready) && <ViewportLoader />}

      {mounted && (
        <Canvas
          key={canvasKey}
          camera={{ position: cameraPosition, fov: 45 }}
          gl={{
            preserveDrawingBuffer: true,
            antialias: true,
            powerPreference: "high-performance",
          }}
          dpr={[1, 2]}
          shadows
          onCreated={handleCreated}
        >
          <Scene onReady={handleReady} />
        </Canvas>
      )}

      {ready && (
        <div className="absolute bottom-4 left-4 text-xs text-muted-foreground bg-white/80 backdrop-blur-sm rounded-md px-3 py-2 pointer-events-none animate-in fade-in duration-500">
          Drag to rotate &middot; Scroll to zoom &middot; Right-click to pan
        </div>
      )}
    </>
  );
}

export function EditorViewport() {
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId);
  const stickerMode = useEditorStore((s) => s.stickerMode);
  const pendingStickerUrl = useEditorStore((s) => s.pendingStickerUrl);
  const isVehicle = activeTemplateId.startsWith("car-") || activeTemplateId === "porsche-911" || activeTemplateId === "bmw-x5m";
  const cameraPosition: [number, number, number] = isVehicle ? [3, 0.8, 3] : [2, 1.5, 2.5];

  const isPlacementMode = stickerMode && !!pendingStickerUrl;

  // Keyboard shortcuts
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    },
    [undo, redo]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Esc to cancel sticker placement
  useEffect(() => {
    if (!stickerMode || !pendingStickerUrl) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        URL.revokeObjectURL(pendingStickerUrl);
        useEditorStore.getState().setPendingStickerUrl(null);
        useEditorStore.getState().setStickerMode(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stickerMode, pendingStickerUrl]);

  return (
    <div
      className="flex-1 min-w-0 relative bg-gray-50"
      style={{ cursor: isPlacementMode ? 'crosshair' : undefined }}
    >
      <ViewportInner cameraPosition={cameraPosition} />

      {isPlacementMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-black/80 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-3 pointer-events-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pendingStickerUrl} alt="Pending sticker" className="w-8 h-8 object-contain rounded" />
          <span>Click on the car to place your sticker</span>
          <button
            onClick={() => {
              URL.revokeObjectURL(pendingStickerUrl);
              useEditorStore.getState().setPendingStickerUrl(null);
              useEditorStore.getState().setStickerMode(false);
            }}
            className="ml-2 text-xs text-gray-400 hover:text-white"
          >
            Esc to cancel
          </button>
        </div>
      )}
    </div>
  );
}
