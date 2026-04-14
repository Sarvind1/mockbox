export type PackagingCategory =
  | "boxes"
  | "bottles"
  | "cans"
  | "pouches"
  | "tubes"
  | "cups"
  | "vehicles";

export type FinishType = "matte" | "glossy" | "metallic" | "kraft";

export interface PackagingTemplate {
  id: string;
  name: string;
  category: PackagingCategory;
  description: string;
  surfaces: string[]; // named surfaces that accept artwork
  defaultColor: string;
  thumbnail: string; // we'll render these dynamically
}

export interface SurfaceTexture {
  surfaceName: string;
  imageUrl: string | null;
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
}

export interface EditorState {
  // Template
  activeTemplateId: string;
  templates: PackagingTemplate[];

  // Surfaces & textures
  activeSurface: string;
  surfaceTextures: Record<string, SurfaceTexture>;

  // Material
  baseColor: string;
  finish: FinishType;
  opacity: number;

  // Background
  backgroundColor: string;

  // Export
  exportResolution: "1080p" | "2k" | "4k";
  exportFormat: "png" | "jpg";

  // History
  undoStack: EditorSnapshot[];
  redoStack: EditorSnapshot[];
}

export interface EditorSnapshot {
  surfaceTextures: Record<string, SurfaceTexture>;
  baseColor: string;
  finish: FinishType;
  backgroundColor: string;
}
