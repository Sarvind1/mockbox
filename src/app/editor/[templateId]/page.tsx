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

export default function EditorPage() {
  const params = useParams();
  const templateId = params.templateId as string;
  const template = getTemplate(templateId);

  // If template exists and is a vehicle, redirect to the vehicle wrap editor
  if (template && template.category === "vehicles") {
    redirect(`/wrap/${templateId}`);
  }

  // Sync the store to the URL-derived templateId synchronously during render
  // so the correct template is active before the first paint.
  const syncedRef = useRef<string | null>(null);
  if (templateId && syncedRef.current !== templateId) {
    const store = useEditorStore.getState();
    if (store.activeTemplateId !== templateId) {
      store.setTemplate(templateId);
    }
    syncedRef.current = templateId;
  }

  return <EditorLayout mode="packaging" />;
}
