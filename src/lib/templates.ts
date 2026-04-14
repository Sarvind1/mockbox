import { PackagingTemplate } from "./types";

export const templates: PackagingTemplate[] = [
  {
    id: "tuck-end-box",
    name: "Tuck End Box",
    category: "boxes",
    description: "Classic tuck end packaging box — ideal for retail products",
    surfaces: ["front", "back", "left", "right", "top"],
    defaultColor: "#ffffff",
    thumbnail: "/thumbnails/box.png",
  },
  {
    id: "bottle",
    name: "Plastic Bottle",
    category: "bottles",
    description: "Standard cylindrical bottle with label wrap",
    surfaces: ["body", "cap"],
    defaultColor: "#ffffff",
    thumbnail: "/thumbnails/bottle.png",
  },
  {
    id: "beverage-can",
    name: "Beverage Can",
    category: "cans",
    description: "Standard aluminium beverage can",
    surfaces: ["body"],
    defaultColor: "#c0c0c0",
    thumbnail: "/thumbnails/can.png",
  },
  {
    id: "stand-up-pouch",
    name: "Stand-Up Pouch",
    category: "pouches",
    description: "Flexible stand-up pouch with front and back panels",
    surfaces: ["front", "back"],
    defaultColor: "#ffffff",
    thumbnail: "/thumbnails/pouch.png",
  },
  {
    id: "cosmetic-tube",
    name: "Cosmetic Tube",
    category: "tubes",
    description: "Squeezable cosmetic tube with flip cap",
    surfaces: ["body", "cap"],
    defaultColor: "#ffffff",
    thumbnail: "/thumbnails/tube.png",
  },
  {
    id: "coffee-cup",
    name: "Coffee Cup",
    category: "cups",
    description: "Paper coffee cup with sleeve area",
    surfaces: ["body", "sleeve"],
    defaultColor: "#ffffff",
    thumbnail: "/thumbnails/cup.png",
  },
  {
    id: "car-sedan",
    name: "Car Sedan",
    category: "vehicles",
    description: "Standard sedan — apply brand wraps to body, roof, and hood",
    surfaces: ["body", "roof", "hood"],
    defaultColor: "#cc2222",
    thumbnail: "/thumbnails/car-sedan.png",
  },
  {
    id: "car-van",
    name: "Cargo Van",
    category: "vehicles",
    description: "Cargo van — ideal for fleet branding and full body wraps",
    surfaces: ["body", "roof", "hood"],
    defaultColor: "#ffffff",
    thumbnail: "/thumbnails/car-van.png",
  },
];

export function getTemplate(id: string): PackagingTemplate | undefined {
  return templates.find((t) => t.id === id);
}

export function getTemplatesByCategory(
  category: string
): PackagingTemplate[] {
  return templates.filter((t) => t.category === category);
}
