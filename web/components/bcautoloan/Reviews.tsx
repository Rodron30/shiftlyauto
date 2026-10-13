"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const reviews = [
  "reviews1.jpg",
  "reviews2.jpg",
  "reviews3.jpg",
  "reviews4.jpg",
  "reviews5.jpg",
  "reviews6.jpg",
  "reviews7.jpg",
  "reviews8.jpg",
];

export function Reviews() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const previous = () => {
    setCurrentIndex((current) =>
      current === 0 ? reviews.length - 1 : current - 1
    );
  };

  const next = () => {
    setCurrentIndex((current) =>
      current === reviews.length - 1 ? 0 : current + 1
    );
  };

  const openLightbox = (index: number) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        previous();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      }

      if (event.key === "Escape" && lightboxOpen) {
        event.preventDefault();
        closeLightbox();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxOpen]);

  useEffect(() => {
    if (!lightboxOpen) return;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [lightboxOpen]);

  const getReview = (offset: number) =>
    reviews[(currentIndex + offset) % reviews.length];

  return (
    <>
      <section className="bc-section bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-bc-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-bc-accent" />
              Customer Reviews
            </div>

            <h2 className="mt-5 text-3xl font-bold tracking-tight text-bc-text-primary sm:text-4xl">
              What Our Customers Say
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-bc-text-secondary">
              Real feedback from customers who chose BCAutoLoan for their
              automotive financing needs.
            </p>
          </div>

          <div className="relative mx-auto max-w-6xl">
            <div className="flex items-center gap-3 sm:gap-5">
              <button
                type="button"
                onClick={previous}
                aria-label="Previous customer review"
                className="group z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-[0_8px_25px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-x-0.5 hover:border-slate-300 hover:shadow-[0_12px_30px_rgba(15,23,42,0.12)]"
              >
                <span className="text-2xl leading-none transition-transform duration-300 group-hover:-translate-x-0.5">
                  ‹
                </span>
              </button>

              <div className="grid min-w-0 flex-1 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((offset) => {
                  const review = getReview(offset);
                  const reviewIndex =
                    (currentIndex + offset) % reviews.length;

                  return (
                    <button
                      key={`${review}-${offset}`}
                      type="button"
                      onClick={() => openLightbox(reviewIndex)}
                      aria-label="Open customer review"
                      className={[
                        "group relative overflow-hidden rounded-[24px] text-left",
                        "border border-slate-200/80 bg-white",
                        "shadow-[0_12px_35px_rgba(15,23,42,0.08)]",
                        "transition-all duration-300",
                        "hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(15,23,42,0.13)]",
                        "focus:outline-none focus:ring-2 focus:ring-bc-accent/30",
                        offset === 1 ? "hidden sm:block" : "",
                        offset === 2 ? "hidden lg:block" : "",
                      ].join(" ")}
                    >
                      <div className="absolute inset-x-0 top-0 z-10 h-1 bg-gradient-to-r from-slate-200 via-bc-accent to-slate-200 opacity-80" />

                      <div className="flex h-[350px] items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-3 sm:h-[370px]">
                        <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[18px] border border-slate-200/70 bg-white shadow-inner">
                          <Image
                            src={`/images/reviews/${review}`}
                            alt="BCAutoLoan customer review"
                            width={800}
                            height={800}
                            className="h-full w-full object-contain p-1 transition-transform duration-500 group-hover:scale-[1.015]"
                            sizes="(max-width: 640px) 85vw, (max-width: 1024px) 42vw, 30vw"
                          />

                          <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-slate-900/20 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                            <span className="mb-4 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur-sm">
                              Tap to view
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={next}
                aria-label="Next customer review"
                className="group z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-[0_8px_25px_rgba(15,23,42,0.08)] transition-all duration-300 hover:translate-x-0.5 hover:border-slate-300 hover:shadow-[0_12px_30px_rgba(15,23,42,0.12)]"
              >
                <span className="text-2xl leading-none transition-transform duration-300 group-hover:translate-x-0.5">
                  ›
                </span>
              </button>
            </div>

            <div className="mt-7 flex items-center justify-center gap-2">
              {reviews.map((review, index) => (
                <button
                  key={review}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  aria-label={`Go to customer review ${index + 1}`}
                  className={[
                    "h-1.5 rounded-full transition-all duration-300",
                    index === currentIndex
                      ? "w-7 bg-bc-accent"
                      : "w-1.5 bg-slate-300 hover:bg-slate-400",
                  ].join(" ")}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Customer review preview"
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={closeLightbox}
            aria-label="Close review preview"
            className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-2xl text-slate-700 shadow-xl transition hover:bg-white sm:right-6 sm:top-6"
          >
            ×
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              previous();
            }}
            aria-label="Previous review"
            className="absolute left-2 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-3xl text-slate-700 shadow-xl transition hover:scale-105 hover:bg-white sm:left-6"
          >
            ‹
          </button>

          <div
            className="relative flex h-[88vh] w-[92vw] max-w-5xl items-center justify-center sm:h-[90vh] sm:w-[88vw]"
            onClick={(event) => event.stopPropagation()}
            onTouchStart={(event) => {
              const touch = event.touches[0];
              event.currentTarget.dataset.touchStartX = String(touch.clientX);
            }}
            onTouchEnd={(event) => {
              const startX = Number(
                event.currentTarget.dataset.touchStartX || 0
              );
              const endX = event.changedTouches[0]?.clientX ?? startX;
              const difference = startX - endX;

              if (Math.abs(difference) > 50) {
                if (difference > 0) {
                  next();
                } else {
                  previous();
                }
              }
            }}
          >
            <Image
              src={`/images/reviews/${reviews[currentIndex]}`}
              alt="BCAutoLoan customer review"
              width={1400}
              height={1400}
              priority
              className="max-h-full max-w-full object-contain"
              sizes="95vw"
            />
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              next();
            }}
            aria-label="Next review"
            className="absolute right-2 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-3xl text-slate-700 shadow-xl transition hover:scale-105 hover:bg-white sm:right-6"
          >
            ›
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-4 py-2 text-xs font-medium text-white backdrop-blur-sm">
            {currentIndex + 1} / {reviews.length}
          </div>
        </div>
      )}
    </>
  );
}
