"use client";

import { useCallback } from "react";
import { useEditorStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const resolutions = {
  "1080p": { width: 1920, height: 1080 },
  "2k": { width: 2560, height: 1440 },
  "4k": { width: 3840, height: 2160 },
};

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const exportResolution = useEditorStore((s) => s.exportResolution);
  const exportFormat = useEditorStore((s) => s.exportFormat);
  const setExportResolution = useEditorStore((s) => s.setExportResolution);
  const setExportFormat = useEditorStore((s) => s.setExportFormat);

  const handleExport = useCallback(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;

    const dataUrl = canvas.toDataURL(
      exportFormat === "png" ? "image/png" : "image/jpeg",
      0.95
    );

    const link = document.createElement("a");
    link.download = `mockbox-export.${exportFormat}`;
    link.href = dataUrl;
    link.click();

    onOpenChange(false);
  }, [exportFormat, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Render</DialogTitle>
          <DialogDescription>
            Choose resolution and format for your mockup render.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Resolution
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(resolutions) as Array<keyof typeof resolutions>).map(
                (res) => (
                  <Button
                    key={res}
                    variant={exportResolution === res ? "default" : "outline"}
                    size="sm"
                    onClick={() => setExportResolution(res)}
                  >
                    {res.toUpperCase()}
                    <span className="text-xs ml-1 opacity-60">
                      {resolutions[res].width}x{resolutions[res].height}
                    </span>
                  </Button>
                )
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Format</label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={exportFormat === "png" ? "default" : "outline"}
                size="sm"
                onClick={() => setExportFormat("png")}
              >
                PNG
                <span className="text-xs ml-1 opacity-60">
                  (transparent)
                </span>
              </Button>
              <Button
                variant={exportFormat === "jpg" ? "default" : "outline"}
                size="sm"
                onClick={() => setExportFormat("jpg")}
              >
                JPG
                <span className="text-xs ml-1 opacity-60">(smaller)</span>
              </Button>
            </div>
          </div>

          <Button className="w-full" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Download Render
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
