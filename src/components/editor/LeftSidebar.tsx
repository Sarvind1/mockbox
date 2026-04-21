"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditorStore } from "@/lib/store";
import { templates, getTemplate } from "@/lib/templates";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Upload,
  X,
  Box,
  Wine,
  Cylinder,
  ShoppingBag,
  Pipette,
  Coffee,
  Car,
  Layers,
  Plus,
  MousePointer2,
  ImagePlus,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const categoryIcons: Record<string, any> = {
  boxes: Box,
  bottles: Wine,
  cans: Cylinder,
  pouches: ShoppingBag,
  tubes: Pipette,
  cups: Coffee,
  vehicles: Car,
};

export function LeftSidebar({ mode = "packaging" }: { mode?: "packaging" | "wrap" }) {
  const router = useRouter();
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId);
  const setTemplate = useEditorStore((s) => s.setTemplate);
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const setActiveSurface = useEditorStore((s) => s.setActiveSurface);
  const selectedZoneIds = useEditorStore((s) => s.selectedZoneIds);
  const setSelectedZones = useEditorStore((s) => s.setSelectedZones);
  const toggleZoneInSelection = useEditorStore((s) => s.toggleZoneInSelection);
  const multiSelectMode = useEditorStore((s) => s.multiSelectMode);
  const setMultiSelectMode = useEditorStore((s) => s.setMultiSelectMode);
  const singlePaste = useEditorStore((s) => s.singlePaste);
  const setSinglePaste = useEditorStore((s) => s.setSinglePaste);
  const customGroups = useEditorStore((s) => s.customGroups);
  const addCustomGroup = useEditorStore((s) => s.addCustomGroup);
  const removeCustomGroup = useEditorStore((s) => s.removeCustomGroup);
  const singlePasteGroups = useEditorStore((s) => s.singlePasteGroups);
  const saveSinglePasteGroup = useEditorStore((s) => s.saveSinglePasteGroup);
  const removeSinglePasteGroup = useEditorStore((s) => s.removeSinglePasteGroup);
  const uploadTexture = useEditorStore((s) => s.uploadTexture);
  const removeTexture = useEditorStore((s) => s.removeTexture);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);
  const stickerMode = useEditorStore((s) => s.stickerMode);
  const setStickerMode = useEditorStore((s) => s.setStickerMode);
  const [dragOver, setDragOver] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const activeTemplate = getTemplate(activeTemplateId);
  const canvasZones = activeTemplate?.canvasZones ?? [];
  const predefinedGroups = activeTemplate?.zoneGroups ?? [];
  const allGroups = [...predefinedGroups, ...customGroups];

  // Detect if current selectedZoneIds matches an existing group
  const activeGroupId = allGroups.find(
    (g) =>
      g.zoneIds.length === selectedZoneIds.length &&
      g.zoneIds.every((id) => selectedZoneIds.includes(id))
  )?.id ?? null;

  const isMultiSelect = selectedZoneIds.length > 1;
  // Only show "Save as Group" if 2+ zones and it's not already a saved group
  const canSaveGroup = isMultiSelect && !activeGroupId;

  const handleZoneClick = (zoneId: string, e: React.MouseEvent) => {
    if (multiSelectMode || e.shiftKey) {
      toggleZoneInSelection(zoneId);
    } else if (activeSurface === zoneId && selectedZoneIds.length === 1) {
      // Click same active zone → deselect back to primary surface
      const primarySurface = activeTemplate?.surfaces[0] ?? "body";
      setActiveSurface(primarySurface);
    } else {
      setActiveSurface(zoneId);
    }
  };

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      uploadTexture(activeSurface, url);
    },
    [activeSurface, uploadTexture]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const currentTexture = surfaceTextures[activeSurface];

  const selectionLabel = isMultiSelect
    ? `${selectedZoneIds.length} zones`
    : canvasZones.find((z) => z.id === activeSurface)?.label ?? activeSurface;

  return (
    <div className="w-64 border-r bg-white flex flex-col shrink-0 overflow-y-auto">
      {/* Template selector */}
      <div className="p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Templates
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {templates.filter((t) => mode === "wrap" ? t.category === "vehicles" : t.category !== "vehicles").map((t) => {
            const Icon = categoryIcons[t.category] || Box;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setTemplate(t.id);
                  const targetPath =
                    t.category === "vehicles"
                      ? `/wrap/${t.id}`
                      : `/editor/${t.id}`;
                  router.replace(targetPath, { scroll: false });
                }}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-xs transition-all ${
                  activeTemplateId === t.id
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-gray-300 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-6 w-6" />
                <span className="text-center leading-tight">{t.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Canvas zones */}
      {canvasZones.length > 0 && (
        <>
          <Separator />
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Canvas Zones
              </h3>
              <button
                onClick={() => {
                  setMultiSelectMode(!multiSelectMode);
                  if (multiSelectMode) setActiveSurface(activeSurface); // collapse selection
                }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs border transition-all ${
                  multiSelectMode
                    ? "border-primary bg-primary text-white"
                    : "border-border text-muted-foreground hover:border-gray-400"
                }`}
                title="Toggle multi-select mode"
              >
                <MousePointer2 className="h-3 w-3" />
                {isMultiSelect && multiSelectMode ? `${selectedZoneIds.length}` : "Multi"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
              {canvasZones.map((zone) => {
                const isSelected = selectedZoneIds.includes(zone.id);
                const isActive = activeSurface === zone.id;
                return (
                  <button
                    key={zone.id}
                    onClick={(e) => handleZoneClick(zone.id, e)}
                    className={`px-2 py-1 rounded text-xs border transition-all ${
                      isSelected && isMultiSelect
                        ? "border-primary bg-primary/20 text-primary font-medium"
                        : isActive
                        ? "border-primary bg-primary/10 text-primary font-medium"
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
          </div>
        </>
      )}

      {/* Zone groups */}
      {(allGroups.length > 0 || canSaveGroup) && (
        <>
          <Separator />
          <div className="p-4">
            <div className="flex items-center gap-1 mb-2">
              <Layers className="h-3 w-3 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Zone Groups
              </h3>
            </div>

            {/* Save current selection as a new group */}
            {canSaveGroup && (
              <div className="flex gap-1 mb-2">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newGroupName.trim()) {
                      addCustomGroup(newGroupName.trim());
                      setNewGroupName("");
                    }
                  }}
                  placeholder={`Name (${selectedZoneIds.length} zones)`}
                  className="flex-1 text-xs border rounded px-2 py-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={() => {
                    const name = newGroupName.trim() || `Group ${customGroups.length + 1}`;
                    addCustomGroup(name);
                    setNewGroupName("");
                  }}
                  className="p-1 rounded border border-primary text-primary hover:bg-primary/10 transition-colors"
                  title="Save group"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Group buttons */}
            <div className="flex flex-col gap-1">
              {allGroups.map((group) => {
                const isActiveGroup = group.id === activeGroupId;
                return (
                  <div key={group.id} className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedZones(group.zoneIds)}
                      className={`flex-1 flex items-center justify-between px-2 py-1.5 rounded text-xs border transition-all text-left ${
                        isActiveGroup
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border text-muted-foreground hover:border-gray-300 hover:text-foreground"
                      }`}
                    >
                      <span>{group.label}</span>
                      <span className={`text-xs ${isActiveGroup ? "text-primary/70" : "text-muted-foreground/50"}`}>
                        {group.zoneIds.length}
                      </span>
                    </button>
                    {!group.isPredefined && (
                      <button
                        onClick={() => removeCustomGroup(group.id)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete group"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Sticker mode toggle */}
      <Separator />
      <div className="px-4 py-3">
        <button
          onClick={() => setStickerMode(!stickerMode)}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
            stickerMode
              ? "border-blue-500 bg-blue-500/10 text-blue-600"
              : "border-border text-muted-foreground hover:border-gray-300 hover:text-foreground"
          }`}
        >
          <ImagePlus className="h-4 w-4" />
          {stickerMode ? "Sticker Mode ON" : "Sticker Mode"}
        </button>
        {stickerMode && (
          <p className="text-xs text-blue-500/80 mt-1.5 text-center">
            Drag an image onto the car to place a sticker
          </p>
        )}
      </div>

      {/* Upload panel */}
      <Separator />
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Upload Artwork
          </h3>
          {isMultiSelect && (
            <button
              onClick={() => setSinglePaste(!singlePaste)}
              className={`text-xs px-2 py-0.5 rounded border transition-all ${
                singlePaste
                  ? "border-primary bg-primary text-white"
                  : "border-border text-muted-foreground hover:border-gray-400"
              }`}
              title="Single paste: span one image across all selected zones"
            >
              Single paste
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Applying to:{" "}
          <span className="font-medium text-foreground capitalize">
            {selectionLabel}
          </span>
        </p>

        {/* Preset logos */}
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-2">Presets</p>
          <div className="flex gap-2">
            {[
              { src: "/presets/company_logo.png", label: "Company" },
              { src: "/presets/LEGO_logo.svg.png", label: "LEGO" },
            ].map((preset) => (
              <button
                key={preset.src}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", preset.src);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => uploadTexture(activeSurface, preset.src)}
                title={`Apply ${preset.label} logo`}
                className="flex-1 rounded border border-border hover:border-primary overflow-hidden transition-all"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preset.src}
                  alt={preset.label}
                  className="w-full h-14 object-contain bg-gray-50 p-1"
                />
              </button>
            ))}
          </div>
        </div>

        <label
          htmlFor="artwork-upload"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground text-center">
            Drag & drop or click to upload
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            PNG, JPG, SVG
          </p>
        </label>

        <input
          id="artwork-upload"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />

        {currentTexture?.imageUrl && (
          <div className="mt-4 relative">
            <div className="rounded-lg border overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentTexture.imageUrl}
                alt="Uploaded artwork"
                className="w-full h-32 object-contain bg-gray-50"
              />
            </div>
            <Button
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6"
              onClick={() => removeTexture(activeSurface)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Save single paste group */}
        {singlePaste && isMultiSelect && (
          <button
            onClick={() => saveSinglePasteGroup()}
            className="mt-3 w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-primary text-primary text-xs hover:bg-primary/10 transition-colors"
            title="Save this paste layout — zones keep the combined image even when deselected"
          >
            <Plus className="h-3 w-3" />
            Save paste layout
          </button>
        )}

        {/* Saved single paste groups */}
        {singlePasteGroups.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-1">Saved paste layouts</p>
            <div className="flex flex-col gap-1">
              {singlePasteGroups.map((group, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      // Re-select the saved group for editing
                      const store = useEditorStore.getState();
                      store.setSelectedZones(group);
                      store.setSinglePaste(true);
                    }}
                    className="flex-1 flex items-center justify-between px-2 py-1 rounded text-xs border border-border text-muted-foreground hover:border-gray-300 hover:text-foreground text-left"
                  >
                    <span>Layout {idx + 1}</span>
                    <span className="text-muted-foreground/50">{group.length} zones</span>
                  </button>
                  <button
                    onClick={() => removeSinglePasteGroup(idx)}
                    className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                    title="Remove saved layout"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
