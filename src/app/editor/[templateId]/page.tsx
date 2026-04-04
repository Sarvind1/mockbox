"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useEditorStore } from "@/lib/store";
import { EditorLayout } from "@/components/editor/EditorLayout";

export default function EditorPage() {
  const params = useParams();
  const templateId = params.templateId as string;
  const setTemplate = useEditorStore((s) => s.setTemplate);
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId);

  useEffect(() => {
    if (templateId && templateId !== activeTemplateId) {
      setTemplate(templateId);
    }
  }, [templateId, activeTemplateId, setTemplate]);

  return <EditorLayout />;
}
