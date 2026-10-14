"use client";

import { useMemo, useState } from "react";
import {
  PreApprovalFormData,
  CANADIAN_PROVINCES,
  CREDIT_RATINGS,
  EMPLOYMENT_STATUSES,
  INCOME_FREQUENCIES,
  INCOME_TYPES,
  TRADE_IN_OPTIONS,
  VEHICLE_BUDGETS,
  VEHICLE_TYPES,
} from "@/lib/bcautoloan/validation/schemas";
import {
  validatePreApprovalForm,
  sanitizePreApprovalData,
  ValidationError,
} from "@/lib/bcautoloan/validation/validators";

const STEPS = [
  "Vehicle",
  "Budget",
  "Trade-In",
  "Credit",
  "Employment",
  "Income Type",
  "Income",
  "Personal",
  "Address",
  "Details",
  "Review",
];

const OPTION_CLASS =
  "w-full rounded-2xl border border-bc-border bg-white px-5 py-5 text-left text-base font-semibold text-bc-text-primary shadow-sm transition hover:-translate-y-0.5 hover:border-bc-primary hover:shadow-md focus:outline-none focus:ring-2 focus:ring-bc-primary/30";

const selectedOptionClass =
  "border-bc-primary bg-bc-primary/5 ring-2 ring-bc-primary/20";

