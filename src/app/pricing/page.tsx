import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { PricingSection } from "@/components/landing/PricingSection";

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <PricingSection />
      </main>
      <Footer />
    </>
  );
}
