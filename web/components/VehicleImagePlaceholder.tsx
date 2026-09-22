export default function VehicleImagePlaceholder({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center bg-neutral-100 ${className}`}>
      <div className="text-center">
        <svg
          className="mx-auto h-12 w-12 text-neutral-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 9l-7 7-7-7"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 19V5"
          />
        </svg>
        <p className="mt-2 text-sm font-medium text-neutral-400">
          No vehicle photo
        </p>
        <p className="mt-1 text-xs text-neutral-300">
          Vehicle image not available
        </p>
      </div>
    </div>
  );
}
