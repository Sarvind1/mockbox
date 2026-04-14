"use client";

import { Suspense, useRef, useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { useEditorStore } from "@/lib/store";
import { PackagingModelSwitch } from "@/components/models/PackagingModel";
import { Loader2, Box } from "lucide-react";

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

function Scene({ onReady }: { onReady: () => void }) {
  const backgroundColor = useEditorStore((s) => s.backgroundColor);

  return (
    <>
      <color attach="background" args={[backgroundColor]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-3, 4, -3]} intensity={0.3} />
      <directionalLight position={[0, -2, 5]} intensity={0.2} />

      <SceneContent onReady={onReady} />

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  const handleReady = useCallback(() => {
    setReady(true);
  }, []);

  return (
    <>
      {!ready && <ViewportLoader />}

      <Canvas
        ref={canvasRef}
        camera={{ position: cameraPosition, fov: 45 }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        dpr={[1, 2]}
        shadows
      >
        <Scene onReady={handleReady} />
      </Canvas>

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
  const isVehicle = activeTemplateId.startsWith("car-");
  const cameraPosition: [number, number, number] = isVehicle ? [3, 0.8, 3] : [2, 1.5, 2.5];

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
      {/* Key on templateId so ViewportInner remounts, resetting ready=false */}
      <ViewportInner key={activeTemplateId} cameraPosition={cameraPosition} />
    </div>
  );
}
