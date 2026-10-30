import { Component, createSignal, JSX, Show } from "solid-js";
import { A } from "@solidjs/router";
import { AlertTriangle, RefreshCw, Home, ServerCrash } from "lucide-solid";
import { APIError } from "../lib/api";

interface ErrorBoundaryProps {
  children: JSX.Element;
  fallback?: (error: Error, reset: () => void) => JSX.Element;
}

interface ErrorInfo {
  error: Error;
  timestamp: Date;
  retryCount: number;
}

const ErrorBoundary: Component<ErrorBoundaryProps> = (props) => {
  const [errorInfo, setErrorInfo] = createSignal<ErrorInfo | null>(null);

  const handleError = (error: Error) => {
    console.error("🚨 ErrorBoundary caught error:", error);
    setErrorInfo({
      error,
      timestamp: new Date(),
      retryCount: errorInfo()?.retryCount ?? 0,
    });
  };

  const reset = () => {
    setErrorInfo(null);
  };

  const retry = () => {
    const current = errorInfo();
    if (current) {
      setErrorInfo({
        ...current,
        retryCount: current.retryCount + 1,
      });
    }
    reset();
    // Optionally refresh the page for a clean state
    window.location.reload();
  };

  // Custom error boundary using SolidJS patterns
  const ErrorDisplay: Component = () => {
    const error = errorInfo()?.error;

    return (
      <Show when={error} fallback={<>{props.children}</>}>
        <Show
          when={props.fallback}
          fallback={
            <div class="min-h-screen flex items-center justify-center px-4 py-8">
              <div class="loci-card text-center max-w-md mx-auto p-8">
                {/* Dynamic Icon based on error type */}
                <div class="mb-8 relative">
                  <div
                    class={`w-24 h-24 mx-auto rounded-full flex items-center justify-center animate-pulse shadow-[0_18px_38px_rgba(248,113,113,0.25)] ${
                      error instanceof APIError && error.code === "CONNECTION_REFUSED"
                        ? "bg-lantern"
                        : error instanceof APIError && error.code === "NETWORK_ERROR"
                          ? "bg-lantern"
                          : "bg-destructive"
                    }`}
                  >
                    <Show
                      when={error instanceof APIError && error.code === "CONNECTION_REFUSED"}
                      fallback={
                        <Show
                          when={error instanceof APIError && error.code === "NETWORK_ERROR"}
                          fallback={<AlertTriangle class="w-12 h-12 text-white" />}
                        >
                          <ServerCrash class="w-12 h-12 text-white" />
                        </Show>
                      }
                    >
                      <ServerCrash class="w-12 h-12 text-white" />
                    </Show>
                  </div>
                </div>

                {/* Error Message */}
                <h1 class="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                  {error instanceof APIError && error.code === "CONNECTION_REFUSED"
                    ? "Server Unavailable"
                    : error instanceof APIError && error.code === "NETWORK_ERROR"
                      ? "Network Error"
                      : "Something went wrong"}
                </h1>

                <p class="text-muted-foreground mb-6 leading-relaxed">
                  {error instanceof APIError && error.code === "CONNECTION_REFUSED"
                    ? "We't reach our servers right now. They might be down for maintenance or experiencing issues."
                    : error instanceof APIError && error.code === "NETWORK_ERROR"
                      ? "There seems to be a problem with your network connection. Please check your internet connection and try again."
                      : "An unexpected error occurred. Our team has been notified and is working on a fix."}
                </p>

                {/* Error Details (in development) */}
                <Show when={import.meta.env.DEV}>
                  <details class="mb-6 text-left">
                    <summary class="cursor-pointer text-sm text-muted-foreground mb-2">
                      Error Details (dev only)
                    </summary>
                    <div class="bg-muted p-3 rounded text-xs font-mono text-foreground overflow-auto max-h-32">
                      <div class="mb-2">
                        <strong>Message:</strong> {error!.message}
                      </div>
                      <div class="mb-2">
                        <strong>Type:</strong> {error!.constructor.name}
                      </div>
                      <Show when={error instanceof APIError}>
                        <div class="mb-2">
                          <strong>Status:</strong> {(error as APIError).status}
                        </div>
                        <div class="mb-2">
                          <strong>Code:</strong> {(error as APIError).code}
                        </div>
                      </Show>
                      <div>
                        <strong>Retry Count:</strong> {errorInfo()?.retryCount ?? 0}
                      </div>
                    </div>
                  </details>
                </Show>

                {/* Action Buttons */}
                <div class="space-y-3 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center mb-8">
                  <button
                    onClick={retry}
                    class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                  >
                    <RefreshCw class="w-4 h-4" />
                    Try Again
                  </button>
                  <A
                    href="/"
                    class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-muted text-foreground rounded-lg hover:bg-muted transition-colors font-medium"
                  >
                    <Home class="w-4 h-4" />
                    Back to Home
                  </A>
                </div>

                {/* Helpful Links for specific errors */}
                <Show when={error instanceof APIError && error.code === "CONNECTION_REFUSED"}>
                  <div class="text-sm text-muted-foreground">
                    <p class="mb-2">While our servers are down, you can still:</p>
                    <div class="flex flex-wrap justify-center gap-2">
                      <A href="/saved" class="text-primary hover:text-primary">
                        View Favorites
                      </A>
                      <span>•</span>
                      <A href="/lists" class="text-primary hover:text-primary">
                        Browse Lists
                      </A>
                      <span>•</span>
                      <A href="/profile" class="text-primary hover:text-primary">
                        Edit Profile
                      </A>
                    </div>
                  </div>
                </Show>
              </div>
            </div>
          }
        >
          <>{props.fallback!(error as Error, reset)}</>
        </Show>
      </Show>
    );
  };

  // Handle errors in child components
  return (
    <Show when={!errorInfo()} fallback={<ErrorDisplay />}>
      <div onError={(e: any) => handleError(e)}>{props.children}</div>
    </Show>
  );
};

export default ErrorBoundary;
