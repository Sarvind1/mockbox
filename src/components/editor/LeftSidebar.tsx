"use client";

import { useCallback, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useEditorStore } from "@/lib/store";
import { templates } from "@/lib/templates";
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

export function LeftSidebar() {
  const router = useRouter();
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId);
  const setTemplate = useEditorStore((s) => s.setTemplate);
  const activeSurface = useEditorStore((s) => s.activeSurface);
  const uploadTexture = useEditorStore((s) => s.uploadTexture);
  const removeTexture = useEditorStore((s) => s.removeTexture);
  const surfaceTextures = useEditorStore((s) => s.surfaceTextures);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

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

  return (
    <div className="w-64 border-r bg-white flex flex-col shrink-0 overflow-y-auto">
      {/* Template selector */}
      <div className="p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Templates
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {templates.map((t) => {
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

      <Separator />

      {/* Upload panel */}
      <div className="p-4 flex-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Upload Artwork
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Applying to: <span className="font-medium text-foreground capitalize">{activeSurface}</span>
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
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
        </div>

        <input
          ref={fileInputRef}
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
      </div>
    </div>
  );
}
