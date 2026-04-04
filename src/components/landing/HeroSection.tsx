"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 -z-10" />
      <div className="absolute top-20 left-1/4 w-72 h-72 bg-blue-200/30 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 lg:pt-28 lg:pb-32">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 mb-6">
            <span className="text-xs font-medium text-blue-600">
              New
            </span>
            <span className="text-xs text-blue-600/80">
              3D packaging mockups in your browser
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 mb-6">
            Design packaging{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              in 3D
            </span>
            <br />
            without the complexity
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Upload your design, pick a template, and get a photorealistic 3D
            mockup in seconds. No downloads, no 3D skills required.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/editor/tuck-end-box">
              <Button size="lg" className="text-base px-8 h-12">
                Start Creating
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/mockups">
              <Button variant="outline" size="lg" className="text-base px-8 h-12">
                <Play className="mr-2 h-4 w-4" />
                Browse Templates
              </Button>
            </Link>
          </div>

          <p className="text-sm text-muted-foreground mt-4">
            Free to use &middot; No sign-up required
          </p>
        </div>

        {/* Hero mockup preview */}
        <div className="mt-16 relative max-w-5xl mx-auto">
          <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-xl shadow-2xl overflow-hidden border border-gray-700">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="text-xs text-gray-400 ml-2">
                MockBox Editor
              </span>
            </div>
            <div className="aspect-[16/9] bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <div className="text-center">
                <div className="w-32 h-44 bg-white rounded-lg shadow-lg mx-auto mb-4 border flex items-center justify-center">
                  <div className="w-24 h-32 bg-gradient-to-br from-blue-400 to-purple-500 rounded" />
                </div>
                <p className="text-sm text-gray-500">
                  Interactive 3D editor preview
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
