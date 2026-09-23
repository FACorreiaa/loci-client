// The app's one toast stack — currently only fed by RunWatcher, for a search
// that finished (or failed) while you were on another page.
import { For } from "solid-js";
import { A } from "@solidjs/router";
import { dismissToast, toasts } from "~/lib/toast-store";

export default function Toaster() {
  return (
    <div
      role="status"
      aria-live="polite"
      class="fixed z-50 bottom-24 md:bottom-6 right-4 left-4 md:left-auto flex flex-col gap-2 md:w-96"
    >
      <For each={toasts}>
        {(t) => (
          <div class="loci-card text-card-foreground shadow-lg p-3 flex items-center gap-3">
            <p class="flex-1 text-sm font-medium">{t.title}</p>
            {t.secondary && (
              <button
                type="button"
                class="text-sm text-muted-foreground"
                onClick={() => t.secondary!.run()}
              >
                {t.secondary.label}
              </button>
            )}
            {t.action?.href ? (
              <A
                href={t.action.href}
                class="text-sm font-semibold text-primary"
                onClick={() => dismissToast(t.id)}
              >
                {t.action.label}
              </A>
            ) : t.action ? (
              <button
                type="button"
                class="text-sm font-semibold text-primary"
                onClick={() => {
                  t.action!.run?.();
                  dismissToast(t.id);
                }}
              >
                {t.action.label}
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Dismiss"
              class="text-muted-foreground"
              onClick={() => dismissToast(t.id)}
            >
              &times;
            </button>
          </div>
        )}
      </For>
    </div>
  );
}
