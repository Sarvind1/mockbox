"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { PatternPreview } from "./PatternPreview";
import { FinishType } from "@/lib/types";

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

// ─── WRAP MODE DATA ─────────────────────────────────────────────────────────

const AUTOMOTIVE_COLORS = [
  { h: "#0d0d10", l: "Phantom Black" }, { h: "#f0ede8", l: "Pearl White" }, { h: "#c6ccd5", l: "Glacier Silver" },
  { h: "#1b2540", l: "Midnight Navy" }, { h: "#2e3138", l: "Carbon Gray" }, { h: "#bf2a1e", l: "Racing Red" },
  { h: "#1c3fa8", l: "Cobalt Blue" }, { h: "#efc020", l: "Signal Yellow" }, { h: "#1d4230", l: "Forest Green" },
  { h: "#c44c12", l: "Burnt Orange" }, { h: "#c49080", l: "Rose Gold" }, { h: "#0fa3b1", l: "Electric Teal" },
  { h: "#ece8e3", l: "Ceramic White" }, { h: "#4a4d54", l: "Stealth Gray" }, { h: "#7c3eb8", l: "Candy Purple" },
  { h: "#c9ad7a", l: "Champagne Gold" }, { h: "#4a5240", l: "Matte Army" }, { h: "#5baad0", l: "Sky Blue" },
];

const WRAP_FINISHES: { id: FinishType; l: string }[] = [
  { id: "glossy", l: "Gloss" }, { id: "matte", l: "Matte" },
  { id: "metallic", l: "Metallic" }, { id: "chrome", l: "Chrome" },
];

const PATTERNS = [
  { id: "carbon", l: "Carbon", cat: "texture" },
  { id: "check", l: "Checker", cat: "racing" },
  { id: "stripe", l: "Rally", cat: "racing" },
  { id: "dots", l: "Dots", cat: "geo" },
];

const STICKERS = [
  { id: "star", l: "Star" },
  { id: "bolt", l: "Lightning" },
  { id: "flame", l: "Flame" },
  { id: "skull", l: "Skull" },
];

const FONTS = ["Space Grotesk", "Inter", "Impact", "Georgia", "Courier New", "Arial Black"];

type WrapTool = "coat" | "graphics";

// ─── WRAP SIDEBAR ────────────────────────────────────────────────────────────

const vehicleTemplates = templates.filter((t) => t.category === "vehicles");