export function PreApprovalForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Partial<PreApprovalFormData>>({
    hasTrade: false,
    honeypot: "",
  });
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [applicationNumber, setApplicationNumber] = useState<string | null>(
    null
  );
  const [crmLinked, setCrmLinked] = useState<boolean>(true);
  const [emailSent, setEmailSent] = useState<boolean>(true);

  const updateField = <K extends keyof PreApprovalFormData>(
    field: K,
    value: PreApprovalFormData[K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setErrors((prev) => prev.filter((error) => error.field !== field));
  };

  const getError = (field: string) =>
    errors.find((error) => error.field === field)?.message;

  const progress = (Math.min(currentStep + 1, STEPS.length) / STEPS.length) * 100;

  const validateStep = () => {
    const stepErrors: ValidationError[] = [];

    switch (currentStep) {
      case 0:
        if (!formData.vehicleType) {
          stepErrors.push({
            field: "vehicleType",
            message: "Please select a vehicle type.",
          });
        }
        break;

      case 1:
        if (!formData.vehicleBudget) {
          stepErrors.push({
            field: "vehicleBudget",
            message: "Please select your budget.",
          });
        }
        break;

      case 2:
        if (typeof formData.hasTrade !== "boolean") {
          stepErrors.push({
            field: "hasTrade",
            message: "Please select an option.",
          });
        }
        break;

      case 3:
        if (!formData.creditRating) {
          stepErrors.push({
            field: "creditRating",
            message: "Please select an option.",
          });
        }
        break;

      case 4:
        if (!formData.employmentStatus) {
          stepErrors.push({
            field: "employmentStatus",
            message: "Please select your employment status.",
          });
        }
        break;

      case 5:
        if (!formData.incomeType) {
          stepErrors.push({
            field: "incomeType",
            message: "Please select how you know your income.",
          });
        }
        break;

      case 6:
        if (!formData.income || !/^\d+(,\d{3})*(\.\d{2})?$/.test(formData.income)) {
          stepErrors.push({
            field: "income",
            message: "Please enter a valid income amount.",
          });
        }
        break;

      case 7:
        if (!formData.firstName || formData.firstName.trim().length < 2) {
          stepErrors.push({
            field: "firstName",
            message: "First name is required.",
          });
        }

        if (!formData.lastName || formData.lastName.trim().length < 2) {
          stepErrors.push({
            field: "lastName",
            message: "Last name is required.",
          });
        }

        if (
          !formData.email ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
        ) {
          stepErrors.push({
            field: "email",
            message: "A valid email is required.",
          });
        }

        if (!formData.phone || formData.phone.trim().length < 7) {
          stepErrors.push({
            field: "phone",
            message: "A valid phone number is required.",
          });
        }
        break;

      case 8:
        if (!formData.address || formData.address.trim().length < 5) {
          stepErrors.push({
            field: "address",
            message: "Address is required.",
          });
        }

        if (!formData.city || formData.city.trim().length < 2) {
          stepErrors.push({
            field: "city",
            message: "City is required.",
          });
        }

        if (!formData.province) {
          stepErrors.push({
            field: "province",
            message: "Province is required.",
          });
        }

        if (
          !formData.postalCode ||
          !/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(formData.postalCode)
        ) {
          stepErrors.push({
            field: "postalCode",
            message: "Valid Canadian postal code is required.",
          });
        }
        break;

      case 9:
        if (!formData.vehicleMake || formData.vehicleMake.trim().length < 2) {
          stepErrors.push({
            field: "vehicleMake",
            message: "Vehicle make is required.",
          });
        }

        if (!formData.vehicleModel || formData.vehicleModel.trim().length < 1) {
          stepErrors.push({
            field: "vehicleModel",
            message: "Vehicle model is required.",
          });
        }

        if (!formData.employer || formData.employer.trim().length < 2) {
          stepErrors.push({
            field: "employer",
            message: "Employer name is required.",
          });
        }

        if (!formData.jobTitle || formData.jobTitle.trim().length < 2) {
          stepErrors.push({
            field: "jobTitle",
            message: "Job title is required.",
          });
        }

        if (!formData.downPayment) {
          stepErrors.push({
            field: "downPayment",
            message: "Down payment is required.",
          });
        }

        if (!formData.incomeFrequency) {
          stepErrors.push({
            field: "incomeFrequency",
            message: "Please select your income frequency.",
          });
        }
        break;
    }

    setErrors(stepErrors);
    return stepErrors.length === 0;
  };

  const next = () => {
    if (validateStep()) {
      setCurrentStep((step) => Math.min(step + 1, STEPS.length - 1));
    }
  };

  const back = () => {
    setErrors([]);
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  const submit = async () => {
    const allErrors = validatePreApprovalForm(formData);

    if (allErrors.length > 0) {
      setErrors(allErrors);
      return;
    }
    setIsSubmitting(true);
    setErrors([]);

    try {
      const sanitizedData = sanitizePreApprovalData(
        formData as PreApprovalFormData
      );

      const response = await fetch("/api/bcautoloan/pre-approval", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sanitizedData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Submission failed");
      }

      setApplicationNumber(result.applicationNumber);
      setSubmitSuccess(true);
      setCrmLinked(result.crmLinked ?? false);
      setEmailSent(result.emailSent ?? false);
    } catch (error) {
      console.error("Submission error:", error);
      // Display submission error at the top of the form
      setErrors([
        {
          field: "submission",
          message:
            error instanceof Error
              ? error.message
              : "Failed to submit application. Please try again.",
        },
      ]);
      // Stay on the review step to show the error
      setCurrentStep(10);
    } finally {
      setIsSubmitting(false);
    }
  };

  const summary = useMemo(
    () => [
      ["Vehicle", formData.vehicleType],
      ["Budget", formData.vehicleBudget],
      [
        "Trade-In",
        formData.hasTrade === true
          ? "Yes"
          : formData.hasTrade === false
            ? "No"
            : undefined,
      ],
      ["Credit", formData.creditRating],
      ["Employment", formData.employmentStatus],
      ["Income", formData.income ? `$${Number(String(formData.income).replace(/\D/g, "")).toLocaleString("en-US")}` : undefined],
    ],
    [formData]
  );

  if (submitSuccess) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-bc-border bg-white p-8 text-center shadow-sm sm:p-12">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-bc-primary text-2xl font-bold text-white">
          ✓
        </div>

        <h2 className="text-3xl font-bold text-bc-text-primary">
          Application Received
        </h2>

        <p className="mx-auto mt-4 max-w-xl text-bc-text-secondary">
          Thank you. Your application has been received and our team will
          follow up with you regarding the next steps.
        </p>

        {applicationNumber && (
          <div className="mt-8 rounded-2xl bg-bc-surface-light p-5">
            <p className="text-sm text-bc-text-tertiary">
              Application Reference
            </p>
            <p className="mt-1 text-xl font-bold text-bc-text-primary">
              {applicationNumber}
            </p>
          </div>
        )}

        {(!crmLinked || !emailSent) && (
          <div className="mt-6 rounded-2xl bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> Your application was saved successfully, but there may be a delay in processing. Our team will follow up with you.
            </p>
          </div>
        )}

        <p className="mt-6 text-sm text-bc-text-muted">
          We&apos;ll contact you at {formData.email}.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">


      <div className="rounded-3xl border border-bc-border bg-white p-6 shadow-sm sm:p-10">
        {currentStep === 0 && (
          <Question
            title="What type of vehicle are you looking for?"
            subtitle="Choose the type that best matches what you have in mind."
          >
            <OptionGrid
              options={VEHICLE_TYPES}
              value={formData.vehicleType}
              onSelect={(value) =>
                updateField("vehicleType", value)
              }
            />
          </Question>
        )}

        {currentStep === 1 && (
          <Question
            title="What is your budget?"
            subtitle="Choose the monthly payment range that works best for you."
          >
            <OptionGrid
              options={VEHICLE_BUDGETS}
              value={formData.vehicleBudget}
              onSelect={(value) =>
                updateField("vehicleBudget", value)
              }
            />
          </Question>
        )}

        {currentStep === 2 && (
          <Question title="Do you have a trade-in?">
            <OptionGrid
              options={TRADE_IN_OPTIONS}
              value={
                formData.hasTrade === true
                  ? "Yes"
                  : formData.hasTrade === false
                    ? "No"
                    : undefined
              }
              onSelect={(value) =>
                updateField("hasTrade", value === "Yes")
              }
            />
          </Question>
        )}

        {currentStep === 3 && (
          <Question
            title="What is your estimated credit rating?"
            subtitle="If you are unsure, choose No Credit / Unsure."
          >
            <OptionGrid
              options={CREDIT_RATINGS}
              value={formData.creditRating}
              onSelect={(value) =>
                updateField("creditRating", value)
              }
            />
          </Question>
        )}

        {currentStep === 4 && (
          <Question title="What is your employment status?">
            <OptionGrid
              options={EMPLOYMENT_STATUSES}
              value={formData.employmentStatus}
              onSelect={(value) =>
                updateField("employmentStatus", value)
              }
            />
          </Question>
        )}

        {currentStep === 5 && (
          <Question
            title="How do you know your income?"
            subtitle="Select the option that best describes how you track your income."
          >
            <OptionGrid
              options={INCOME_TYPES}
              value={formData.incomeType}
              onSelect={(value) =>
                updateField("incomeType", value)
              }
            />
          </Question>
        )}

        {currentStep === 6 && (
          <Question
            title="What is your annual income before taxes & deductions?"
            subtitle="Round to the nearest dollar."
          >
            <div className="mx-auto max-w-xl">
              <label className="bc-label">Annual Income</label>
              <div className="flex items-center rounded-xl border border-bc-border bg-white px-4">
                <span className="shrink-0 pr-2 text-lg text-bc-text-secondary">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={
                    formData.income
                      ? Number(String(formData.income).replace(/\D/g, "")).toLocaleString("en-US")
                      : ""
                  }
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, "");
                    updateField("income", digits);
                  }}
                  className="w-full border-0 bg-transparent px-0 py-3 text-lg outline-none focus:ring-0"
                />
              </div>
              {getError("income") && (
                <p className="mt-2 text-sm text-bc-danger">
                  {getError("income")}
                </p>
              )}
            </div>
          </Question>
        )}

        {currentStep === 7 && (
          <Question
            title="Tell us a little about yourself."
            subtitle="We need your contact details to follow up with you."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="First Name"
                value={formData.firstName || ""}
                onChange={(value) => updateField("firstName", value)}
                error={getError("firstName")}
              />
              <Field
                label="Last Name"
                value={formData.lastName || ""}
                onChange={(value) => updateField("lastName", value)}
                error={getError("lastName")}
              />
              <Field
                label="Email"
                type="email"
                value={formData.email || ""}
                onChange={(value) => updateField("email", value)}
                error={getError("email")}
              />
              <Field
                label="Phone"
                type="tel"
                value={formData.phone || ""}
                onChange={(value) => updateField("phone", value)}
                error={getError("phone")}
              />
            </div>
          </Question>
        )}

        {currentStep === 8 && (
          <Question
            title="Where do you live?"
            subtitle="Enter your current Canadian address."
          >
            <div className="space-y-5">
              <Field
                label="Street Address"
                value={formData.address || ""}
                onChange={(value) => updateField("address", value)}
                error={getError("address")}
              />

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="City"
                  value={formData.city || ""}
                  onChange={(value) => updateField("city", value)}
                  error={getError("city")}
                />

                <div>
                  <label className="bc-label">Province</label>
                  <select
                    value={formData.province || ""}
                    onChange={(event) =>
                      updateField("province", event.target.value)
                    }
                    className="bc-input w-full"
                  >
                    <option value="">Select Province</option>
                    {CANADIAN_PROVINCES.map((province) => (
                      <option key={province} value={province}>
                        {province}
                      </option>
                    ))}
                  </select>
                  {getError("province") && (
                    <p className="mt-2 text-sm text-bc-danger">
                      {getError("province")}
                    </p>
                  )}
                </div>
              </div>

              <Field
                label="Postal Code"
                value={formData.postalCode || ""}
                onChange={(value) =>
                  updateField("postalCode", value.toUpperCase())
                }
                error={getError("postalCode")}
                placeholder="V6A 1A1"
              />
            </div>
          </Question>
        )}

        {currentStep === 9 && (
          <Question
            title="Tell us about the vehicle you have in mind."
            subtitle="This helps our team understand what you are looking for."
          >
            <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Vehicle Make"
                  value={formData.vehicleMake || ""}
                  onChange={(value) => updateField("vehicleMake", value)}
                  error={getError("vehicleMake")}
                  placeholder="Toyota"
                />

                <Field
                  label="Vehicle Model"
                  value={formData.vehicleModel || ""}
                  onChange={(value) => updateField("vehicleModel", value)}
                  error={getError("vehicleModel")}
                  placeholder="Camry"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Employer"
                  value={formData.employer || ""}
                  onChange={(value) => updateField("employer", value)}
                  error={getError("employer")}
                  placeholder="Company Name"
                />

                <Field
                  label="Job Title"
                  value={formData.jobTitle || ""}
                  onChange={(value) => updateField("jobTitle", value)}
                  error={getError("jobTitle")}
                  placeholder="Manager"
                />
              </div>

              <Field
                label="Down Payment"
                value={formData.downPayment || ""}
                onChange={(value) => {
                  const digits = value.replace(/[^0-9]/g, "");
                  const formatted = digits
                    ? Number(digits).toLocaleString("en-US")
                    : "";
                  updateField("downPayment", formatted);
                }}
                error={getError("downPayment")}
                placeholder="5,000"
              />

              <div>
                <label className="bc-label">Income Frequency</label>
                <select
                  value={formData.incomeFrequency || ""}
                  onChange={(event) =>
                    updateField("incomeFrequency", event.target.value)
                  }
                  className="bc-input w-full"
                >
                  <option value="">Select Frequency</option>
                  {INCOME_FREQUENCIES.map((frequency) => (
                    <option key={frequency} value={frequency}>
                      {frequency}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Question>
        )}

        {currentStep === 10 && (
          <Question title="Review your application">
            <div className="space-y-3">
              {summary.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 rounded-2xl bg-bc-surface-light px-5 py-4"
                >
                  <span className="text-sm text-bc-text-tertiary">
                    {label}
                  </span>
                  <span className="text-right text-sm font-semibold text-bc-text-primary">
                    {value || "Not provided"}
                  </span>
                </div>
              ))}

              <div className="mt-6 rounded-2xl border border-bc-border p-5">
                <h3 className="font-semibold text-bc-text-primary">
                  Contact
                </h3>
                <p className="mt-2 text-sm text-bc-text-secondary">
                  {formData.firstName} {formData.lastName}
                  <br />
                  {formData.email}
                  <br />
                  {formData.phone}
                </p>
              </div>

              {errors.length > 0 && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="rounded-2xl border border-bc-danger bg-bc-danger-light p-4"
                >
                  <p className="mb-2 text-sm font-semibold text-bc-danger">
                    {errors.some((e) => e.field === "submission")
                      ? "Submission Error"
                      : "Please correct these fields before submitting:"}
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-bc-danger">
                    {errors.map((error, index) => (
                      <li key={`${error.field}-${index}`}>
                        {error.field === "submission" ? (
                          <>{error.message}</>
                        ) : (
                          <>
                            <strong>
                              {error.field.replace(/([A-Z])/g, " $1")}:
                            </strong>{" "}
                            {error.message}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <input
                type="text"
                name="honeypot"
                value={formData.honeypot || ""}
                onChange={(event) => updateField("honeypot", event.target.value)}
                style={{ display: 'none' }}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                <p className="text-sm leading-6 text-slate-500">
                  I hereby authorize and give consent in reviewing my credit
                  information for financing purposes.
                </p>
              </div>
            </div>
          </Question>
        )}

        <div className="mt-10 flex items-center justify-between gap-4 border-t border-bc-border pt-6">
          {currentStep > 0 ? (
            <button
              type="button"
              onClick={back}
              disabled={isSubmitting}
              className="bc-button-secondary"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {currentStep < 9 ? (
            <button
              type="button"
              onClick={next}
              className="bc-button-primary"
            >
              Continue
            </button>
          ) : currentStep === 9 ? (
            <button
              type="button"
              onClick={() => {
                if (validateStep()) {
                  setCurrentStep(10);
                }
              }}
              className="bc-button-primary"
            >
              Review Application
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={isSubmitting}
              className="bc-button-primary"
            >
              {isSubmitting ? "Submitting..." : "Submit Application"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Question({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-2xl font-bold leading-tight text-bc-text-primary sm:text-3xl">
        {title}
      </h2>

      {subtitle && (
        <p className="mt-3 max-w-2xl text-base leading-7 text-bc-text-secondary">
          {subtitle}
        </p>
      )}

      <div className="mt-8">{children}</div>
    </section>
  );
}

function OptionGrid({
  options,
  value,
  onSelect,
}: {
  options: readonly string[];
  value?: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((option) => (
        <button
          type="button"
          key={option}
          onClick={() => onSelect(option)}
          className={`${OPTION_CLASS} ${
            value === option ? selectedOptionClass : ""
          }`}
          aria-pressed={value === option}
        >
          <span>{option}</span>
        </button>
      ))}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="bc-label">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`bc-input w-full ${error ? "border-bc-danger" : ""}`}
        placeholder={placeholder}
      />
      {error && (
        <p className="mt-2 text-sm text-bc-danger">
          {error}
        </p>
      )}
    </div>
  );
}




