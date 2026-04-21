import { create } from "zustand";
import {
  EditorState,
  EditorSnapshot,
  FinishType,
  Sticker,
  SurfaceTexture,
  ZoneGroup,
} from "./types";
import { templates } from "./templates";

function createSnapshot(state: EditorState): EditorSnapshot {
  return {
    surfaceTextures: JSON.parse(JSON.stringify(state.surfaceTextures)),
    baseColor: state.baseColor,
    finish: state.finish,
    backgroundColor: state.backgroundColor,
    stickers: JSON.parse(JSON.stringify(state.stickers)),
  };
}

function initSurfaceTextures(
  surfaces: string[]
): Record<string, SurfaceTexture> {
  const result: Record<string, SurfaceTexture> = {};
  for (const s of surfaces) {
    result[s] = {
      surfaceName: s,
      imageUrl: null,
      color: null,
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      rotation: 0,
      mirrorX: true,
    };
  }
  return result;
}

function allSurfaces(template: (typeof templates)[0]): string[] {
  return [
    ...template.surfaces,
    ...(template.canvasZones?.map((z) => z.id) ?? []),
  ];
}

const defaultTemplate = templates[0];

interface EditorActions {
  setTemplate: (templateId: string) => void;
  setActiveSurface: (surface: string) => void;
  setDropHoverZone: (zone: string | null) => void;
  setSelectedZones: (ids: string[]) => void;
  toggleZoneInSelection: (id: string) => void;
  setMultiSelectMode: (on: boolean) => void;
  setSinglePaste: (on: boolean) => void;
  saveSinglePasteGroup: () => void;
  removeSinglePasteGroup: (idx: number) => void;
  addCustomGroup: (label: string) => void;
  removeCustomGroup: (groupId: string) => void;
  setBaseColor: (color: string) => void;
  setFinish: (finish: FinishType) => void;
  setOpacity: (opacity: number) => void;
  setBackgroundColor: (color: string) => void;
  setExportResolution: (res: "1080p" | "2k" | "4k") => void;
  setExportFormat: (fmt: "png" | "jpg") => void;
  setZoneColor: (surface: string, color: string | null) => void;
  uploadTexture: (surface: string, imageUrl: string) => void;
  removeTexture: (surface: string) => void;
  updateTextureTransform: (
    surface: string,
    updates: Partial<Pick<SurfaceTexture, "offsetX" | "offsetY" | "scale" | "rotation" | "mirrorX">>
  ) => void;
  undo: () => void;
  redo: () => void;
  pushUndo: () => void;
  setStickerMode: (on: boolean) => void;
  addSticker: (sticker: Sticker) => void;
  removeSticker: (id: string) => void;
  removeStickerGroup: (groupId: string) => void;
  updateSticker: (id: string, updates: Partial<Pick<Sticker, "size" | "rotation" | "position">>) => void;
  updateStickerGroup: (groupId: string, updates: Partial<Pick<Sticker, "size" | "rotation">>) => void;
  moveStickerGroup: (groupId: string, newStickers: Array<Omit<Sticker, "id">>) => void;
  selectSticker: (groupId: string | null) => void;
}

