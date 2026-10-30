import { createSignal, createEffect, Show } from "solid-js";
import { MapPin, X, Navigation, AlertCircle } from "lucide-solid";
import { useUserLocation } from "~/contexts/LocationContext";

interface LocationPermissionPromptProps {
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
  className?: string;
}

export default function LocationPermissionPrompt(props: LocationPermissionPromptProps) {
  const { requestLocation, permissionStatus, isLoadingLocation, error } = useUserLocation();
  const [isVisible, setIsVisible] = createSignal(true);
  const [hasRequested, setHasRequested] = createSignal(false);

  const handleRequestLocation = async () => {
    setHasRequested(true);
    try {
      await requestLocation();
      if (props.onPermissionGranted) {
        props.onPermissionGranted();
      }
      setTimeout(() => setIsVisible(false), 2000); // Hide after success
    } catch (_err) {
      if (props.onPermissionDenied) {
        props.onPermissionDenied();
      }
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    if (props.onPermissionDenied) {
      props.onPermissionDenied();
    }
  };

  // Auto-hide if permission is already granted
  createEffect(() => {
    if (permissionStatus() === "granted") {
      setIsVisible(false);
    }
  });

  return (
    <Show when={isVisible() && permissionStatus() !== "granted"}>
      <div
        class={`fixed bottom-4 right-4 max-w-sm bg-card rounded-lg shadow-lg border border-border p-4 z-50 ${props.className || ""}`}
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          class="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-muted-foreground transition-colors"
          aria-label="Close"
        >
          <X class="w-4 h-4" />
        </button>

        <div class="pr-6">
          {/* Header */}
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 bg-holo/10 rounded-full flex items-center justify-center">
              <MapPin class="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 class="font-semibold text-foreground text-sm">Better Recommendations</h3>
              <p class="text-xs text-muted-foreground">Find places near you</p>
            </div>
          </div>

          {/* Content */}
          <Show when={!hasRequested()}>
            <p class="text-sm text-muted-foreground mb-4">
              Allow location access to get personalized recommendations and accurate distances to
              nearby places.
            </p>

            <div class="flex gap-2">
              <button
                onClick={handleRequestLocation}
                disabled={isLoadingLocation()}
                class="flex-1 bg-primary text-primary-foreground text-sm font-medium px-3 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Show when={isLoadingLocation()} fallback={<Navigation class="w-4 h-4" />}>
                  <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </Show>
                <span>{isLoadingLocation() ? "Requesting..." : "Allow Location"}</span>
              </button>

              <button
                onClick={handleDismiss}
                class="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip
              </button>
            </div>
          </Show>

          {/* Error state */}
          <Show when={error()}>
            <div class="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
              <AlertCircle class="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <div class="text-sm">
                <p class="text-destructive font-medium">Location access denied</p>
                <p class="text-destructive text-xs mt-1">
                  You can still use the app, but distances won't be calculated.
                </p>
              </div>
            </div>
          </Show>

          {/* Success state */}
          <Show when={permissionStatus() === "granted"}>
            <div class="flex items-center gap-2 text-success text-sm">
              <div class="w-4 h-4 bg-success rounded-full flex items-center justify-center">
                <div class="w-2 h-2 bg-card rounded-full" />
              </div>
              <span>Location enabled! You'll see distances to nearby places.</span>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
