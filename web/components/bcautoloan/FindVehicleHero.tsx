import Image from "next/image";



export function FindVehicleHero() {
  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-12 px-5 py-[72px] sm:px-6 lg:grid-cols-2">
        <div className="feature-media order-2 flex aspect-[4/3] items-center justify-center overflow-hidden bg-white p-6 lg:order-1">
          <Image
            src="/images/bcautoloan/hero-cars-white.png"
            alt="Pickup truck and hatchback"
            width={520}
            height={390}
            className="h-auto w-full max-w-[520px] object-contain"
            loading="eager"
          />
        </div>

        <div className="feature-text order-1 lg:order-2">
          <h1 className="m-0 mb-5 font-[family-name:var(--font-outfit)] text-[clamp(28px,4vw,40px)] font-semibold leading-[1.15] text-slate-900">
            Find a car that is right for you and your budget.
          </h1>

          <p className="m-0 text-[17px] leading-[1.6] text-slate-700">
            With our simple approval process and partner dealership
            network, you can shop with greater confidence and focus on
            vehicles that fit your budget.
          </p>
        </div>
      </div>
    </section>
  );
}









