"use client";

import {
  Box,
  Paintbrush,
  Download,
  RotateCcw,
  Palette,
  Layers,
} from "lucide-react";

const features = [
  {
    icon: Box,
    title: "100+ Templates",
    description:
      "Boxes, bottles, cans, pouches, tubes, cups — a growing library of packaging types.",
  },
  {
    icon: Paintbrush,
    title: "Upload & Apply",
    description:
      "Drag and drop your artwork. It maps onto the 3D model instantly with accurate UV mapping.",
  },
  {
    icon: RotateCcw,
    title: "360 Interaction",
    description:
      "Rotate, zoom, and inspect your mockup from every angle with smooth orbit controls.",
  },
  {
    icon: Palette,
    title: "Material Finishes",
    description:
      "Switch between matte, glossy, metallic, and kraft finishes in one click.",
  },
  {
    icon: Download,
    title: "High-Res Export",
    description:
      "Export PNG or JPG renders up to 4K resolution with transparent backgrounds.",
  },
  {
    icon: Layers,
    title: "Multi-Surface Editing",
    description:
      "Apply different artwork to each face of the packaging — front, back, sides, and top.",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Everything you need for packaging mockups
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A complete toolkit for creating photorealistic 3D packaging
            visualisations, right in your browser.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group p-6 rounded-xl border bg-card hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/5 flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
