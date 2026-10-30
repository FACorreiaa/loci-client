// Global Error Boundary component for catching unhandled errors
import { ErrorBoundary as SolidErrorBoundary, Component, JSX, Show, createSignal } from "solid-js";
import { Mascot } from "~/components/brand/Mascot";
import { capture, captureException } from "~/lib/analytics";
import { DISCORD_URL } from "~/lib/links";

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
        {/* Decorative: the heading says what happened. */}
        <Mascot state="error" width={104} decorative class="mx-auto mb-6" />

        <h1 class="font-display text-2xl font-semibold tracking-tight text-foreground mb-2">
          Something went wrong
        </h1>
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

        {/* Error Details Toggle — dev only. Stack traces never ship to users;
            production errors are reported via captureException instead. */}
        <Show when={import.meta.env.DEV}>
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
        </Show>

        {/* Support Link */}
        <p class="mt-6 text-sm text-muted-foreground">
          If this keeps happening, please{" "}
          <a href="mailto:support@loci.app" class="text-primary underline hover:no-underline">
            contact support
          </a>
          {" · "}
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => capture("discord_link_clicked", { surface: "support" })}
            class="text-primary underline hover:no-underline"
          >
            Join us on Discord
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

        captureException(error);

        return <ErrorFallback error={error} reset={reset} />;
      }}
    >
      {props.children}
    </SolidErrorBoundary>
  );
};

export default GlobalErrorBoundary;
