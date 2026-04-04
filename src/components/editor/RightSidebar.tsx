"use client";

import { useEditorStore } from "@/lib/store";
import { getTemplate } from "@/lib/templates";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { FinishType } from "@/lib/types";

const finishes: { value: FinishType; label: string }[] = [
  { value: "matte", label: "Matte" },
  { value: "glossy", label: "Glossy" },
  { value: "metallic", label: "Metallic" },
  { value: "kraft", label: "Kraft" },
];

const presetColors = [
  "#ffffff",
  "#f5f5f5",
  "#1a1a1a",
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#c4a265",
  "#6366f1",
];

const bgPresets = [
  "#f0f0f0",
  "#ffffff",
  "#1a1a1a",
  "#f8f4f0",
  "#e8f4f8",
  "#f0e8f8",
  "#fef3c7",
  "#d1fae5",
];

export function RightSidebar() {
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId);
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const baseColor = useEditorStore((s) => s.baseColor);
  const setBaseColor = useEditorStore((s) => s.setBaseColor);
  const finish = useEditorStore((s) => s.finish);
  const setFinish = useEditorStore((s) => s.setFinish);
  const backgroundColor = useEditorStore((s) => s.backgroundColor);
  const setBackgroundColor = useEditorStore((s) => s.setBackgroundColor);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);
  const updateTextureTransform = useEditorStore((s) => s.updateTextureTransform);

  const template = getTemplate(activeTemplateId);
  const currentTexture = surfaceTextures[activeSurface];

  return (
    <div className="w-72 border-l bg-white flex flex-col shrink-0 overflow-y-auto">
      {/* Surface selector */}
      <div className="p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Surface
        </h3>
        <div className="flex flex-wrap gap-2">
          {template?.surfaces.map((surface) => (
            <Button
              key={surface}
              variant={activeSurface === surface ? "default" : "outline"}
              size="sm"
              className="capitalize text-xs"
              onClick={() => setActiveSurface(surface)}
            >
              {surface}
              {surfaceTextures[surface]?.imageUrl && (
                <span className="ml-1 w-2 h-2 rounded-full bg-green-400 inline-block" />
              )}
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Texture transform controls */}
      {currentTexture?.imageUrl && (
        <>
          <div className="p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Texture Adjustment
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Scale: {currentTexture.scale.toFixed(2)}
                </label>
                <Slider
                  value={[currentTexture.scale]}
                  min={0.1}
                  max={3}
                  step={0.05}
                  onValueChange={(v) =>
                    updateTextureTransform(activeSurface, { scale: Array.isArray(v) ? v[0] : v })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Offset X: {currentTexture.offsetX.toFixed(2)}
                </label>
                <Slider
                  value={[currentTexture.offsetX]}
                  min={-1}
                  max={1}
                  step={0.01}
                  onValueChange={(v) =>
                    updateTextureTransform(activeSurface, { offsetX: Array.isArray(v) ? v[0] : v })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Offset Y: {currentTexture.offsetY.toFixed(2)}
                </label>
                <Slider
                  value={[currentTexture.offsetY]}
                  min={-1}
                  max={1}
                  step={0.01}
                  onValueChange={(v) =>
                    updateTextureTransform(activeSurface, { offsetY: Array.isArray(v) ? v[0] : v })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Rotation: {Math.round((currentTexture.rotation * 180) / Math.PI)}°
                </label>
                <Slider
                  value={[currentTexture.rotation]}
                  min={0}
                  max={Math.PI * 2}
                  step={0.05}
                  onValueChange={(v) =>
                    updateTextureTransform(activeSurface, { rotation: Array.isArray(v) ? v[0] : v })
                  }
                />
              </div>
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Material panel */}
      <div className="p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Material Color
        </h3>
        <div className="grid grid-cols-6 gap-2 mb-3">
          {presetColors.map((color) => (
            <button
              key={color}
              onClick={() => setBaseColor(color)}
              className={`w-8 h-8 rounded-lg border-2 transition-all ${
                baseColor === color
                  ? "border-primary scale-110"
                  : "border-transparent hover:border-gray-300"
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={baseColor}
            onChange={(e) => setBaseColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border"
          />
          <span className="text-xs text-muted-foreground">{baseColor}</span>
        </div>
      </div>

      <Separator />

      {/* Finish selector */}
      <div className="p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Finish
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {finishes.map((f) => (
            <Button
              key={f.value}
              variant={finish === f.value ? "default" : "outline"}
              size="sm"
              className="text-xs"
              onClick={() => setFinish(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Background */}
      <div className="p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Background
        </h3>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {bgPresets.map((color) => (
            <button
              key={color}
              onClick={() => setBackgroundColor(color)}
              className={`w-full aspect-square rounded-lg border-2 transition-all ${
                backgroundColor === color
                  ? "border-primary scale-110"
                  : "border-transparent hover:border-gray-300"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border"
          />
          <span className="text-xs text-muted-foreground">
            {backgroundColor}
          </span>
        </div>
      </div>
    </div>
  );
}
