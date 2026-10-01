import { For } from "solid-js";
import { A } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";

// Linked from the App Store listing as the privacy policy URL. Keep it in step
// with loci-ios/loci/loci/PrivacyInfo.xcprivacy and the App Privacy answers in
// App Store Connect: a claim here that the app does not keep is a review risk.
const CONTACT = "fernandocorreia316@gmail.com";
const UPDATED = "1 October 2026";

const sections = [
  {
    title: "What we collect",
    items: [
      "Account: your email address and a user ID, from signing up with email or with Apple or Google.",
      "What you plan: the trip requests you type or dictate, the itineraries Loci builds, and what you save, list, review or contribute.",
      "Location: your precise location, only while you use a feature that needs it (places near you, planning from where you are, a walk you start). Loci does not track you in the background otherwise.",
      "Voice: when you turn the mic on, the audio is sent to our own transcription server, turned into text and discarded. It is not sent to a third party and not kept.",
      "Usage: product events (screens opened, buttons used, errors) so we can see what works and fix what breaks.",
    ],
  },
  {
    title: "How we use it",
    items: [
      "To build, save and show your trips, and to sync them between the web and the iOS app.",
      "To check live conditions for the places in a plan: weather, public holidays, natural hazards and exchange rates.",
      "To learn which places you keep and skip, so suggestions fit your taste. You can see and delete what Loci has learned in Settings → What Loci remembers.",
      "To fix bugs and decide what to build next.",
    ],
  },
  {
    title: "Who else sees it",
    items: [
      "AI model providers (Google Gemini, OpenRouter) receive the text of a trip request to write the itinerary. They do not receive your email.",
      "Live-data services (weather, holidays, hazards, exchange rates) receive city names or coordinates, never who is asking.",
      "Mapbox serves map tiles to your device.",
      "PostHog stores usage events.",
      "Apple or Google confirm your identity when you sign in with them.",
      "Calendly or Telegram, only if you connect them yourself in Settings.",
      "We do not sell your data and do not use it for advertising.",
    ],
  },
  {
    title: "Keeping and deleting",
    items: [
      "Your data is kept while your account exists.",
      "Settings lets you export everything Loci holds about you, or delete your account.",
      "Deleting your account removes your trips, saves and profile.",
    ],
  },
  {
    title: "Children",
    items: ["Loci is not meant for children under 13, and we do not knowingly collect their data."],
  },
];

export default function Privacy() {
  return (
    <>
      <Title>Privacy Policy - Loci</Title>
      <Meta
        name="description"
        content="What Loci collects, why, who else sees it, and how to export or delete your data."
      />
      <link rel="canonical" href="https://lociai.fyi/privacy" />

      <div class="min-h-screen bg-background text-foreground">
        <article class="mx-auto max-w-3xl space-y-10 px-4 py-12">
          <header class="space-y-3">
            <p class="text-sm uppercase tracking-[0.2em] text-primary">Privacy policy</p>
            <h1 class="text-4xl font-bold">Your trips are yours.</h1>
            <p class="text-muted-foreground">Last updated {UPDATED}.</p>
            <p class="leading-7 text-muted-foreground">
              This covers the Loci website (lociai.fyi) and the Loci iOS app. It says what we
              collect, why, and what you can do about it.
            </p>
          </header>

          <For each={sections}>
            {(section) => (
              <section class="space-y-3">
                <h2 class="text-2xl font-semibold">{section.title}</h2>
                <ul class="list-disc space-y-2 pl-5 leading-7 text-muted-foreground">
                  <For each={section.items}>{(item) => <li>{item}</li>}</For>
                </ul>
              </section>
            )}
          </For>

          <section class="space-y-3">
            <h2 class="text-2xl font-semibold">Contact</h2>
            <p class="leading-7 text-muted-foreground">
              Questions or requests about your data:{" "}
              <a class="text-primary underline underline-offset-4" href={`mailto:${CONTACT}`}>
                {CONTACT}
              </a>
              . We will tell you here if this policy changes. For help with the app itself, see{" "}
              <A class="text-primary underline underline-offset-4" href="/support">
                Support
              </A>
              .
            </p>
          </section>
        </article>
      </div>
    </>
  );
}
