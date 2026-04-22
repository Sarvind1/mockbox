"use client";

interface CarDiagramProps {
  selectedZoneIds: string[];
  onToggleZone: (zoneId: string) => void;
  panelColors: Record<string, string | null>;
}

// Top-down sedan panel layout: [x, y, width, height] in a 240x184 viewBox
const PANEL_BOXES: Record<string, { label: string; box: [number, number, number, number] }> = {
  bumper_front: { label: "Front Bumper", box: [70, 4, 100, 13] },
  hood:         { label: "Hood",         box: [45, 17, 150, 47] },
  roof:         { label: "Roof",         box: [50, 64, 140, 64] },
  trunk:        { label: "Trunk",        box: [50, 128, 140, 38] },
  bumper_rear:  { label: "Rear Bumper",  box: [70, 166, 100, 13] },
  fender_f_l:   { label: "Fender FL",    box: [26, 17, 20, 48] },
  door_f_l:     { label: "Door FL",      box: [16, 65, 36, 35] },
  door_r_l:     { label: "Door RL",      box: [16, 100, 36, 30] },
  quarter_r_l:  { label: "Quarter RL",   box: [26, 130, 20, 38] },
  rocker_l:     { label: "Rocker L",     box: [8, 65, 9, 65] },
  fender_f_r:   { label: "Fender FR",    box: [194, 17, 20, 48] },
  door_f_r:     { label: "Door FR",      box: [188, 65, 36, 35] },
  door_r_r:     { label: "Door RR",      box: [188, 100, 36, 30] },
  quarter_r_r:  { label: "Quarter RR",   box: [194, 130, 20, 38] },
  // Additional zones for other vehicles (mapped same positions)
  door_l:       { label: "Door L",       box: [16, 65, 36, 65] },
  door_r:       { label: "Door R",       box: [188, 65, 36, 65] },
  tailgate:     { label: "Tailgate",     box: [50, 128, 140, 38] },
  engine_lid:   { label: "Engine Lid",   box: [50, 128, 140, 38] },
  body_misc:    { label: "Body",         box: [8, 130, 9, 38] },
};

export function CarDiagram({ selectedZoneIds, onToggleZone, panelColors }: CarDiagramProps) {
  return (
    <svg viewBox="0 0 240 184" className="w-full h-auto">
      {/* Body silhouette */}
      <path
        d="M72 4 L168 4 Q200 4 214 18 L216 18 L228 38 Q236 50 236 65 L236 130 Q236 145 228 156 L216 166 L168 180 L72 180 L24 166 L12 156 Q4 145 4 130 L4 65 Q4 50 12 38 L24 18 L26 18 Q40 4 72 4Z"
        className="fill-[var(--wrap-surf2,theme(colors.muted))] stroke-[var(--wrap-bdr2,theme(colors.border))]"
        strokeWidth="1"
      />
      {/* Windows */}
      <rect x="58" y="64" width="124" height="62" rx="3" className="fill-background opacity-60" />

      {Object.entries(PANEL_BOXES).map(([id, { box: [x, y, w, h] }]) => {
        const isSelected = selectedZoneIds.includes(id);
        const color = panelColors[id];
        return (
          <g key={id} onClick={() => onToggleZone(id)} className="cursor-pointer">
            <rect
              x={x} y={y} width={w} height={h} rx={2}
              fill={color || (isSelected ? "var(--primary)" : "var(--wrap-surf2, hsl(var(--muted)))")}
              stroke={isSelected ? "var(--primary)" : color ? "rgba(255,255,255,0.15)" : "var(--border)"}
              strokeWidth={isSelected ? 1.5 : 0.8}
              opacity={isSelected ? 1 : color ? 1 : 0.85}
              className="transition-all duration-150"
              style={{ filter: isSelected && !color ? "brightness(1.1)" : "none" }}
            />
            {color && (
              <circle
                cx={x + w - 4} cy={y + 4}
                r={Math.min(3, w / 4, h / 4)}
                fill="rgba(255,255,255,0.5)"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
