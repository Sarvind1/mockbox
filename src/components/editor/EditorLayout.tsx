"use client";

import { useEffect } from "react";
import { EditorToolbar } from "./EditorToolbar";
import { EditorViewport } from "./EditorViewport";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";

export type EditorMode = "packaging" | "wrap";

interface EditorLayoutProps {
  mode?: EditorMode;
}

export function EditorLayout({ mode = "packaging" }: EditorLayoutProps) {
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      if (e.reason instanceof TypeError && e.reason.message === "not granted") {
        e.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  return (
    <div className={`h-screen flex flex-col bg-background overflow-hidden ${mode === "wrap" ? "dark wrap-editor" : ""}`}>
      <EditorToolbar mode={mode} />
      <div className="flex flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        <LeftSidebar mode={mode} />
        <EditorViewport />
        <RightSidebar mode={mode} />
      </div>
    </div>
  );
}
