"use client";

import { EditorToolbar } from "./EditorToolbar";
import { EditorViewport } from "./EditorViewport";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";

export type EditorMode = "packaging" | "wrap";

interface EditorLayoutProps {
  mode?: EditorMode;
}

export function EditorLayout({ mode = "packaging" }: EditorLayoutProps) {
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <EditorToolbar mode={mode} />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar mode={mode} />
        <EditorViewport />
        <RightSidebar />
      </div>
    </div>
  );
}
