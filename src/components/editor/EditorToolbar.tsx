"use client";

import Link from "next/link";
import { useEditorStore } from "@/lib/store";
import { getTemplate } from "@/lib/templates";
import { Button } from "@/components/ui/button";
import {
  Undo2,
  Redo2,
  Maximize,
  Download,
  Package,
  Home,
} from "lucide-react";
import { ExportDialog } from "./ExportDialog";
import { useState } from "react";
import type { EditorMode } from "./EditorLayout";

interface EditorToolbarProps {
  mode?: EditorMode;
}

export function EditorToolbar({ mode = "packaging" }: EditorToolbarProps) {
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const undoStack = useEditorStore((s) => s.undoStack);
  const redoStack = useEditorStore((s) => s.redoStack);
  const template = getTemplate(activeTemplateId);
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="h-12 border-b bg-white flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 mr-4">
          <Package className="h-5 w-5 text-primary" />
          <span className="font-bold text-sm">MockBox</span>
        </Link>

        <div className="h-5 w-px bg-border" />

        <span className="text-sm font-medium text-muted-foreground">
          {template?.name || (mode === "wrap" ? "Vehicle Wrap Editor" : "Packaging Editor")}
        </span>
        {mode === "wrap" && (
          <span className="text-xs text-muted-foreground/60 ml-1">— Vehicle Wrap</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={undo}
          disabled={undoStack.length === 0}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={redo}
          disabled={redoStack.length === 0}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>

        <div className="h-5 w-px bg-border mx-1" />

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Fullscreen"
          onClick={() => document.documentElement.requestFullscreen?.()}
        >
          <Maximize className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Link href="/">
          <Button variant="ghost" size="sm" className="h-8">
            <Home className="h-4 w-4 mr-1" />
            Home
          </Button>
        </Link>
        <Button
          size="sm"
          className="h-8"
          onClick={() => setExportOpen(true)}
        >
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
      </div>

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  );
}
