import Image from "next/image";

export function PartnerSection() {
  return (
    <section className="bc-section bg-bc-surface">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-bc-text-primary sm:text-4xl">
            Our Trusted Partners
          </h2>
          <p className="mx-auto max-w-2xl text-bc-text-secondary">
            We work with trusted financial institutions to help you get the best
            options and support for your vehicle.
          </p>
        </div>

        {/* Client-provided partner photo */}
        <div className="flex justify-center">
          <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
            <div className="overflow-hidden rounded-xl bg-slate-50">
              <Image
                src="/images/bcautoloan/homepage-hero.png"
                alt="BCAutoLoan trusted partners"
                width={1600}
                height={900}
                className="block h-auto w-full object-cover"
                sizes="(min-width: 1280px) 1024px, 100vw"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