function WrapSidebar() {
  const router = useRouter();
  const selectedZoneIds = useEditorStore((s) => s.selectedZoneIds);
  const setSelectedZones = useEditorStore((s) => s.setSelectedZones);
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);
  const setZoneColor = useEditorStore((s) => s.setZoneColor);
  const setBaseColor = useEditorStore((s) => s.setBaseColor);
  const finish = useEditorStore((s) => s.finish);
  const setFinish = useEditorStore((s) => s.setFinish);
  const setStickerMode = useEditorStore((s) => s.setStickerMode);

  const paintBrushMode = useEditorStore((s) => s.paintBrushMode);
  const paintBrushSize = useEditorStore((s) => s.paintBrushSize);
  const setPaintBrushMode = useEditorStore((s) => s.setPaintBrushMode);
  const setPaintBrushColor = useEditorStore((s) => s.setPaintBrushColor);
  const triggerBrushAction = useEditorStore((s) => s.triggerBrushAction);

  const uploadTexture = useEditorStore((s) => s.uploadTexture);
  const removeTexture = useEditorStore((s) => s.removeTexture);
  const updateTextureTransform = useEditorStore((s) => s.updateTextureTransform);
  const activeSurface = useEditorStore((s) => s.activeSurface);

  const [tool, setTool] = useState<WrapTool>("coat");
  const toolRef = useRef(tool);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  const [coatSub, setCoatSub] = useState<"color" | "patterns">("color");
  const [gfxSub, setGfxSub] = useState<"stickers" | "text">("stickers");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [txtContent, setTxtContent] = useState("YOUR TEXT");
  const [txtFont, setTxtFont] = useState("Space Grotesk");
  const [txtColor, setTxtColor] = useState("#ffffff");
  const [txtSize, setTxtSize] = useState(48);
  const [txtWeight, setTxtWeight] = useState("700");
  const [activeHex, setActiveHex] = useState("#1b2540");
  const [activePattern, setActivePattern] = useState<string | null>(null);
  const [patternScale, setPatternScale] = useState(1);
  const [patternRotation, setPatternRotation] = useState(0);

  const panelColors: Record<string, string | null> = {};
  for (const [id, tex] of Object.entries(surfaceTextures)) {
    if (tex.color) panelColors[id] = tex.color;
  }

  const numSel = selectedZoneIds.length;

  const applyColor = (hex: string) => {
    setActiveHex(hex);
    setPaintBrushColor(hex);
    if (paintBrushMode) return; // Don't apply to zones in paint mode
    if (numSel > 0) {
      selectedZoneIds.forEach((id) => setZoneColor(id, hex));
    } else {
      setBaseColor(hex);
    }
  };

  const [customDecals, setCustomDecals] = useState<{ id: string; label: string; url: string }[]>([]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-upload of same file
    if (!file) return;
    const url = URL.createObjectURL(file);
    const currentTool = toolRef.current;
    if (currentTool === "graphics") {
      const name = file.name.replace(/\.[^.]+$/, "");
      setCustomDecals((prev) => [...prev, { id: `custom-${Date.now()}`, label: name, url }]);
    } else {
      uploadTexture(activeSurface, url);
    }
  }, [uploadTexture, activeSurface]);

  const TOOL_BTNS: { id: WrapTool; icon: string; label: string }[] = [
    { id: "coat", icon: "\u2B24", label: "Coat" },
    { id: "graphics", icon: "\u2726", label: "Graphics" },
  ];

  return (
    <div className="w-[252px] bg-card border-r border-border flex flex-col shrink-0 overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      {/* Vehicle model picker */}
      <div className="p-2.5 pb-2 shrink-0">
        <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mb-1.5 px-0.5">Vehicle</div>
        <div className="flex flex-col gap-1">
          {vehicleTemplates.map((t) => {
            const isActive = activeTemplateId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  useEditorStore.getState().setTemplate(t.id);
                  router.replace(`/wrap/${t.id}`, { scroll: false });
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all w-full text-left"
                style={{
                  borderColor: isActive ? "var(--primary)" : "var(--border)",
                  background: isActive ? "var(--wrap-accent-dim, color-mix(in srgb, var(--primary) 12%, transparent))" : "var(--wrap-surf2, var(--muted))",
                  color: isActive ? "var(--primary)" : "var(--muted-foreground)",
                }}
              >
                <Car className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[11px] font-semibold">{t.name}</span>
              </button>
            );
          })}
        </div>
        {numSel > 0 ? (
          <div className="mt-2 text-[11px] font-semibold text-primary flex justify-between px-0.5">
            <span>{numSel} panel{numSel > 1 ? "s" : ""} selected</span>
            <button onClick={() => setSelectedZones([])} className="text-[10px] text-muted-foreground">
              Clear {"\u00D7"}
            </button>
          </div>
        ) : (
          <div className="mt-1.5 text-[10px] text-muted-foreground px-0.5">
            Click panels in 3D view or use groups on the right
          </div>
        )}
      </div>

      {/* Finish */}
      <div className="px-2.5 pb-2 shrink-0">
        <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mb-1.5 px-0.5">Finish</div>
        <div className="grid grid-cols-4 gap-1">
          {WRAP_FINISHES.map((f) => (
            <button
              key={f.id}
              onClick={() => setFinish(f.id)}
              className="py-1 px-1 rounded-md text-[10px] font-semibold border transition-all"
              style={{
                background: finish === f.id ? "var(--wrap-accent-dim)" : "var(--wrap-surf2, var(--muted))",
                color: finish === f.id ? "var(--primary)" : "var(--muted-foreground)",
                borderColor: finish === f.id ? "var(--primary)" : "var(--border)",
              }}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Tool strip */}
      <div className="flex px-2.5 pt-1 pb-2.5 gap-1 shrink-0">
        {TOOL_BTNS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTool(t.id);
              setStickerMode(t.id === "graphics");
              if (t.id === "graphics") setPaintBrushMode(false);
            }}
            className="flex-1 py-1.5 px-1 rounded-lg text-[11px] font-bold flex flex-col items-center gap-0.5 border transition-all"
            style={{
              background: tool === t.id ? "var(--wrap-accent-dim)" : "var(--wrap-surf2, var(--muted))",
              color: tool === t.id ? "var(--primary)" : "var(--muted-foreground)",
              borderColor: tool === t.id ? "var(--primary)" : "var(--border)",
            }}
          >
            <span className={tool === t.id ? "text-[13px]" : "text-[11px]"}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tool content */}
      <div className="flex-1 overflow-y-auto px-2.5 pt-1 pb-3">
        {/* COAT */}
        {tool === "coat" && (
          <>
            <div className="flex gap-1 mb-2.5">
              {([["color", "Color"], ["patterns", "Patterns"]] as const).map(([id, lbl]) => (
                <button
                  key={id}
                  onClick={() => { setCoatSub(id); setPaintBrushMode(false); }}
                  className="flex-1 py-1 rounded-md text-[10.5px] font-bold border transition-all"
                  style={{
                    background: coatSub === id ? "var(--wrap-accent-dim)" : "var(--wrap-surf2, var(--muted))",
                    color: coatSub === id ? "var(--primary)" : "var(--muted-foreground)",
                    borderColor: coatSub === id ? "var(--primary)" : "var(--border)",
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {coatSub === "color" && (
              <>
                <div className="flex flex-col gap-1 mb-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        if (paintBrushMode === "zone") {
                          setPaintBrushMode(false);
                          useEditorStore.getState().clearZonePaintHistory();
                        } else {
                          setPaintBrushMode("zone");
                          setPaintBrushColor(activeHex);
                        }
                      }}
                      className="flex-1 py-1.5 rounded-md text-[10.5px] font-bold border transition-all flex items-center justify-center gap-1"
                      style={{
                        background: paintBrushMode === "zone" ? "var(--wrap-accent-dim)" : "var(--wrap-surf2, var(--muted))",
                        color: paintBrushMode === "zone" ? "var(--primary)" : "var(--muted-foreground)",
                        borderColor: paintBrushMode === "zone" ? "var(--primary)" : "var(--border)",
                      }}
                    >
                      {"\uD83C\uDFA8"} Paint Zone
                    </button>
                    <button
                      onClick={() => {
                        const next = paintBrushMode === "brush" ? false : "brush" as const;
                        setPaintBrushMode(next);
                        if (next) setPaintBrushColor(activeHex);
                      }}
                      className="flex-1 py-1.5 rounded-md text-[10.5px] font-bold border transition-all flex items-center justify-center gap-1"
                      style={{
                        background: paintBrushMode === "brush" ? "var(--wrap-accent-dim)" : "var(--wrap-surf2, var(--muted))",
                        color: paintBrushMode === "brush" ? "var(--primary)" : "var(--muted-foreground)",
                        borderColor: paintBrushMode === "brush" ? "var(--primary)" : "var(--border)",
                      }}
                    >
                      {"\uD83D\uDD8C\uFE0F"} Paint Brush
                    </button>
                  </div>
                  {paintBrushMode === "zone" && (
                    <div className="flex gap-1.5 mt-1">
                      <button
                        onClick={() => useEditorStore.getState().undoZonePaint()}
                        className="flex-1 py-1 rounded-md text-[10px] font-semibold border transition-all"
                        style={{
                          background: "var(--wrap-surf2, var(--muted))",
                          color: "var(--muted-foreground)",
                          borderColor: "var(--border)",
                        }}
                      >
                        Undo
                      </button>
                    </div>
                  )}
                  {paintBrushMode === "brush" && (
                    <>
                    <div className="mt-1 mb-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground">Brush Size</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{paintBrushSize.toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        step="1"
                        value={Math.round(Math.log(paintBrushSize / 0.05) / Math.log(2 / 0.05) * 100)}
                        onChange={(e) => {
                          const t = parseInt(e.target.value) / 100;
                          const size = Math.round(0.05 * Math.pow(2 / 0.05, t) * 100) / 100;
                          useEditorStore.getState().setPaintBrushSize(size);
                        }}
                        className="w-full h-1 accent-primary"
                      />
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => triggerBrushAction("undo")}
                        className="flex-1 px-2 py-1.5 rounded-md text-[10px] font-bold border transition-all"
                        style={{
                          background: "var(--wrap-surf2, var(--muted))",
                          color: "var(--muted-foreground)",
                          borderColor: "var(--border)",
                        }}
                        title="Undo last brush stroke"
                      >
                        Undo
                      </button>
                      <button
                        onClick={() => triggerBrushAction("clear")}
                        className="flex-1 px-2 py-1.5 rounded-md text-[10px] font-bold border transition-all"
                        style={{
                          background: "var(--wrap-surf2, var(--muted))",
                          color: "var(--muted-foreground)",
                          borderColor: "var(--border)",
                        }}
                        title="Clear all brush strokes"
                      >
                        Clear
                      </button>
                    </div>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-6 gap-1 mb-2.5">
                  {AUTOMOTIVE_COLORS.map((c) => (
                    <button
                      key={c.h}
                      onClick={() => applyColor(c.h)}
                      title={c.l}
                      className="aspect-square rounded-md border transition-all"
                      style={{
                        background: c.h,
                        borderColor: activeHex === c.h ? "var(--primary)" : "rgba(255,255,255,0.07)",
                        transform: activeHex === c.h ? "scale(1.15)" : "scale(1)",
                        boxShadow: activeHex === c.h ? "0 0 0 2px var(--background), 0 0 0 3.5px var(--primary)" : "none",
                      }}
                    />
                  ))}
                </div>
                <div className="flex gap-2 items-center p-1.5 rounded-lg border border-border" style={{ background: "var(--wrap-surf2, var(--muted))" }}>
                  <div className="relative w-7 h-7 rounded-md overflow-hidden border border-border shrink-0">
                    <div className="absolute inset-0 pointer-events-none" style={{ background: activeHex }} />
                    <input
                      type="color"
                      value={activeHex}
                      onChange={(e) => applyColor(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="text-[9px] text-muted-foreground mb-0.5">Custom</div>
                    <div className="text-[11px] font-mono font-semibold">{activeHex}</div>
                  </div>
                  {numSel === 0 && (
                    <div className="ml-auto text-[9.5px] text-muted-foreground leading-tight text-right">
                      Select<br />panels first
                    </div>
                  )}
                </div>
                {numSel > 0 && (
                  <div className="flex gap-1.5 mt-2">
                    <button
                      onClick={() => {
                        selectedZoneIds.forEach((id) => setZoneColor(id, activeHex));
                        setSelectedZones([]);
                      }}
                      className="flex-1 py-1.5 rounded-md text-[10px] font-semibold border transition-all"
                      style={{
                        background: "var(--wrap-accent-dim)",
                        color: "var(--primary)",
                        borderColor: "var(--primary)",
                      }}
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => selectedZoneIds.forEach((id) => { setZoneColor(id, null); removeTexture(id); })}
                      className="flex-1 py-1.5 rounded-md text-[10px] font-semibold border transition-all"
                      style={{
                        background: "var(--wrap-surf2, var(--muted))",
                        color: "var(--muted-foreground)",
                        borderColor: "var(--border)",
                      }}
                    >
                      Reset
                    </button>
                  </div>
                )}
              </>
            )}


            {coatSub === "patterns" && (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  {PATTERNS.map((p) => {
                    const isActive = activePattern === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setActivePattern(p.id);
                          if (numSel > 0) {
                            const patUrl = `/presets/${p.id}.png`;
                            const store = useEditorStore.getState();
                            const newTextures = { ...store.surfaceTextures };
                            for (const id of selectedZoneIds) {
                              newTextures[id] = {
                                ...newTextures[id],
                                imageUrl: patUrl,
                                scale: patternScale,
                                rotation: patternRotation * Math.PI / 180,
                              };
                            }
                            useEditorStore.setState({ surfaceTextures: newTextures });
                          }
                        }}
                        className="rounded-lg border overflow-hidden transition-all"
                        style={{
                          borderColor: isActive ? "var(--primary)" : "var(--border)",
                          background: isActive ? "var(--wrap-accent-dim)" : "var(--wrap-surf2, var(--muted))",
                        }}
                      >
                        <div className="h-11 flex items-center justify-center">
                          <PatternPreview id={p.id} size={60} />
                        </div>
                        <div
                          className="px-1.5 py-1 text-[10px] font-semibold truncate text-center"
                          style={{ color: isActive ? "var(--primary)" : "var(--muted-foreground)", background: "var(--background)" }}
                        >
                          {p.l}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {activePattern && (
                  <>
                    <div className="mt-2 mb-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground">Scale</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{patternScale.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={Math.round(Math.log(patternScale / 0.1) / Math.log(5 / 0.1) * 100)}
                        onChange={(e) => {
                          const t = parseInt(e.target.value) / 100;
                          const newScale = Math.round(0.1 * Math.pow(5 / 0.1, t) * 100) / 100;
                          setPatternScale(newScale);
                          // Auto-apply scale change to zones that already have this pattern
                          if (activePattern && numSel > 0) {
                            const store = useEditorStore.getState();
                            const patUrl = `/presets/${activePattern}.png`;
                            const newTextures = { ...store.surfaceTextures };
                            let changed = false;
                            for (const id of selectedZoneIds) {
                              if (newTextures[id]?.imageUrl === patUrl) {
                                newTextures[id] = { ...newTextures[id], scale: newScale, rotation: patternRotation * Math.PI / 180 };
                                changed = true;
                              }
                            }
                            if (changed) useEditorStore.setState({ surfaceTextures: newTextures });
                          }
                        }}
                        className="w-full h-1 accent-primary"
                      />
                    </div>
                    <div className="mb-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground">Rotation</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{patternRotation}°</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        step="5"
                        value={patternRotation}
                        onChange={(e) => {
                          const newRot = parseInt(e.target.value);
                          setPatternRotation(newRot);
                          // Auto-apply rotation change to zones that already have this pattern
                          if (activePattern && numSel > 0) {
                            const store = useEditorStore.getState();
                            const patUrl = `/presets/${activePattern}.png`;
                            const newTextures = { ...store.surfaceTextures };
                            let changed = false;
                            for (const id of selectedZoneIds) {
                              if (newTextures[id]?.imageUrl === patUrl) {
                                newTextures[id] = { ...newTextures[id], scale: patternScale, rotation: newRot * Math.PI / 180 };
                                changed = true;
                              }
                            }
                            if (changed) useEditorStore.setState({ surfaceTextures: newTextures });
                          }
                        }}
                        className="w-full h-1 accent-primary"
                      />
                    </div>
                  </>
                )}
                {numSel > 0 && activePattern && (
                  <div className="flex gap-1.5 mt-2">
                    <button
                      onClick={() => {
                        const patUrl = `/presets/${activePattern}.png`;
                        const store = useEditorStore.getState();
                        const newTextures = { ...store.surfaceTextures };
                        for (const id of selectedZoneIds) {
                          newTextures[id] = {
                            ...newTextures[id],
                            imageUrl: patUrl,
                            scale: patternScale,
                            rotation: patternRotation * Math.PI / 180,
                          };
                        }
                        store.pushUndo();
                        useEditorStore.setState({ surfaceTextures: newTextures });
                      }}
                      className="flex-1 py-1.5 rounded-md text-[10px] font-semibold border transition-all"
                      style={{
                        background: "var(--wrap-accent-dim)",
                        color: "var(--primary)",
                        borderColor: "var(--primary)",
                      }}
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => {
                        selectedZoneIds.forEach((id) => removeTexture(id));
                        setActivePattern(null);
                        setPatternScale(1);
                        setPatternRotation(0);
                      }}
                      className="flex-1 py-1.5 rounded-md text-[10px] font-semibold border transition-all"
                      style={{
                        background: "var(--wrap-surf2, var(--muted))",
                        color: "var(--muted-foreground)",
                        borderColor: "var(--border)",
                      }}
                    >
                      Reset
                    </button>
                  </div>
                )}
                {numSel === 0 && activePattern && (
                  <div className="mt-2 text-[10px] text-muted-foreground text-center px-1">
                    Select panels first, then click Apply
                  </div>
                )}
                {numSel > 0 && !activePattern && selectedZoneIds.some((id) => surfaceTextures[id]?.imageUrl) && (
                  <button
                    onClick={() => {
                      selectedZoneIds.forEach((id) => removeTexture(id));
                    }}
                    className="mt-2 w-full py-1.5 rounded-md text-[10px] font-semibold border transition-all"
                    style={{
                      background: "var(--wrap-surf2, var(--muted))",
                      color: "var(--muted-foreground)",
                      borderColor: "var(--border)",
                    }}
                  >
                    Remove Pattern
                  </button>
                )}
              </>
            )}
          </>
        )}

        {tool === "graphics" && (
          <>
            <div className="flex gap-1 mb-2.5">
              {([["stickers", "Stickers"], ["text", "Text"]] as const).map(([id, lbl]) => (
                <button
                  key={id}
                  onClick={() => setGfxSub(id)}
                  className="flex-1 py-1 rounded-md text-[10.5px] font-bold border transition-all"
                  style={{
                    background: gfxSub === id ? "var(--wrap-accent-dim)" : "var(--wrap-surf2, var(--muted))",
                    color: gfxSub === id ? "var(--primary)" : "var(--muted-foreground)",
                    borderColor: gfxSub === id ? "var(--primary)" : "var(--border)",
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {gfxSub === "stickers" && (<>
            <div className="text-[10px] text-muted-foreground mb-2 px-2 py-1 rounded-md border border-border" style={{ background: "var(--wrap-surf2, var(--muted))" }}>
              {"\u2193"} Drag onto car to place
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[...STICKERS.map((s) => ({ id: s.id, l: s.l, type: "sticker" as const, url: undefined as string | undefined })), ...customDecals.map((d) => ({ id: d.id, l: d.label, type: "custom" as const, url: d.url }))].map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", item.type === "custom" ? item.url! : `/presets/${item.id}.png`);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  className="rounded-lg border border-border overflow-hidden cursor-grab select-none hover:border-primary transition-colors"
                  style={{ background: "var(--wrap-surf2, var(--muted))" }}
                >
                  <div className="h-11 flex items-center justify-center overflow-hidden">
                    {item.type === "custom" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.url} alt={item.l} className="h-full w-full object-contain" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/presets/${item.id}.png`} alt={item.l} className="h-full w-full object-contain p-1" />
                    )}
                  </div>
                  <div className="px-1.5 py-1 text-[10px] font-semibold text-muted-foreground truncate" style={{ background: "var(--background)" }}>
                    {item.l}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 w-full p-2.5 rounded-lg border-2 border-dashed border-border text-center text-muted-foreground text-[10.5px] font-medium hover:border-primary transition-colors cursor-pointer"
            >
              {"\u2191"} Upload image
            </button>
            </>)}

            {gfxSub === "text" && (<>
            <div className="mb-2">
              <div className="text-[10px] text-muted-foreground mb-1">Content</div>
              <textarea
                rows={2}
                value={txtContent}
                onChange={(e) => setTxtContent(e.target.value)}
                className="w-full bg-input border border-border rounded-md p-1.5 text-[13px] text-foreground resize-none focus:border-primary outline-none"
                style={{ fontFamily: txtFont, fontWeight: Number(txtWeight), color: txtColor }}
              />
            </div>
            <div className="mb-2">
              <div className="text-[10px] text-muted-foreground mb-1">Font</div>
              <select
                value={txtFont}
                onChange={(e) => setTxtFont(e.target.value)}
                className="w-full bg-input border border-border rounded-md p-1.5 text-foreground text-xs focus:border-primary outline-none"
              >
                {FONTS.map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <div>
                <div className="text-[10px] text-muted-foreground mb-1">Weight</div>
                <select
                  value={txtWeight}
                  onChange={(e) => setTxtWeight(e.target.value)}
                  className="w-full bg-input border border-border rounded-md p-1.5 text-foreground text-xs focus:border-primary outline-none"
                >
                  {[["400", "Regular"], ["600", "Semibold"], ["700", "Bold"], ["900", "Black"]].map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground mb-1">Size</div>
                <input
                  type="text"
                  value={txtSize}
                  onChange={(e) => setTxtSize(+e.target.value || 48)}
                  className="w-full bg-input border border-border rounded-md p-1.5 text-foreground text-xs text-right focus:border-primary outline-none"
                />
              </div>
            </div>
            <div className="mb-2.5">
              <div className="text-[10px] text-muted-foreground mb-1">Color</div>
              <div className="flex gap-1.5 items-center">
                <div className="relative w-[30px] h-[30px] rounded-md overflow-hidden border border-border shrink-0">
                  <div className="absolute inset-0 pointer-events-none" style={{ background: txtColor }} />
                  <input
                    type="color"
                    value={txtColor}
                    onChange={(e) => setTxtColor(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
                <input
                  type="text"
                  value={txtColor}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^#[0-9a-fA-F]{6}$/.test(v)) setTxtColor(v);
                  }}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (/^#[0-9a-fA-F]{6}$/.test(v)) setTxtColor(v);
                  }}
                  className="flex-1 px-2 py-1 rounded border border-border font-mono text-[11px]"
                  style={{ background: "var(--wrap-surf2, var(--muted))" }}
                />
              </div>
            </div>
            <div className="mb-2 p-2.5 rounded-lg border border-border bg-background min-h-[52px] flex items-center justify-center overflow-hidden">
              <span
                className="text-center break-words leading-tight"
                style={{
                  fontFamily: txtFont,
                  fontWeight: Number(txtWeight),
                  color: txtColor,
                  fontSize: Math.min(txtSize * 0.5, 24),
                }}
              >
                {txtContent || "Your Text"}
              </span>
            </div>
            <div
              draggable
              onDragStart={(e) => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d")!;
                const text = txtContent || "Text";
                const font = `${txtWeight} ${txtSize}px "${txtFont}"`;
                ctx.font = font;
                const metrics = ctx.measureText(text);
                const textWidth = Math.ceil(metrics.width);
                const textHeight = Math.ceil(txtSize * 1.3);
                const pad = Math.ceil(txtSize * 0.2);
                canvas.width = textWidth + pad * 2;
                canvas.height = textHeight + pad * 2;
                ctx.font = font;
                ctx.textBaseline = "top";
                ctx.fillStyle = txtColor;
                ctx.fillText(text, pad, pad);
                const dataUrl = canvas.toDataURL("image/png");
                const dragImg = new Image();
                dragImg.src = dataUrl;
                e.dataTransfer.setDragImage(dragImg, canvas.width / 2, canvas.height / 2);
                e.dataTransfer.setData("text/plain", dataUrl);
                e.dataTransfer.effectAllowed = "copy";
              }}
              className="w-full p-2 rounded-lg text-xs font-bold border text-center cursor-grab select-none"
              style={{
                background: "var(--wrap-accent-dim)",
                color: "var(--primary)",
                borderColor: "var(--primary)",
              }}
            >
              {"\u2605"} Drag to place on car
            </div>
            </>)}
          </>
        )}
      </div>
    </div>
  );
}

// ─── PACKAGING SIDEBAR (original) ────────────────────────────────────────────

function PackagingSidebar() {
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

  const activeGroupId = allGroups.find(
    (g) =>
      g.zoneIds.length === selectedZoneIds.length &&
      g.zoneIds.every((id) => selectedZoneIds.includes(id))
  )?.id ?? null;

  const isMultiSelect = selectedZoneIds.length > 1;
  const canSaveGroup = isMultiSelect && !activeGroupId;

  const handleZoneClick = (zoneId: string, e: React.MouseEvent) => {
    if (multiSelectMode || e.shiftKey) {
      toggleZoneInSelection(zoneId);
    } else if (activeSurface === zoneId && selectedZoneIds.length === 1) {
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
      <div className="p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Templates
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {templates.filter((t) => t.category !== "vehicles").map((t) => {
            const Icon = categoryIcons[t.category] || Box;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setTemplate(t.id);
                  router.replace(`/editor/${t.id}`, { scroll: false });
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
                  if (multiSelectMode) setActiveSurface(activeSurface);
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

        {singlePaste && isMultiSelect && (
          <button
            onClick={() => saveSinglePasteGroup()}
            className="mt-3 w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-primary text-primary text-xs hover:bg-primary/10 transition-colors"
            title="Save this paste layout"
          >
            <Plus className="h-3 w-3" />
            Save paste layout
          </button>
        )}

        {singlePasteGroups.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-1">Saved paste layouts</p>
            <div className="flex flex-col gap-1">
              {singlePasteGroups.map((group, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <button
                    onClick={() => {
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

// ─── EXPORT ──────────────────────────────────────────────────────────────────

export function LeftSidebar({ mode = "packaging" }: { mode?: "packaging" | "wrap" }) {
  if (mode === "wrap") return <WrapSidebar />;
  return <PackagingSidebar />;
}
