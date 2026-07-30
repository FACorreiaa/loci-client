import { Component, Show, For } from "solid-js";
import { FiArrowLeft, FiCheck } from "solid-icons/fi";

// Auth Layout Component
const AuthLayout: Component<{ children: any; showBackButton?: boolean; onBack?: () => void }> = (
  props,
) => {
  return (
    <div class="min-h-screen relative overflow-hidden bg-gradient-to-br from-background via-muted/40 to-background text-foreground">
      <div class="absolute inset-0 opacity-60 hidden dark:block">
        <div class="domain-grid" aria-hidden="true" />
        <div class="domain-veil" aria-hidden="true" />
        <div class="domain-halo" aria-hidden="true" />
      </div>

      <div class="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-center">
          {/* Story column */}
          <div class="hidden lg:block">
            <div class="loci-card space-y-6 p-8">
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold uppercase tracking-[0.2em]">
                Travel OS
              </div>
              <h1 class="text-4xl font-extrabold leading-tight text-foreground">
                Join the taste-aware planner.
                <span class="block text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary">
                  Itineraries, restaurants, hotels — aligned to you.
                </span>
              </h1>
              <p class="text-lg leading-relaxed text-muted-foreground">
                Your profile learns coffee strength, walking pace, bedtime, and accessibility needs.
                Every suggestion is annotated and ready for offline.
              </p>
              <div class="grid grid-cols-2 gap-3">
                <For
                  each={[
                    "Two-click rebooks and live tweaks",
                    "Accessibility and budget cues surfaced",
                    "Save once, sync across devices",
                    "Native iOS + Android coming soon",
                  ]}
                >
                  {(item) => (
                    <div class="flex items-start gap-2 rounded-2xl p-3 bg-muted/50 border border-border">
                      <FiCheck class="w-4 h-4 text-primary mt-0.5" />
                      <span class="text-sm text-foreground">{item}</span>
                    </div>
                  )}
                </For>
              </div>
              <div class="text-sm text-muted-foreground">
                No spam. Your data stays yours. Delete anytime in settings.
              </div>
            </div>
          </div>

          {/* Auth card */}
          <div class="w-full max-w-xl mx-auto">
            <Show when={props.showBackButton}>
              <button
                onClick={() => props.onBack?.()}
                class="flex items-center gap-2 mb-4 sm:mb-6 text-muted-foreground hover:text-primary transition-colors"
              >
                <FiArrowLeft class="w-4 h-4" />
                <span class="text-sm font-medium">Back</span>
              </button>
            </Show>

            <div class="rounded-3xl p-5 sm:p-6 lg:p-7 bg-card border border-border text-card-foreground shadow-lg dark:shadow-[0_30px_100px_rgba(3,7,18,0.65)]">
              <div class="flex items-center gap-2 mb-6">
                <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 border border-primary/30 text-primary backdrop-blur flex items-center justify-center font-bold shadow-md">
                  L
                </div>
                <span class="text-lg sm:text-xl font-bold tracking-tight">Loci</span>
                <span class="text-xs px-2 py-1 rounded-full ml-auto bg-primary/10 border border-primary/30 text-primary">
                  Private beta
                </span>
              </div>

              {props.children}
            </div>

            <div class="text-center mt-4 sm:mt-6 text-xs sm:text-sm px-2 sm:px-0 text-muted-foreground">
              By continuing, you agree to our{" "}
              <a href="#" class="text-primary hover:text-primary/80 underline-offset-4">
                Terms
              </a>{" "}
              and{" "}
              <a href="#" class="text-primary hover:text-primary/80 underline-offset-4">
                Privacy
              </a>
              .
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