export const useEditorStore = create<EditorState & EditorActions>(
  (set, get) => ({
    // State
    activeTemplateId: defaultTemplate.id,
    templates,
    activeSurface: defaultTemplate.surfaces[0],
    selectedZoneIds: [defaultTemplate.surfaces[0]],
    customGroups: [],
    multiSelectMode: true,
    singlePaste: true,
    singlePasteGroups: [],
    surfaceTextures: initSurfaceTextures(allSurfaces(defaultTemplate)),
    baseColor: defaultTemplate.defaultColor,
    finish: "matte" as FinishType,
    opacity: 1,
    backgroundColor: "#f0f0f0",
    exportResolution: "1080p",
    exportFormat: "png",
    undoStack: [],
    redoStack: [],
    stickers: [],
    selectedStickerGroupId: null,
    stickerMode: false,
    dropHoverZone: null,

    // Actions
    pushUndo: () => {
      const state = get();
      set({
        undoStack: [...state.undoStack.slice(-19), createSnapshot(state)],
        redoStack: [],
      });
    },

    setDropHoverZone: (zone) => set({ dropHoverZone: zone }),

    setTemplate: (templateId: string) => {
      const template = templates.find((t) => t.id === templateId);
      if (!template) return;
      const state = get();
      set({
        undoStack: [...state.undoStack.slice(-19), createSnapshot(state)],
        redoStack: [],
        activeTemplateId: templateId,
        activeSurface: template.surfaces[0],
        selectedZoneIds: [template.surfaces[0]],
        customGroups: [],
        multiSelectMode: true,
        singlePaste: true,
        singlePasteGroups: [],
        surfaceTextures: initSurfaceTextures(allSurfaces(template)),
        baseColor: template.defaultColor,
        dropHoverZone: null,
        stickers: [],
        selectedStickerGroupId: null,
        stickerMode: false,
      });
    },

    setActiveSurface: (surface) => set({ activeSurface: surface, selectedZoneIds: [surface] }),

    setSelectedZones: (ids) => {
      if (ids.length === 0) return;
      set({ selectedZoneIds: ids, activeSurface: ids[ids.length - 1] });
    },

    toggleZoneInSelection: (id) => {
      const state = get();
      const already = state.selectedZoneIds.includes(id);
      const next = already
        ? state.selectedZoneIds.filter((z) => z !== id)
        : [...state.selectedZoneIds, id];
      // If deselecting the last zone, fall back to the primary surface
      const fallback = templates.find((t) => t.id === state.activeTemplateId)?.surfaces[0] ?? "body";
      const ids = next.length === 0 ? [fallback] : next;
      set({ selectedZoneIds: ids, activeSurface: ids[ids.length - 1] });
    },

    setMultiSelectMode: (on) => set({ multiSelectMode: on }),
    setSinglePaste: (on) => set({ singlePaste: on }),

    saveSinglePasteGroup: () => {
      const state = get();
      if (state.selectedZoneIds.length < 2) return;
      const already = state.singlePasteGroups.some(
        (g) => g.length === state.selectedZoneIds.length && g.every((id) => state.selectedZoneIds.includes(id))
      );
      if (!already) {
        set({ singlePasteGroups: [...state.singlePasteGroups, [...state.selectedZoneIds]] });
      }
    },

    removeSinglePasteGroup: (idx) => {
      const state = get();
      set({ singlePasteGroups: state.singlePasteGroups.filter((_, i) => i !== idx) });
    },

    addCustomGroup: (label) => {
      const state = get();
      const id = `custom_${Date.now()}`;
      set({
        customGroups: [
          ...state.customGroups,
          { id, label, zoneIds: [...state.selectedZoneIds], isPredefined: false },
        ],
      });
    },

    removeCustomGroup: (groupId) => {
      const state = get();
      set({ customGroups: state.customGroups.filter((g) => g.id !== groupId) });
    },

    setZoneColor: (surface, color) => {
      const state = get();
      const targets =
        state.selectedZoneIds.includes(surface) && state.selectedZoneIds.length > 1
          ? state.selectedZoneIds
          : [surface];
      const newTextures = { ...state.surfaceTextures };
      for (const t of targets) {
        newTextures[t] = { ...newTextures[t], color };
      }
      set({
        undoStack: [...state.undoStack.slice(-19), createSnapshot(state)],
        redoStack: [],
        surfaceTextures: newTextures,
      });
    },

    setBaseColor: (color) => {
      const state = get();
      set({
        undoStack: [...state.undoStack.slice(-19), createSnapshot(state)],
        redoStack: [],
        baseColor: color,
      });
    },

    setFinish: (finish) => {
      const state = get();
      set({
        undoStack: [...state.undoStack.slice(-19), createSnapshot(state)],
        redoStack: [],
        finish,
      });
    },

    setOpacity: (opacity) => set({ opacity }),

    setBackgroundColor: (color) => {
      const state = get();
      set({
        undoStack: [...state.undoStack.slice(-19), createSnapshot(state)],
        redoStack: [],
        backgroundColor: color,
      });
    },

    setExportResolution: (res) => set({ exportResolution: res }),
    setExportFormat: (fmt) => set({ exportFormat: fmt }),

    uploadTexture: (surface, imageUrl) => {
      const state = get();
      const targets =
        state.selectedZoneIds.includes(surface) && state.selectedZoneIds.length > 1
          ? state.selectedZoneIds
          : [surface];
      const newTextures = { ...state.surfaceTextures };
      for (const t of targets) {
        newTextures[t] = { ...newTextures[t], imageUrl };
      }
      set({
        undoStack: [...state.undoStack.slice(-19), createSnapshot(state)],
        redoStack: [],
        surfaceTextures: newTextures,
      });
    },

    removeTexture: (surface) => {
      const state = get();
      const targets =
        state.selectedZoneIds.includes(surface) && state.selectedZoneIds.length > 1
          ? state.selectedZoneIds
          : [surface];
      const newTextures = { ...state.surfaceTextures };
      for (const t of targets) {
        newTextures[t] = { ...newTextures[t], imageUrl: null };
      }
      set({
        undoStack: [...state.undoStack.slice(-19), createSnapshot(state)],
        redoStack: [],
        surfaceTextures: newTextures,
      });
    },

    updateTextureTransform: (surface, updates) => {
      const state = get();
      const targets =
        state.selectedZoneIds.includes(surface) && state.selectedZoneIds.length > 1
          ? state.selectedZoneIds
          : [surface];
      const newTextures = { ...state.surfaceTextures };
      for (const t of targets) {
        newTextures[t] = { ...newTextures[t], ...updates };
      }
      set({ surfaceTextures: newTextures });
    },

    undo: () => {
      const state = get();
      if (state.undoStack.length === 0) return;
      const prev = state.undoStack[state.undoStack.length - 1];
      set({
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, createSnapshot(state)],
        surfaceTextures: prev.surfaceTextures,
        baseColor: prev.baseColor,
        finish: prev.finish,
        backgroundColor: prev.backgroundColor,
        stickers: prev.stickers,
        selectedStickerGroupId: null,
      });
    },

    redo: () => {
      const state = get();
      if (state.redoStack.length === 0) return;
      const next = state.redoStack[state.redoStack.length - 1];
      set({
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, createSnapshot(state)],
        surfaceTextures: next.surfaceTextures,
        baseColor: next.baseColor,
        finish: next.finish,
        backgroundColor: next.backgroundColor,
        stickers: next.stickers,
        selectedStickerGroupId: null,
      });
    },
    // Sticker actions
    setStickerMode: (on) => set({ stickerMode: on }),

    addSticker: (sticker) => {
      const state = get();
      set({ stickers: [...state.stickers, sticker] });
    },

    removeSticker: (id) => {
      const state = get();
      const sticker = state.stickers.find((s) => s.id === id);
      const groupId = sticker?.groupId;
      set({
        stickers: state.stickers.filter((s) => s.id !== id),
        selectedStickerGroupId: state.selectedStickerGroupId === groupId ? null : state.selectedStickerGroupId,
      });
    },

    removeStickerGroup: (groupId) => {
      const state = get();
      set({
        stickers: state.stickers.filter((s) => s.groupId !== groupId),
        selectedStickerGroupId: state.selectedStickerGroupId === groupId ? null : state.selectedStickerGroupId,
      });
    },

    updateSticker: (id, updates) => {
      const state = get();
      set({
        stickers: state.stickers.map((s) =>
          s.id === id ? { ...s, ...updates } : s
        ),
      });
    },

    updateStickerGroup: (groupId, updates) => {
      const state = get();
      set({
        stickers: state.stickers.map((s) =>
          s.groupId === groupId ? { ...s, ...updates } : s
        ),
      });
    },

    moveStickerGroup: (groupId, newStickers) => {
      const state = get();
      const preserved = state.stickers.filter((s) => s.groupId !== groupId);
      const added = newStickers.map((s) => ({ ...s, id: crypto.randomUUID() }));
      set({ stickers: [...preserved, ...added] });
    },

    selectSticker: (groupId) => set({ selectedStickerGroupId: groupId }),
  })
);
