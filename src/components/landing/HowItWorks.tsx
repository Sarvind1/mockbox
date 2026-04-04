"use client";

const steps = [
  {
    number: "01",
    title: "Pick a template",
    description:
      "Browse our library and select the packaging type that matches your product.",
  },
  {
    number: "02",
    title: "Upload your design",
    description:
      "Drag and drop your artwork (PNG, JPG, SVG). It maps onto the 3D model automatically.",
  },
  {
    number: "03",
    title: "Customise",
    description:
      "Adjust colours, materials, and finishes. Rotate and inspect from any angle.",
  },
  {
    number: "04",
    title: "Export",
    description:
      "Download a high-resolution render as PNG or JPG — ready for presentations or listings.",
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            How it works
          </h2>
          <p className="text-lg text-muted-foreground">
            From design to render in under a minute.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, i) => (
            <div key={step.number} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-gray-200 to-transparent -translate-x-4" />
              )}
              <div className="text-4xl font-bold text-primary/10 mb-3">
                {step.number}
              </div>
              <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
