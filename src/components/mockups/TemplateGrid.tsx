"use client";

import { useState } from "react";
import Link from "next/link";
import { templates } from "@/lib/templates";
import { PackagingCategory } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Box, Wine, Cylinder, ShoppingBag, Pipette, Coffee } from "lucide-react";

const categories: { value: PackagingCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "boxes", label: "Boxes" },
  { value: "bottles", label: "Bottles" },
  { value: "cans", label: "Cans" },
  { value: "pouches", label: "Pouches" },
  { value: "tubes", label: "Tubes" },
  { value: "cups", label: "Cups" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const categoryIcons: Record<string, any> = {
  boxes: Box,
  bottles: Wine,
  cans: Cylinder,
  pouches: ShoppingBag,
  tubes: Pipette,
  cups: Coffee,
};

export function TemplateGrid() {
  const [filter, setFilter] = useState<string>("all");

  const filtered =
    filter === "all"
      ? templates
      : templates.filter((t) => t.category === filter);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map((cat) => (
          <Button
            key={cat.value}
            variant={filter === cat.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(cat.value)}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map((template) => {
          const Icon = categoryIcons[template.category] || Box;
          return (
            <Link
              key={template.id}
              href={`/editor/${template.id}`}
              className="group"
            >
              <div className="bg-card rounded-xl border overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
                <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                  <Icon className="h-16 w-16 text-gray-300 group-hover:text-gray-400 transition-colors" />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold">{template.name}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {template.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {template.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {template.surfaces.length} editable surface
                    {template.surfaces.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
