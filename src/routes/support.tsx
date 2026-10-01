import { For } from "solid-js";
import { A } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";

// Linked from the App Store listing as the support URL; App Review checks that
// it gives a way to reach a person.
const CONTACT = "fernandocorreia316@gmail.com";

const faqs = [
  {
    q: "My itinerary is taking long or came back empty.",
    a: "Plans stream in stop by stop and usually finish within a minute. If one stalls, ask again. If it keeps happening, email us the city and roughly when you tried.",
  },
  {
    q: "Loci can't find places near me.",
    a: "Near me needs location access while you use the app. On iPhone: Settings → Loci → Location → While Using the App.",
  },
  {
    q: "The mic button is missing or does nothing.",
    a: "Dictation needs microphone permission. On iPhone: Settings → Loci → Microphone.",
  },
  {
    q: "How do I export or delete my data, or my account?",
    a: "Settings has export and account deletion. Deleting your account removes your trips, saves and profile.",
  },
];

export default function Support() {
  return (
    <>
      <Title>Support - Loci</Title>
      <Meta name="description" content="Get help with Loci on the web and iOS." />
      <link rel="canonical" href="https://lociai.fyi/support" />

      <div class="min-h-screen bg-background text-foreground">
        <article class="mx-auto max-w-3xl space-y-10 px-4 py-12">
          <header class="space-y-3">
            <p class="text-sm uppercase tracking-[0.2em] text-primary">Support</p>
            <h1 class="text-4xl font-bold">Something not working?</h1>
            <p class="leading-7 text-muted-foreground">
              Email{" "}
              <a class="text-primary underline underline-offset-4" href={`mailto:${CONTACT}`}>
                {CONTACT}
              </a>{" "}
              with what you tried, the city, and a screenshot if you can. A person reads every
              message.
            </p>
          </header>

          <section class="space-y-6">
            <h2 class="text-2xl font-semibold">Common questions</h2>
            <For each={faqs}>
              {(faq) => (
                <div class="space-y-1">
                  <h3 class="font-semibold">{faq.q}</h3>
                  <p class="leading-7 text-muted-foreground">{faq.a}</p>
                </div>
              )}
            </For>
          </section>

          <p class="text-muted-foreground">
            How we handle your data:{" "}
            <A class="text-primary underline underline-offset-4" href="/privacy">
              Privacy policy
            </A>
            .
          </p>
        </article>
      </div>
    </>
  );
}
