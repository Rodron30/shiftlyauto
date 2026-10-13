export function WhyBCAutoLoan() {
  const benefits = [
    {
      icon: "\u26A1",
      title: "Fast Process",
      description: "Complete your application in minutes, not hours.",
    },
    {
      icon: "\uD83D\uDD12",
      title: "Secure & Safe",
      description: "Your information is protected with bank-level security.",
    },
    {
      icon: "\uD83C\uDFAF",
      title: "Simple Application",
      description: "No complicated forms or paperwork. Just straightforward questions.",
    },
    {
      icon: "\uD83E\uDD1D",
      title: "Trusted Partners",
      description: "We work with established financial institutions you can trust.",
    },
  ];

  return (
    <section className="bc-section bg-bc-surface">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-bc-text-primary mb-4">
            Why Choose BCAutoLoan?
          </h2>
          <p className="text-bc-text-secondary max-w-2xl mx-auto">
            We make the vehicle-buying process simple, secure, and straightforward.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((benefit) => (
            <div key={benefit.title} className="bc-card p-6 text-center">
              <div className="text-4xl mb-4">{benefit.icon}</div>
              <h3 className="text-lg font-semibold text-bc-text-primary mb-2">
                {benefit.title}
              </h3>
              <p className="text-sm text-bc-text-secondary">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

