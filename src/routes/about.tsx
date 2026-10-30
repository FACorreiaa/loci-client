import { For } from "solid-js";
import { A } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import { Button } from "~/ui/button";

// Quieter about page. One editorial column on the cream ground, Fraunces for
// the headings, solid tokens for every colour. The earlier version carried
// gradient tiles in hex, a "Catppuccin Latte" line that described the old
// theme rather than the product, side-stripe phase markers and emoji in the
// lede; all of them sat outside DESIGN.md and none said anything a reader
// needed. The roadmap is a real sequence, so it is the one place numbers stay.

const PILLARS = [
  {
    title: "Curation with sources",
    body: "Every pick comes with a note on why it is here and where the claim came from. No anonymous top-ten lists.",
  },
  {
    title: "Aligned to you, not to the average",
    body: "Your interests, your pace, your budget and how you get around shape the plan before the first suggestion appears.",
  },
  {
    title: "Knows what changed today",
    body: "Opening hours, closures and weather are checked against the plan, so the itinerary you leave with still holds when you arrive.",
  },
];

const STACK = [
  {
    title: "Recommendation engine",
    body: "Direct Google Gemini integration for personalisation that adapts to your preferences over time.",
  },
  {
    title: "Geospatial queries",
    body: "PostgreSQL with PostGIS for precise location-based search and spatial analysis around where you are.",
  },
  {
    title: "Semantic search",
    body: "pgvector embeddings so a request like “quiet, old, good coffee” finds places that match the feeling, not the keyword.",
  },
  {
    title: "Fast, everywhere",
    body: "A Go backend and a SolidJS front end. Streaming responses, offline reading, one codebase from phone to desktop.",
  },
];

const ROADMAP = [
  {
    phase: "Now",
    title: "Core engine and itineraries",
    body: "Recommendations powered by Gemini, accounts, the interactive map, and personalised itinerary creation.",
  },
  {
    phase: "Next",
    title: "Pro and a richer engine",
    body: "Premium tier, embeddings-backed search, speech input, itinerary import and export, and an always-on travel agent.",
  },
  {
    phase: "Later",
    title: "More cities, native apps",
    body: "Multi-city trips, curated content partnerships, and native iOS and Android apps.",
  },
];

