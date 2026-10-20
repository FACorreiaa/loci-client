import { Show } from "solid-js";

/**
 * Store listings. Swapping to a real listing is one line here.
 *
 * Loci is not on the App Store yet, so the TestFlight invite is the only way
 * onto an iPhone; the Apple badge links there with a "Beta · TestFlight"
 * caption. When the listing ships, set IOS_APP_STORE_URL and the caption goes.
 * Android has no build, so the Play badge is muted and is not a link.
 */
export const IOS_APP_STORE_URL: string | null = null;
export const IOS_BETA_URL: string | null = "https://testflight.apple.com/join/cws22xMw";
export const ANDROID_PLAY_URL: string | null = null;

export type StoreState =
  | { kind: "live"; href: string }
  | { kind: "beta"; href: string }
  | { kind: "soon" };

/** A real listing beats a beta invite; neither means "coming soon". */
export function storeState(listing: string | null, beta: string | null = null): StoreState {
  if (listing) return { kind: "live", href: listing };
  if (beta) return { kind: "beta", href: beta };
  return { kind: "soon" };
}

type Store = "apple" | "google";

const storeName: Record<Store, string> = {
  apple: "App Store",
  google: "Google Play",
};

const badgeText: Record<Store, string> = {
  apple: "Download on the App Store",
  google: "Get it on Google Play",
};

/**
 * The official artwork, unaltered. Apple's SVG is the badge edge to edge;
 * Google's PNG carries 41px of transparent padding around a 564x168 badge in a
 * 646x250 canvas, so it is drawn larger and pulled in by that padding to make
 * the visible badges the same height (2.75rem — above the 40px minimum).
 */
function BadgeArt(props: { store: Store; alt: string }) {
  return (
    <Show
      when={props.store === "apple"}
      fallback={
        <span class="block h-11">
          <img
            src="/images/badges/google-play-badge.png"
            alt={props.alt}
            width="646"
            height="250"
            decoding="async"
            class="-m-[calc(2.75rem*41/168)] block h-[calc(2.75rem*250/168)] w-auto max-w-none"
          />
        </span>
      }
    >
      <img
        src="/images/badges/download-on-the-app-store.svg"
        alt={props.alt}
        width="120"
        height="40"
        decoding="async"
        class="block h-11 w-auto dark:hidden"
      />
      <img
        src="/images/badges/download-on-the-app-store-white.svg"
        alt={props.alt}
        width="120"
        height="40"
        decoding="async"
        class="hidden h-11 w-auto dark:block"
      />
    </Show>
  );
}

function Caption(props: { children: string }) {
  return (
    <span class="font-coord text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground">
      {props.children}
    </span>
  );
}

export function StoreBadge(props: { store: Store; state: StoreState }) {
  const linked = () => (props.state.kind === "soon" ? undefined : props.state.href);
  return (
    <div class="flex flex-col items-center gap-1.5" data-store={props.store}>
      <Show
        when={linked()}
        fallback={
          <span class="block opacity-45 grayscale" data-state="soon">
            <BadgeArt store={props.store} alt={`${storeName[props.store]} — coming soon`} />
          </span>
        }
      >
        {(href) => (
          <a
            href={href()}
            target="_blank"
            rel="noopener noreferrer"
            data-state={props.state.kind}
            class="block rounded-[0.6rem] transition-opacity hover:opacity-85"
          >
            <BadgeArt
              store={props.store}
              alt={
                props.state.kind === "beta"
                  ? `${badgeText[props.store]} — beta on TestFlight`
                  : badgeText[props.store]
              }
            />
          </a>
        )}
      </Show>
      <Show when={props.state.kind !== "live"}>
        <span aria-hidden="true">
          <Caption>{props.state.kind === "beta" ? "Beta · TestFlight" : "Coming soon"}</Caption>
        </span>
      </Show>
    </div>
  );
}

/** Native-app row under the hero and in the final call to action. */
export default function AppButtons(props: { class?: string }) {
  return (
    <div
      class={`flex flex-col items-center gap-x-6 gap-y-4 sm:flex-row sm:items-start ${props.class ?? ""}`}
    >
      <StoreBadge store="apple" state={storeState(IOS_APP_STORE_URL, IOS_BETA_URL)} />
      <StoreBadge store="google" state={storeState(ANDROID_PLAY_URL)} />
    </div>
  );
}
