import Image from "next/image";
import Link from "next/link";

// Requires --font-outfit in app/layout.tsx (next/font/google Outfit with `variable`).
export function Hero() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-6">
        <div className="grid items-center gap-10 py-10 sm:gap-12 sm:py-14 md:py-16 lg:grid-cols-2 lg:gap-14 lg:py-[72px]">
          <div className="max-w-2xl text-center lg:text-left">
            <h1 className="font-[family-name:var(--font-outfit)] text-4xl font-semibold leading-[1.08] tracking-tight text-bc-text-primary sm:text-5xl lg:text-6xl xl:text-[64px]">
              Your next vehicle starts here.
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-bc-text-secondary sm:text-lg lg:mx-0 lg:text-xl lg:leading-8">
              A simple way to get started with trusted dealerships and move
              toward the vehicle that fits your needs and budget.
            </p>

            <div className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row lg:mx-0">
              <Link
                href="/bcautoloan/getapproved"
                className="bc-button-primary"
              >
                Get Approved
              </Link>

              <Link
                href="/bcautoloan/find-your-vehicle"
                className="bc-button-secondary"
              >
                Find Your Vehicle
              </Link>
            </div>
          </div>
          <div className="hero-media relative aspect-[4/3] overflow-hidden bg-white">
            <Image
              src="/images/bcautoloan/hero-cars-white.png"
              alt="A white pickup truck and a white hatchback"
              width={586}
              height={426}
              className="h-auto w-full object-contain p-4 sm:p-6"
              loading="eager"
            />
          </div>
        </div>
      </div>
    </section>
  );
}



