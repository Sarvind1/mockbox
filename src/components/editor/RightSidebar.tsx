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

// ─── WRAP RIGHT SIDEBAR ──────────────────────────────────────────────────────

function WrapRightSidebar() {
  const selectedZoneIds = useEditorStore((s) => s.selectedZoneIds);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);
  const setZoneColor = useEditorStore((s) => s.setZoneColor);
  const stickers = useEditorStore((s) => s.stickers);
  const selectedStickerGroupId = useEditorStore((s) => s.selectedStickerGroupId);
  const updateStickerGroup = useEditorStore((s) => s.updateStickerGroup);
  const removeStickerGroup = useEditorStore((s) => s.removeStickerGroup);
  const pushUndo = useEditorStore((s) => s.pushUndo);
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId);

  const template = getTemplate(activeTemplateId);
  const selectedSticker = stickers.find((s) => s.groupId === selectedStickerGroupId) ?? null;
  const hasPanel = selectedZoneIds.length > 0;
  const hasSticker = !!selectedSticker;

  if (!hasPanel && !hasSticker) {
    return (
      <div className="w-[216px] bg-card border-l border-border flex flex-col items-center justify-center p-5 shrink-0">
        <div className="text-2xl opacity-15 mb-2">{"\u25CE"}</div>
        <div className="text-[11px] text-muted-foreground text-center leading-relaxed">
          Select a panel<br />or place a decal<br />to see properties
        </div>
      </div>
    );
  }

  return (
    <div className="w-[216px] bg-card border-l border-border flex flex-col overflow-y-auto shrink-0 p-3.5">
      {hasSticker && (
        <>
          <div className="text-[9.5px] font-bold tracking-wider uppercase text-muted-foreground mb-1.5">
            Decal
          </div>
          <div className="space-y-2.5">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[10.5px] text-muted-foreground">Size</span>
                <span className="text-[10.5px] font-bold">{selectedSticker.size.toFixed(2)}{"\u00D7"}</span>
              </div>
              <Slider
                value={[selectedSticker.size]}
                min={0.005}
                max={2.0}
                step={0.005}
                onValueChange={(v) =>
                  updateStickerGroup(selectedStickerGroupId!, { size: Array.isArray(v) ? v[0] : v })
                }
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[10.5px] text-muted-foreground">Rotation</span>
                <span className="text-[10.5px] font-bold">{Math.round((selectedSticker.rotation * 180) / Math.PI)}{"\u00B0"}</span>
              </div>
              <Slider
                value={[selectedSticker.rotation]}
                min={0}
                max={Math.PI * 2}
                step={0.05}
                onValueChange={(v) =>
                  updateStickerGroup(selectedStickerGroupId!, { rotation: Array.isArray(v) ? v[0] : v })
                }
              />
            </div>
            <div>
              <div className="flex justify-between items-center">
                <span className="text-[10.5px] text-muted-foreground">Mirror</span>
                <button
                  onClick={() => updateStickerGroup(selectedStickerGroupId!, { mirror: !selectedSticker.mirror })}
                  className="px-2 py-0.5 rounded text-[10px] font-bold border transition-all"
                  style={{
                    background: selectedSticker.mirror ? "var(--wrap-accent-dim)" : "var(--wrap-surf2, var(--muted))",
                    color: selectedSticker.mirror ? "var(--primary)" : "var(--muted-foreground)",
                    borderColor: selectedSticker.mirror ? "var(--primary)" : "var(--border)",
                  }}
                >
                  {selectedSticker.mirror ? "On" : "Off"}
                </button>
              </div>
            </div>
          </div>
          <div className="h-px bg-border my-3" />
          <div className="flex gap-1.5">
            <button
              onClick={() => updateStickerGroup(selectedStickerGroupId!, { size: 0.1, rotation: 0 })}
              className="flex-1 py-1.5 rounded-md text-[10.5px] font-semibold border border-border text-muted-foreground"
              style={{ background: "var(--wrap-surf2, var(--muted))" }}
            >
              Reset
            </button>
            <button
              onClick={() => {
                pushUndo();
                removeStickerGroup(selectedStickerGroupId!);
              }}
              className="flex-1 py-1.5 rounded-md text-[10.5px] font-bold border text-destructive"
              style={{ background: "rgba(200,70,55,0.12)", borderColor: "rgba(200,70,55,0.3)" }}
            >
              Delete {"\u00D7"}
            </button>
          </div>
          {hasPanel && <div className="h-px bg-border my-3" />}
        </>
      )}

      {hasPanel && (
        <>
          <div className="text-[9.5px] font-bold tracking-wider uppercase text-muted-foreground mb-1.5">
            {selectedZoneIds.length} Panel{selectedZoneIds.length > 1 ? "s" : ""} Selected
          </div>
          <div className="flex flex-wrap gap-1 mb-2.5">
            {selectedZoneIds.slice(0, 6).map((id) => {
              const col = surfaceTextures[id]?.color;
              const zone = template?.canvasZones?.find((z) => z.id === id);
              return (
                <div
                  key={id}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-border text-[10px]"
                  style={{ background: "var(--wrap-surf2, var(--muted))" }}
                >
                  {col && <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: col }} />}
                  <span className="text-muted-foreground">{zone?.label?.split(" ")[0] || id}</span>
                </div>
              );
            })}
            {selectedZoneIds.length > 6 && (
              <div className="text-[10px] text-muted-foreground px-1 py-0.5">+{selectedZoneIds.length - 6}</div>
            )}
          </div>
          <button
            onClick={() => selectedZoneIds.forEach((id) => setZoneColor(id, null))}
            className="w-full py-1.5 rounded-md text-[10.5px] font-semibold border border-border text-muted-foreground"
            style={{ background: "var(--wrap-surf2, var(--muted))" }}
          >
            Reset panel colors
          </button>
        </>
      )}
    </div>
  );
}

// ─── PACKAGING RIGHT SIDEBAR ─────────────────────────────────────────────��───

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

export function RightSidebar({ mode = "packaging" }: { mode?: "packaging" | "wrap" }) {
  if (mode === "wrap") return <WrapRightSidebar />;
  return <PackagingRightSidebar />;
}

function PackagingRightSidebar() {
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

  const selectedSticker = stickers.find((s) => s.groupId === selectedStickerGroupId) ?? null;

  const template = getTemplate(activeTemplateId);
  const currentTexture = surfaceTextures[activeSurface];
  const isMultiSelect = selectedZoneIds.length > 1;
  const canvasZones = template?.canvasZones ?? [];

  const isCanvasZone = !!activeSurface && !(template?.surfaces ?? []).includes(activeSurface);
  const activeZone = template?.canvasZones?.find((z) => z.id === activeSurface);
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
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">Mirror</label>
                <button
                  onClick={() =>
                    updateStickerGroup(selectedStickerGroupId!, { mirror: !selectedSticker.mirror })
                  }
                  className={`px-3 py-1 rounded text-xs border transition-all ${
                    selectedSticker.mirror
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border text-muted-foreground hover:border-gray-300"
                  }`}
                >
                  {selectedSticker.mirror ? "On" : "Off"}
                </button>
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
