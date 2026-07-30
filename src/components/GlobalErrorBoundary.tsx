// Global Error Boundary component for catching unhandled errors
import { ErrorBoundary as SolidErrorBoundary, Component, JSX, createSignal } from "solid-js";

interface ErrorBoundaryProps {
  children: JSX.Element;
}

interface ErrorFallbackProps {
  error: Error;
  reset: () => void;
}

const ErrorFallback: Component<ErrorFallbackProps> = (props) => {
  const [showDetails, setShowDetails] = createSignal(false);

  // Use window.location (not useNavigate): this fallback can render ABOVE the
  // Router, where router primitives throw "can only be used inside a Route".
  const handleGoHome = () => {
    props.reset();
    if (typeof window !== "undefined") window.location.assign("/");
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div class="min-h-screen flex items-center justify-center bg-background p-4">
      {/* `bg-white/10` over a heavy blur only reads on a dark backdrop; on light
          it was a near-invisible card. Tokens work on both. */}
      <div class="loci-card max-w-md w-full p-8 text-center">
        {/* Error Icon */}
        <div class="w-16 h-16 mx-auto mb-6 rounded-full bg-destructive/15 flex items-center justify-center">
          <svg
            class="w-8 h-8 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1 class="text-2xl font-bold text-foreground mb-2">Something went wrong</h1>
        <p class="text-muted-foreground mb-6">
          We encountered an unexpected error. Don't worry, your data is safe.
        </p>

        {/* Action Buttons */}
        <div class="flex flex-col gap-3 mb-6">
          <button
            onClick={handleRefresh}
            class="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Refresh Page
          </button>
          <button
            onClick={handleGoHome}
            class="w-full rounded-xl border border-border px-4 py-3 font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Go to Home
          </button>
        </div>

        {/* Error Details Toggle */}
        <button
          onClick={() => setShowDetails(!showDetails())}
          class="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {showDetails() ? "Hide" : "Show"} technical details
        </button>

        {showDetails() && (
          <div class="mt-4 p-4 bg-black/30 rounded-lg text-left overflow-auto max-h-48">
            <p class="font-mono text-xs text-destructive break-all">
              {props.error.name}: {props.error.message}
            </p>
            {props.error.stack && (
              <pre class="mt-2 font-mono text-xs text-muted-foreground whitespace-pre-wrap break-all">
                {props.error.stack}
              </pre>
            )}
          </div>
        )}

        {/* Support Link */}
        <p class="mt-6 text-sm text-muted-foreground">
          If this keeps happening, please{" "}
          <a href="mailto:support@loci.app" class="text-primary underline hover:no-underline">
            contact support
          </a>
        </p>
      </div>
    </div>
  );
};

/**
 * Global Error Boundary wrapper that catches unhandled errors
 * and displays a user-friendly error page.
 */
export const GlobalErrorBoundary: Component<ErrorBoundaryProps> = (props) => {
  return (
    <SolidErrorBoundary
      fallback={(error, reset) => {
        // Log error for debugging
        console.error("GlobalErrorBoundary caught error:", error);

        // Report to error tracking service (e.g., Sentry) here
        // if (typeof window !== 'undefined' && window.Sentry) {
        //   window.Sentry.captureException(error);
        // }

        return <ErrorFallback error={error} reset={reset} />;
      }}
    >
      {props.children}
    </SolidErrorBoundary>
  );
};

export default GlobalErrorBoundary;
