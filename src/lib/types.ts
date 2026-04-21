export type PackagingCategory =
  | "boxes"
  | "bottles"
  | "cans"
  | "pouches"
  | "tubes"
  | "cups"
  | "vehicles";

export type FinishType = "matte" | "glossy" | "metallic" | "kraft";

export interface CanvasZone {
  id: string;    // matches mesh name in the GLB (e.g., "hood")
  label: string; // human-readable label (e.g., "Hood")
}

export interface ZoneGroup {
  id: string;
  label: string;
  zoneIds: string[];
  isPredefined: boolean;
}

export interface PackagingTemplate {
  id: string;
  name: string;
  category: PackagingCategory;
  description: string;
  surfaces: string[]; // named surfaces that accept artwork
  canvasZones?: CanvasZone[]; // independently addressable mesh zones (vehicles, etc.)
  zoneGroups?: ZoneGroup[]; // predefined multi-zone groupings (e.g. Racing Stripe)
  defaultColor: string;
  thumbnail: string; // we'll render these dynamically
}

export interface SurfaceTexture {
  surfaceName: string;
  imageUrl: string | null;
  color: string | null; // per-zone color override; null = inherit body color
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
  mirrorX: boolean;
}

export interface Sticker {
  id: string;
  // Stickers sharing the same groupId are one logical sticker spanning multiple meshes
  groupId: string;
  imageUrl: string;
  // Position in WORLD space (DecalGeometry expects world-space)
  position: { x: number; y: number; z: number };
  // Surface normal in WORLD space
  normal: { x: number; y: number; z: number };
  // Size in world units
  size: number;
  // Z-rotation of sticker (radians)
  rotation: number;
  // Which mesh this is projected onto (mesh.name or mesh.uuid)
  meshName: string;
}

export interface EditorState {
  // Template
  activeTemplateId: string;
  templates: PackagingTemplate[];

  // Surfaces & textures
  activeSurface: string;
  selectedZoneIds: string[]; // multi-selection (always includes activeSurface)
  multiSelectMode: boolean;
  singlePaste: boolean;      // span one image across all selected zones instead of tiling per-zone
  customGroups: ZoneGroup[];  // user-created zone groups (session-only)
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

  // Single paste groups — saved zone groupings that keep world-space UV permanently
  singlePasteGroups: string[][];

  // Stickers
  stickers: Sticker[];
  selectedStickerGroupId: string | null;
  stickerMode: boolean; // when true, drops create stickers; when false, drops fill zones

  // Drag-and-drop
  dropHoverZone: string | null; // zone currently glowing during drag

  // History
  undoStack: EditorSnapshot[];
  redoStack: EditorSnapshot[];
}

export interface EditorSnapshot {
  surfaceTextures: Record<string, SurfaceTexture>;
  baseColor: string;
  finish: FinishType;
  backgroundColor: string;
  stickers: Sticker[];
}
