export function HowItWorks() {
  const steps = [
    {
      number: "1",
      title: "Start Your Approval",
      description:
        "Complete our simple online application to get started.",
    },
    {
      number: "2",
      title: "We Contact You",
      description:
        "BCAutoLoan finance department will reach out to you for your approval application",
    },
    {
      number: "3",
      title: "Find Your Vehicle",
      description:
        "We connect you with a local dealership to help you find a vehicle that fits your needs and budget.",
    },
  ];

  return (
    <section className="bc-section">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-bc-text-primary sm:text-4xl">
            How It Works
          </h2>
          <p className="mx-auto max-w-2xl text-bc-text-secondary">
            Getting started is simple. Follow these three easy steps.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.number} className="bc-card p-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-bc-primary">
                <span className="text-2xl font-bold text-white">
                  {step.number}
                </span>
              </div>

              <h3 className="mb-2 text-xl font-semibold text-bc-text-primary">
                {step.title}
              </h3>

              <p className="text-bc-text-secondary">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
