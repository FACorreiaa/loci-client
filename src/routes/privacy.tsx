import { For } from "solid-js";
import { A } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";

// Linked from the App Store listing as the privacy policy URL. Keep it in step
// with loci-ios/loci/loci/PrivacyInfo.xcprivacy and the App Privacy answers in
// App Store Connect: a claim here that the app does not keep is a review risk.
const CONTACT = "fernandocorreia316@gmail.com";
const UPDATED = "2 October 2026";

const sections = [
  {
    title: "What we collect",
    items: [
      "Account: your email address and a user ID, from signing up with email or with Apple or Google.",
      "What you plan: the trip requests you type or dictate, the itineraries Loci builds, and what you save, list, review or contribute.",
      "Location: your precise location, only while you use a feature that needs it (places near you, planning from where you are, a walk you start). Loci does not track you in the background otherwise.",
      "Voice: when you turn the mic on, the audio is sent to our own transcription server, turned into text and discarded. It is not sent to a third party and not kept.",
      "Usage: product events (screens opened, buttons used, errors) so we can see what works and fix what breaks.",
      "Points: a record of what earned them (a daily check-in, a search, a place visited, a city, a trip day walked, a confirmed report), your streak and your badges.",
    ],
  },
  {
    title: "Friends",
    items: [
      "Friends are mutual: someone asks and you accept, or you open their invite link. Only then are you friends.",
      "Friends see your name, username, photo and home city, your trips you share with friends, and on the leaderboard your level, streak, and points or counts of cities and places. They never see your location, your phone number or your email.",
      "You can leave your friends' leaderboards in the iOS app's Settings → Notifications (\"Show me on friends' leaderboards\"). Blocking someone ends the friendship and hides you from each other.",
      "Contacts: if you choose to find friends from your contacts, your phone turns each number and email into a one-way fingerprint (SHA-256) and sends only those. We compare them with Loci accounts that verified that number or email and keep nothing for contacts who are not on Loci.",
      'Phone number: if you choose "Let friends find you by number", we text you a code to check the number is yours, then keep it on your account so people who have it in their contacts can find you. It is never shown to anyone.',
      "Facebook: if you connect Facebook, we receive your Facebook ID for this app and the list of your Facebook friends who also connected Loci. We use it only to suggest those friends, replace it each time you connect, and never post to Facebook.",
      "Visits: when the app records a place you reached (Near me, or walking a trip day), it sends where your phone was at that moment so the visit can be checked before it earns points. It is not used to track you.",
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
      "Twilio sends the text message with your code, if you verify a phone number.",
      "Meta (Facebook) confirms your Facebook account and the friends list above, if you connect Facebook.",
      "Calendly or Telegram, only if you connect them yourself in Settings.",
      "We do not sell your data and do not use it for advertising.",
    ],
  },
  {
    title: "Keeping and deleting",
    items: [
      "Your data is kept while your account exists.",
      "Settings lets you export everything Loci holds about you, or delete your account.",
      "Deleting your account removes your trips, saves and profile, and with them your friendships, points, badges, verified phone number and Facebook link.",
      "Disconnect Facebook at any time in your Facebook settings (Apps and websites); deleting your Loci account removes everything we got from it.",
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
