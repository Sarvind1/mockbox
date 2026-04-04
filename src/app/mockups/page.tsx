import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { TemplateGrid } from "@/components/mockups/TemplateGrid";

export default function MockupsPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-3xl font-bold mb-2">Template Library</h1>
          <p className="text-muted-foreground mb-8">
            Browse all packaging templates. Click any template to open it in the editor.
          </p>
          <TemplateGrid />
        </div>
      </main>
      <Footer />
    </>
  );
}
