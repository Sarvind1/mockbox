"use client";

import { Suspense, useRef, useCallback, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, Grid } from "@react-three/drei";
import { useEditorStore } from "@/lib/store";
import { PackagingModelSwitch } from "@/components/models/PackagingModel";

function Scene() {
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId);
  const backgroundColor = useEditorStore((s) => s.backgroundColor);

  return (
    <>
      <color attach="background" args={[backgroundColor]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-3, 4, -3]} intensity={0.3} />
      <directionalLight position={[0, -2, 5]} intensity={0.2} />

      <Suspense fallback={null}>
        <PackagingModelSwitch templateId={activeTemplateId} />
      </Suspense>

      <ContactShadows
        position={[0, -0.75, 0]}
        opacity={0.4}
        scale={4}
        blur={2.5}
        far={1.5}
      />

      <Environment preset="studio" />
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

export function EditorViewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  return (
    <div className="flex-1 relative bg-gray-50">
      <Canvas
        ref={canvasRef}
        camera={{ position: [2, 1.5, 2.5], fov: 45 }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        dpr={[1, 2]}
        shadows
      >
        <Scene />
      </Canvas>

      {/* Viewport overlay hints */}
      <div className="absolute bottom-4 left-4 text-xs text-muted-foreground bg-white/80 backdrop-blur-sm rounded-md px-3 py-2 pointer-events-none">
        Drag to rotate &middot; Scroll to zoom &middot; Right-click to pan
      </div>
    </div>
  );
}
