interface FormProgressProps {
  currentStep: number;
  totalSteps: number;
  stepNames: string[];
}

export function FormProgress({ currentStep, totalSteps, stepNames }: FormProgressProps) {
  const progressPercentage = ((currentStep) / (totalSteps - 1)) * 100;

  return (
    <div className="mb-8">
      {/* Progress Bar */}
      <div className="h-2 bg-bc-surface-light rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-bc-primary transition-all duration-300 ease-in-out"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Step Indicators */}
      <div className="flex justify-between items-center">
        {stepNames.map((name, index) => (
          <div key={index} className="flex flex-col items-center flex-1">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                index < currentStep
                  ? "bg-bc-primary text-white"
                  : index === currentStep
                  ? "bg-bc-primary text-white"
                  : "bg-bc-surface-light text-bc-text-muted"
              }`}
            >
              {index < currentStep ? "✓" : index + 1}
            </div>
            <span
              className={`mt-2 text-xs font-medium ${
                index <= currentStep
                  ? "text-bc-text-primary"
                  : "text-bc-text-muted"
              }`}
            >
              {name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
