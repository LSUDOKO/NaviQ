interface LoadingSpinnerProps {
  label?: string;
  className?: string;
}

export function LoadingSpinner({ label = "Loading", className = "" }: LoadingSpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-10 ${className}`}>
      <svg className="w-7 h-7 animate-spin text-signal" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.2" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <p className="text-sm text-txt-tertiary">{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center px-4">
      <div className="w-9 h-9 rounded-full border border-cii-e/40 flex items-center justify-center text-cii-e">
        !
      </div>
      <p className="text-sm text-txt-secondary max-w-md">{message}</p>
      {onRetry && (
        <button type="button" className="btn-ghost" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center px-4">
      <p className="text-sm text-txt-secondary">{title}</p>
      {hint && <p className="text-xs text-txt-tertiary max-w-sm">{hint}</p>}
    </div>
  );
}

export default LoadingSpinner;
