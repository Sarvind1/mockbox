"use client";

import Link from "next/link";
import { templates } from "@/lib/templates";
import { Car } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const vehicleTemplates = templates.filter((t) => t.category === "vehicles");

export function VehicleGrid() {
  if (vehicleTemplates.length === 0) {
    return (
      <p className="text-muted-foreground">No vehicle templates available yet.</p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {vehicleTemplates.map((template) => (
        <Link key={template.id} href={`/wrap/${template.id}`} className="group">
          <div className="bg-card rounded-xl border overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
            <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center">
              <Car className="h-16 w-16 text-gray-500 group-hover:text-gray-400 transition-colors" />
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold">{template.name}</h3>
                <Badge variant="secondary" className="text-xs">
                  {template.canvasZones?.length ?? 0} panels
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{template.description}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
