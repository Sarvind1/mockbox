"use client";

import dynamic from "next/dynamic";
import { useParams, redirect } from "next/navigation";
import { useRef } from "react";
import { useEditorStore } from "@/lib/store";
import { getTemplate } from "@/lib/templates";

const EditorLayout = dynamic(
  () => import("@/components/editor/EditorLayout").then((m) => m.EditorLayout),
  { ssr: false }
);

export default function WrapEditorPage() {
  const params = useParams();
  const templateId = params.templateId as string;
  const template = getTemplate(templateId);

  // If template exists but is not a vehicle, redirect to the packaging editor
  if (template && template.category !== "vehicles") {
    redirect(`/editor/${templateId}`);
  }

  // Sync the store to the URL-derived templateId synchronously during render
  // so the correct template is active before the first paint. This avoids the
  // two-render-cycle (null → EditorLayout) that caused the Canvas to mount
  // with a stale/blank scene on initial page load.
  const syncedRef = useRef<string | null>(null);
  if (templateId && syncedRef.current !== templateId) {
    const store = useEditorStore.getState();
    if (store.activeTemplateId !== templateId) {
      store.setTemplate(templateId);
    }
    syncedRef.current = templateId;
  }

  return <EditorLayout mode="wrap" />;
}
