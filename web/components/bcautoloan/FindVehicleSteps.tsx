import Link from "next/link";

const headingFont = "font-[family-name:var(--font-outfit)]";
const bodyFont = "font-[family-name:var(--font-open-sans)]";

const steps = [
  {
    number: "1",
    title: (
      <>
        Get
        <br />
        Get Approved
      </>
    ),
    text: (
      <>
        The first step is to learn what your budget is. This is done by
        completing our online approval application{" "}
        <Link
          href="/bcautoloan/getapproved"
          className="font-semibold text-[#0b79b3] hover:underline"
        >
          here
        </Link>
        .
      </>
    ),
  },
  {
    number: "2",
    title: (
      <>
        Shop With
        <br />
        Confidence
      </>
    ),
    text: (
      <>
        We’ll connect you with a local partner dealership who will show you
        cars that you already qualify for, saving you time and avoiding any
        stress.
      </>
    ),
  },
  {
    number: "3",
    title: (
      <>
        Choose Your
        <br />
        New Vehicle
      </>
    ),
    text: (
      <>
        Choose the vehicle that is right for you and it’s yours! Typically we
        can have you in a new car in as little as 48 hours.
      </>
    ),
  },
];

export function FindVehicleSteps() {
  return (
    <section className="bg-white py-12 sm:py-16 lg:py-20">
      <ol
        role="list"
        className="mx-auto grid max-w-md list-none grid-cols-1 gap-7 px-5 sm:px-6 lg:max-w-[1180px] lg:grid-cols-3 lg:gap-12"
      >
        {steps.map((step) => (
          <li
            key={step.number}
            className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_4px_14px_rgba(20,40,70,0.14)]"
          >
            <div className="-mb-[22px] flex h-[140px] items-center gap-[18px] bg-[#1178c9] px-[26px] text-white [clip-path:polygon(0_0,100%_0,100%_calc(100%_-_22px),0_100%)]">
              <div
                aria-hidden="true"
                className="flex items-center gap-[2px] pb-5 leading-none text-white/30"
              >
                <span
                  className={`${headingFont} text-[18px] font-medium tracking-[0.12em] [transform:rotate(180deg)] [writing-mode:vertical-rl]`}
                >
                  STEP
                </span>

                <span
                  className={`${headingFont} text-[84px] font-medium leading-[0.9] sm:text-[96px]`}
                >
                  {step.number}
                </span>
              </div>

              <h3
                className={`${headingFont} mb-5 text-[21px] font-medium leading-[1.35]`}
              >
                {step.title}
              </h3>
            </div>

            <p
              className={`${bodyFont} m-0 flex-1 px-[26px] pb-11 pt-12 text-[16px] leading-[1.65] text-[#2b2f36]`}
            >
              {step.text}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
