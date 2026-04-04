import { create } from "zustand";
import {
  EditorState,
  EditorSnapshot,
  FinishType,
  SurfaceTexture,
} from "./types";
import { templates } from "./templates";

function createSnapshot(state: EditorState): EditorSnapshot {
  return {
    surfaceTextures: JSON.parse(JSON.stringify(state.surfaceTextures)),
    baseColor: state.baseColor,
    finish: state.finish,
    backgroundColor: state.backgroundColor,
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
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      rotation: 0,
    };
  }
  return result;
}

const defaultTemplate = templates[0];

interface EditorActions {
  setTemplate: (templateId: string) => void;
  setActiveSurface: (surface: string) => void;
  setBaseColor: (color: string) => void;
  setFinish: (finish: FinishType) => void;
  setOpacity: (opacity: number) => void;
  setBackgroundColor: (color: string) => void;
  setExportResolution: (res: "1080p" | "2k" | "4k") => void;
  setExportFormat: (fmt: "png" | "jpg") => void;
  uploadTexture: (surface: string, imageUrl: string) => void;
  removeTexture: (surface: string) => void;
  updateTextureTransform: (
    surface: string,
    updates: Partial<Pick<SurfaceTexture, "offsetX" | "offsetY" | "scale" | "rotation">>
  ) => void;
  undo: () => void;
  redo: () => void;
  pushUndo: () => void;
}

export const useEditorStore = create<EditorState & EditorActions>(
  (set, get) => ({
    // State
    activeTemplateId: defaultTemplate.id,
    templates,
    activeSurface: defaultTemplate.surfaces[0],
    surfaceTextures: initSurfaceTextures(defaultTemplate.surfaces),
    baseColor: defaultTemplate.defaultColor,
    finish: "matte" as FinishType,
    opacity: 1,
    backgroundColor: "#f0f0f0",
    exportResolution: "1080p",
    exportFormat: "png",
    undoStack: [],
    redoStack: [],

    // Actions
    pushUndo: () => {
      const state = get();
      set({
        undoStack: [...state.undoStack.slice(-19), createSnapshot(state)],
        redoStack: [],
      });
    },

    setTemplate: (templateId: string) => {
      const template = templates.find((t) => t.id === templateId);
      if (!template) return;
      const state = get();
      set({
        undoStack: [...state.undoStack.slice(-19), createSnapshot(state)],
        redoStack: [],
        activeTemplateId: templateId,
        activeSurface: template.surfaces[0],
        surfaceTextures: initSurfaceTextures(template.surfaces),
        baseColor: template.defaultColor,
      });
    },

    setActiveSurface: (surface) => set({ activeSurface: surface }),

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
      set({
        undoStack: [...state.undoStack.slice(-19), createSnapshot(state)],
        redoStack: [],
        surfaceTextures: {
          ...state.surfaceTextures,
          [surface]: {
            ...state.surfaceTextures[surface],
            imageUrl,
          },
        },
      });
    },

    removeTexture: (surface) => {
      const state = get();
      set({
        undoStack: [...state.undoStack.slice(-19), createSnapshot(state)],
        redoStack: [],
        surfaceTextures: {
          ...state.surfaceTextures,
          [surface]: {
            ...state.surfaceTextures[surface],
            imageUrl: null,
          },
        },
      });
    },

    updateTextureTransform: (surface, updates) => {
      const state = get();
      set({
        surfaceTextures: {
          ...state.surfaceTextures,
          [surface]: {
            ...state.surfaceTextures[surface],
            ...updates,
          },
        },
      });
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
      });
    },
  })
);
