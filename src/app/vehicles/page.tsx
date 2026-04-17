import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { VehicleGrid } from "@/components/vehicles/VehicleGrid";

export default function VehiclesPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-3xl font-bold mb-2">Vehicle Wraps</h1>
          <p className="text-muted-foreground mb-8">
            Design full car wraps with per-panel control. Select any panel, upload artwork, and preview in 3D.
          </p>
          <VehicleGrid />
        </div>
      </main>
      <Footer />
    </>
  );
}
