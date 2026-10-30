import { Component, Show, For } from "solid-js";
import { FiArrowLeft, FiCheck } from "solid-icons/fi";
import { LociLogo } from "~/components/brand/Logo";

// Auth Layout Component
const AuthLayout: Component<{ children: any; showBackButton?: boolean; onBack?: () => void }> = (
  props,
) => {
  return (
    <div class="min-h-screen relative overflow-hidden bg-background text-foreground">
      <div class="absolute inset-0 opacity-60 hidden dark:block">
        <div class="domain-grid" aria-hidden="true" />
        <div class="domain-veil" aria-hidden="true" />
        <div class="domain-halo" aria-hidden="true" />
      </div>

      <div class="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-center">
          {/* Story column. The page's h1 belongs to the form (it names the
              task); this column is supporting copy, so it is an h2. */}
          <aside class="hidden lg:block" aria-labelledby="auth-story-heading">
            <div class="loci-card space-y-6 p-8">
              <h2
                id="auth-story-heading"
                class="font-display text-4xl font-semibold leading-tight text-foreground text-balance"
              >
                The plan that knows what changed today.
                <span class="block text-primary">
                  Itineraries, restaurants, hotels — aligned to you.
                </span>
              </h2>
              <p class="text-lg leading-relaxed text-muted-foreground">
                Your profile learns coffee strength, walking pace, bedtime, and accessibility needs.
                Every suggestion is annotated and ready for offline.
              </p>
              <ul class="grid grid-cols-2 gap-3" role="list">
                <For
                  each={[
                    "Two-click rebooks and live tweaks",
                    "Accessibility and budget cues surfaced",
                    "Save once, sync across devices",
                    "Plan together: invite friends to a trip",
                  ]}
                >
                  {(item) => (
                    <li class="flex items-start gap-2 rounded-xl p-3 bg-muted/50 border border-border">
                      <FiCheck class="w-4 h-4 text-primary mt-0.5 shrink-0" aria-hidden="true" />
                      <span class="text-sm text-foreground">{item}</span>
                    </li>
                  )}
                </For>
              </ul>
              <div class="text-sm text-muted-foreground">
                No spam. Your data stays yours. Delete anytime in settings.
              </div>
            </div>
          </aside>

          {/* Auth card */}
          <div class="w-full max-w-xl mx-auto">
            <Show when={props.showBackButton}>
              <button
                type="button"
                onClick={() => props.onBack?.()}
                class="flex items-center gap-2 mb-4 sm:mb-6 text-muted-foreground hover:text-primary transition-colors"
              >
                <FiArrowLeft class="w-4 h-4" aria-hidden="true" />
                <span class="text-sm font-medium">Back</span>
              </button>
            </Show>

            <div class="loci-card p-5 sm:p-6 lg:p-7 text-card-foreground">
              <div class="flex items-center gap-2 mb-6">
                {/* The lockup already reads "Loci", so the tile and the text
                    label it stood in for are both gone rather than doubled. */}
                <LociLogo class="h-7 sm:h-8 w-auto" />
                <span class="text-xs px-2 py-1 rounded-full ml-auto bg-primary/10 border border-primary/30 text-primary">
                  Private beta
                </span>
              </div>

              {props.children}
            </div>

            <div class="text-center mt-4 sm:mt-6 text-xs sm:text-sm px-2 sm:px-0 text-muted-foreground">
              By continuing, you agree to our{" "}
              <a
                href="/privacy"
                class="inline-flex min-h-11 items-center text-primary hover:text-primary/80 underline-offset-4 sm:min-h-0"
              >
                Terms
              </a>{" "}
              and{" "}
              <a
                href="/privacy"
                class="inline-flex min-h-11 items-center text-primary hover:text-primary/80 underline-offset-4 sm:min-h-0"
              >
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
