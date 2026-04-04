"use client";

import Link from "next/link";
import { templates } from "@/lib/templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Box, Wine, Cylinder, ShoppingBag, Pipette, Coffee } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const categoryIcons: Record<string, any> = {
  boxes: Box,
  bottles: Wine,
  cans: Cylinder,
  pouches: ShoppingBag,
  tubes: Pipette,
  cups: Coffee,
};

const categoryColors: Record<string, string> = {
  boxes: "bg-blue-50 text-blue-700",
  bottles: "bg-green-50 text-green-700",
  cans: "bg-orange-50 text-orange-700",
  pouches: "bg-purple-50 text-purple-700",
  tubes: "bg-pink-50 text-pink-700",
  cups: "bg-amber-50 text-amber-700",
};

export function TemplateShowcase() {
  return (
    <section className="py-20 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Template Library
            </h2>
            <p className="text-lg text-muted-foreground">
              Pick a packaging type and start designing.
            </p>
          </div>
          <Link href="/mockups">
            <Button variant="outline" className="hidden sm:flex">
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => {
            const Icon = categoryIcons[template.category] || Box;
            return (
              <Link
                key={template.id}
                href={`/editor/${template.id}`}
                className="group"
              >
                <div className="bg-white rounded-xl border overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
                  <div className="aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center relative">
                    <Icon className="h-16 w-16 text-gray-300 group-hover:text-gray-400 transition-colors" />
                    <Badge
                      className={`absolute top-3 right-3 ${categoryColors[template.category]}`}
                      variant="secondary"
                    >
                      {template.category}
                    </Badge>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold mb-1">{template.name}</h3>
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
    </section>
  );
}
