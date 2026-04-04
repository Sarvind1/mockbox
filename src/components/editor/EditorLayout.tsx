"use client";

import { EditorToolbar } from "./EditorToolbar";
import { EditorViewport } from "./EditorViewport";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";

export function EditorLayout() {
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <EditorToolbar />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar />
        <EditorViewport />
        <RightSidebar />
      </div>
    </div>
  );
}