export default function About() {
  return (
    <>
      <Title>About Loci - The Taste-Aware Travel OS | AI-Powered City Discovery</Title>
      <Meta
        name="description"
        content="Learn about Loci, the intelligent travel companion that delivers hyper-personalized city exploration. Powered by Google Gemini AI, PostGIS, and advanced semantic search technology."
      />
      <Meta
        name="keywords"
        content="about Loci, travel technology, AI travel companion, Google Gemini, PostGIS, semantic search, personalized travel, city discovery, travel innovation"
      />
      <Meta property="og:title" content="About Loci - The Taste-Aware Travel OS" />
      <Meta
        property="og:description"
        content="Discover how Loci uses AI, geospatial intelligence, and semantic search to deliver hyper-personalized city exploration experiences."
      />
      <Meta property="og:url" content="https://lociai.fyi/about" />
      <Meta name="twitter:title" content="About Loci - AI-Powered City Discovery" />
      <Meta
        name="twitter:description"
        content="The intelligent travel companion powered by Google Gemini AI and advanced geospatial technology."
      />
      <link rel="canonical" href="https://lociai.fyi/about" />

      {/* Structured Data - AboutPage */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "About Loci",
          description:
            "Learn about Loci, the intelligent travel companion that delivers hyper-personalized city exploration",
          mainEntity: {
            "@type": "Organization",
            name: "Loci",
            url: "https://lociai.fyi",
            description:
              "AI-powered travel discovery platform delivering hyper-personalized city exploration recommendations based on user interests, time, location, and an evolving AI engine",
            foundingDate: "2024",
            slogan: "The taste-aware travel OS",
            knowsAbout: [
              "Travel Technology",
              "Artificial Intelligence",
              "Personalized Recommendations",
              "City Discovery",
              "Geospatial Intelligence",
            ],
          },
        })}
      </script>

      <div class="min-h-screen bg-background text-foreground">
        <div class="mx-auto max-w-3xl px-4 py-14 sm:py-20">
          {/* Hero */}
          <header class="mb-16">
            <p class="kicker mb-4">About Loci</p>
            <h1 class="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-foreground text-balance sm:text-5xl md:text-6xl">
              The plan that knows what changed today.
            </h1>
            <p class="mt-6 max-w-[62ch] text-lg leading-relaxed text-muted-foreground">
              Loci is a travel companion that learns what you like, where you are and how much time
              you have, and turns that into a city plan you can trust on the day. Itineraries,
              restaurants and hotels, aligned to you.
            </p>
          </header>

          {/* Pillars */}
          <section class="mb-16" aria-labelledby="pillars-heading">
            <h2 id="pillars-heading" class="sr-only">
              What makes Loci different
            </h2>
            <dl class="divide-y divide-border border-y border-border">
              <For each={PILLARS}>
                {(item) => (
                  <div class="grid gap-2 py-6 sm:grid-cols-[14rem_1fr] sm:gap-8">
                    <dt class="font-display text-xl font-semibold text-foreground">{item.title}</dt>
                    <dd class="max-w-[60ch] leading-relaxed text-muted-foreground">{item.body}</dd>
                  </div>
                )}
              </For>
            </dl>
          </section>

          {/* What is Loci */}
          <section class="mb-16" aria-labelledby="what-is-loci">
            <h2 id="what-is-loci" class="font-display text-3xl font-semibold text-foreground">
              What is Loci?
            </h2>
            <div class="mt-5 max-w-[65ch] space-y-5 text-lg leading-relaxed text-foreground">
              <p>
                Loci is a mobile-first web app that gives hyper-personalised city recommendations
                based on your interests, your time, your location and an engine that keeps learning.
                Ask it in plain words and the answer streams back as a plan.
              </p>
              <p>
                Tired of generic city guides? Loci learns your preferences, history, food, art and
                more, and combines them with the hours you actually have to suggest the spots that
                fit.
              </p>
            </div>
          </section>

          {/* Mission */}
          <section class="mb-16" aria-labelledby="our-mission">
            <h2 id="our-mission" class="font-display text-3xl font-semibold text-foreground">
              Our mission
            </h2>
            <div class="mt-5 max-w-[65ch] space-y-5 text-lg leading-relaxed text-foreground">
              <p>
                Whether you are a visitor on a tight schedule or a local looking for something new,
                you should be able to see your city as if a well-read friend were showing you
                around.
              </p>
              <p>
                Every city has places waiting to be found. Loci exists to match them to what you
                care about and the time you have.
              </p>
            </div>
          </section>

          {/* Technology */}
          <section class="mb-16" aria-labelledby="technology">
            <h2 id="technology" class="font-display text-3xl font-semibold text-foreground">
              How it works
            </h2>
            <div class="mt-6 grid gap-x-10 gap-y-8 sm:grid-cols-2">
              <For each={STACK}>
                {(item) => (
                  <div>
                    <h3 class="text-lg font-semibold text-foreground">{item.title}</h3>
                    <p class="mt-2 leading-relaxed text-muted-foreground">{item.body}</p>
                  </div>
                )}
              </For>
            </div>
          </section>

          {/* Roadmap. A real sequence, so the markers carry information. */}
          <section class="mb-16" aria-labelledby="roadmap">
            <h2 id="roadmap" class="font-display text-3xl font-semibold text-foreground">
              What is coming next
            </h2>
            <ol class="mt-6 divide-y divide-border border-y border-border">
              <For each={ROADMAP}>
                {(item) => (
                  <li class="grid gap-2 py-6 sm:grid-cols-[6rem_1fr] sm:gap-8">
                    <span class="font-coord text-xs uppercase tracking-[0.12em] text-primary">
                      {item.phase}
                    </span>
                    <div>
                      <h3 class="text-xl font-semibold text-foreground">{item.title}</h3>
                      <p class="mt-2 max-w-[60ch] leading-relaxed text-muted-foreground">
                        {item.body}
                      </p>
                    </div>
                  </li>
                )}
              </For>
            </ol>
          </section>

          {/* Call to action */}
          <section class="loci-card p-8 text-center sm:p-10" aria-labelledby="cta-heading">
            <h2
              id="cta-heading"
              class="font-display text-2xl font-semibold text-card-foreground sm:text-3xl"
            >
              Ready to see your city differently?
            </h2>
            <p class="mx-auto mt-3 max-w-[48ch] text-muted-foreground">
              Tell Loci what you like and how long you have. The first plan takes a minute.
            </p>
            <A href="/auth/signup" class="mt-6 inline-block">
              <Button size="lg">Start exploring</Button>
            </A>
          </section>
        </div>
      </div>
    </>
  );
}
