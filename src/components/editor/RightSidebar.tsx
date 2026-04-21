"use client";

import { useEditorStore } from "@/lib/store";
import { getTemplate } from "@/lib/templates";
import { RotateCcw, Trash2 } from "lucide-react";
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
  const selectedZoneIds = useEditorStore((s) => s.selectedZoneIds);
  const baseColor = useEditorStore((s) => s.baseColor);
  const setBaseColor = useEditorStore((s) => s.setBaseColor);
  const finish = useEditorStore((s) => s.finish);
  const setFinish = useEditorStore((s) => s.setFinish);
  const backgroundColor = useEditorStore((s) => s.backgroundColor);
  const setBackgroundColor = useEditorStore((s) => s.setBackgroundColor);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);
  const updateTextureTransform = useEditorStore((s) => s.updateTextureTransform);

  const setZoneColor = useEditorStore((s) => s.setZoneColor);
  const stickers = useEditorStore((s) => s.stickers);
  const selectedStickerGroupId = useEditorStore((s) => s.selectedStickerGroupId);
  const updateStickerGroup = useEditorStore((s) => s.updateStickerGroup);
  const removeStickerGroup = useEditorStore((s) => s.removeStickerGroup);
  const selectSticker = useEditorStore((s) => s.selectSticker);
  const pushUndo = useEditorStore((s) => s.pushUndo);

  // Representative sticker from the selected group (for displaying size/rotation values)
  const selectedSticker = stickers.find((s) => s.groupId === selectedStickerGroupId) ?? null;

  const template = getTemplate(activeTemplateId);
  const currentTexture = surfaceTextures[activeSurface];
  const isMultiSelect = selectedZoneIds.length > 1;
  const canvasZones = template?.canvasZones ?? [];

  // A surface is a "canvas zone" if it's not a primary surface (e.g. "body").
  // This covers all tagged carpaint meshes in the GLB, not just the ones explicitly
  // listed in canvasZones — unregistered mesh names (pillars, frames, etc.) still
  // need per-zone color control so we must not fall through to setBaseColor for them.
  const isCanvasZone = !!activeSurface && !(template?.surfaces ?? []).includes(activeSurface);
  const activeZone = template?.canvasZones?.find((z) => z.id === activeSurface);
  // Effective color shown in picker: zone override or body color
  const displayColor = (isCanvasZone ? currentTexture?.color ?? baseColor : baseColor);
  const handleColorChange = (color: string) => {
    if (isCanvasZone) {
      setZoneColor(activeSurface, color);
    } else {
      setBaseColor(color);
    }
  };

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
        {/* Canvas zones — shown as a second row when the template has them */}
        {canvasZones.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 max-h-32 overflow-y-auto">
            {canvasZones.map((zone) => {
              const isActive = activeSurface === zone.id;
              const isSelected = selectedZoneIds.includes(zone.id);
              return (
                <button
                  key={zone.id}
                  onClick={() => setActiveSurface(zone.id)}
                  className={`px-2 py-1 rounded text-xs border transition-all ${
                    isActive
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : isSelected
                      ? "border-primary/50 bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-gray-300 hover:text-foreground"
                  }`}
                >
                  {zone.label}
                  {surfaceTextures[zone.id]?.imageUrl && (
                    <span className="ml-1 w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Separator />

      {/* Sticker controls (when a sticker is selected) */}
      {selectedSticker && (
        <>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sticker
              </h3>
              <button
                onClick={() => selectSticker(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Deselect
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Size: {selectedSticker.size.toFixed(3)}
                </label>
                <Slider
                  value={[selectedSticker.size]}
                  min={0.005}
                  max={2.0}
                  step={0.005}
                  onValueChange={(v) =>
                    updateStickerGroup(selectedStickerGroupId!, {
                      size: Array.isArray(v) ? v[0] : v,
                    })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Rotation: {Math.round((selectedSticker.rotation * 180) / Math.PI)}deg
                </label>
                <Slider
                  value={[selectedSticker.rotation]}
                  min={0}
                  max={Math.PI * 2}
                  step={0.05}
                  onValueChange={(v) =>
                    updateStickerGroup(selectedStickerGroupId!, {
                      rotation: Array.isArray(v) ? v[0] : v,
                    })
                  }
                />
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => {
                  pushUndo();
                  removeStickerGroup(selectedStickerGroupId!);
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete Sticker
              </Button>
            </div>
          </div>
          <Separator />
        </>
      )}

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
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">Mirror</label>
                <button
                  onClick={() =>
                    updateTextureTransform(activeSurface, { mirrorX: !currentTexture.mirrorX })
                  }
                  className={`px-3 py-1 rounded text-xs border transition-all ${
                    currentTexture.mirrorX
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border text-muted-foreground hover:border-gray-300"
                  }`}
                >
                  {currentTexture.mirrorX ? "On" : "Off"}
                </button>
              </div>
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Material panel */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isMultiSelect
              ? `${selectedZoneIds.length} Zones Color`
              : isCanvasZone
              ? `${activeZone?.label ?? "Zone"} Color`
              : "Material Color"}
          </h3>
          {isCanvasZone && !isMultiSelect && (currentTexture?.color ?? null) !== null && (
            <button
              onClick={() => setZoneColor(activeSurface, null)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              title="Reset to body color"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          )}
          {isMultiSelect && (
            <button
              onClick={() => {
                for (const id of selectedZoneIds) setZoneColor(id, null);
              }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              title="Reset all selected zones to body color"
            >
              <RotateCcw className="h-3 w-3" />
              Reset all
            </button>
          )}
        </div>
        {isCanvasZone && !isMultiSelect && !currentTexture?.color && (
          <p className="text-xs text-muted-foreground mb-2">
            Using body color — pick to override
          </p>
        )}
        {isMultiSelect && (
          <p className="text-xs text-muted-foreground mb-2">
            Color applies to all {selectedZoneIds.length} selected zones
          </p>
        )}
        <div className="grid grid-cols-6 gap-2 mb-3">
          {presetColors.map((color) => (
            <button
              key={color}
              onClick={() => handleColorChange(color)}
              className={`w-8 h-8 rounded-lg border-2 transition-all ${
                displayColor === color
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
            value={displayColor}
            onChange={(e) => handleColorChange(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border"
          />
          <span className="text-xs text-muted-foreground">{displayColor}</span>
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
