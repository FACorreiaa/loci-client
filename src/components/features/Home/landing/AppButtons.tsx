import { Smartphone } from "lucide-solid";

/**
 * Public TestFlight invite. Loci is not on the App Store yet, so this is the
 * only way onto an iPhone. When it ships, swap this for the apps.apple.com
 * listing and drop the Beta tag below.
 */
export const IOS_BETA_URL = "https://testflight.apple.com/join/cws22xMw";

/**
 * Native-app row under the hero and the final call to action.
 *
 * No Apple or Google artwork: the official badges say "Download on the App
 * Store", which a TestFlight link is not. Android has no build yet, so it is a
 * plain label rather than a link that goes nowhere.
 */
export default function AppButtons(props: { class?: string }) {
  return (
    <div class={`flex flex-wrap items-center gap-3 ${props.class ?? ""}`}>
      <a
        href={IOS_BETA_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Join the Loci iPhone beta on TestFlight"
        class="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:border-accent hover:bg-muted/50"
      >
        <Smartphone class="h-4 w-4" aria-hidden="true" />
        iPhone app
        <span class="font-coord rounded-full bg-accent/15 px-1.5 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] text-accent">
          Beta
        </span>
      </a>
      <span class="inline-flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2 text-sm text-muted-foreground">
        <Smartphone class="h-4 w-4" aria-hidden="true" />
        Android · coming soon
      </span>
    </div>
  );
}
