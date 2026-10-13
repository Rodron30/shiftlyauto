"use client";

import { useState } from "react";

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: "How long does the pre-approval process take?",
      answer: "Most applications are processed within 24-48 hours. You'll receive a response as soon as your application has been reviewed.",
    },
    {
      question: "What information do I need to provide?",
      answer: "You'll need to provide personal information, address details, employment and income information, and details about the vehicle you're interested in.",
    },
    {
      question: "Does pre-approval guarantee a vehicle purchase?",
      answer: "Pre-approval does not guarantee a vehicle purchase. The next steps depend on your application, the vehicle you choose, and the applicable review process.",
    },
    {
      question: "Can I sell my car through BCAutoLoan?",
      answer: "Yes! Use our Sell Your Car form to submit your vehicle information. Our team will review your submission and follow up with you.",
    },
    {
      question: "Is my personal information secure?",
      answer: "Absolutely. We use industry-standard security measures to protect your personal information and never share it with unauthorized parties.",
    },
  ];

  return (
    <section className="bc-section">
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-bc-text-primary mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-bc-text-secondary">
            Find answers to common questions about our services.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="bc-card overflow-hidden">
              <button
                className="w-full px-6 py-4 text-left flex items-center justify-between"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                aria-expanded={openIndex === index}
              >
                <span className="font-semibold text-bc-text-primary">{faq.question}</span>
                <svg
                  className={`h-5 w-5 text-bc-text-tertiary transition-transform ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openIndex === index && (
                <div className="px-6 pb-4">
                  <p className="text-bc-text-secondary">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


