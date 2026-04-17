"use client";

import { useParams, redirect } from "next/navigation";
import { useEffect } from "react";
import { useEditorStore } from "@/lib/store";
import { getTemplate } from "@/lib/templates";
import { EditorLayout } from "@/components/editor/EditorLayout";

export default function WrapEditorPage() {
  const params = useParams();
  const templateId = params.templateId as string;
  const setTemplate = useEditorStore((s) => s.setTemplate);
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId);

  const template = getTemplate(templateId);

  useEffect(() => {
    if (templateId && templateId !== activeTemplateId) {
      setTemplate(templateId);
    }
  }, [templateId, activeTemplateId, setTemplate]);

  // If template exists but is not a vehicle, redirect to the packaging editor
  if (template && template.category !== "vehicles") {
    redirect(`/editor/${templateId}`);
  }

  return <EditorLayout mode="wrap" />;
}
