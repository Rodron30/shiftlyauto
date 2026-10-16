import Image from "next/image";

import Link from "next/link";

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className="mt-1 shrink-0 text-blue-600"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M7.5 12.5l3 3 6-6.5" />
    </svg>
  );
}

export function ShopConfidence() {
  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-12 px-5 py-[72px] sm:px-6 lg:grid-cols-2 lg:gap-12">
        <div>
          <h2 className="m-0 text-[clamp(28px,4vw,40px)] font-bold leading-[1.15] text-slate-900">
            Shop for a car with confidence
          </h2>

          <ul className="mt-5 mb-7 grid list-none gap-4 p-0">
            <li className="flex gap-3 text-[17px] leading-[1.5] text-slate-700">
              <CheckIcon />
              <span>
                Start your approval application online with a simple, straightforward process.
              </span>
            </li>

            <li className="flex gap-3 text-[17px] leading-[1.5] text-slate-700">
              <CheckIcon />
              <span>
                We will connect your application with a trusted local dealership that can help you explore vehicle options.
              </span>
            </li>

            <li className="flex gap-3 text-[17px] leading-[1.5] text-slate-700">
              <CheckIcon />
              <span>
                Choose the vehicle that fits your needs and budget, with support from start to finish.
              </span>
            </li>
          </ul>

          <Link
            href="/bcautoloan/pre-approved"
            className="bc-button-primary inline-flex"
          >
            Get Approved
          </Link>
        </div>

        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-white p-6">
          <Image
            src="/images/bcautoloan/car.png"
            alt="Vehicle"
            width={520}
            height={390}
            className="h-auto w-full max-w-[520px] object-contain"
          />
        </div>
      </div>
    </section>
  );
}

