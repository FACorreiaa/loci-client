import { createSignal, onCleanup, onMount, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { ArrowRight, Loader2 } from "lucide-solid";
import { useUserLocation } from "~/contexts/LocationContext";
import { prefersReducedMotion } from "~/lib/hooks/useInView";
import { detectDomain } from "~/lib/api/llm";
import { startErrorMessage } from "~/lib/errors";
import { createStreamingSession, getDomainRoute, streamingService } from "~/lib/chat-stream";
import HeroCardWall from "./landing/HeroCardWall";
import SvgGlobe from "./landing/SvgGlobe";
import HowItWorks from "./landing/HowItWorks";
import WhatItFinds from "./landing/WhatItFinds";
import AgentSection from "./landing/AgentSection";
import FinalCta from "./landing/FinalCta";
import AppButtons from "./landing/AppButtons";
import MascotScene from "~/components/brand/MascotScene";
import "~/styles/landing.css";

const examplePrompts = [
  "2 days · Porto · wine",
  "Kyoto · temples + coffee",
  "Braga · slow morning",
];

export default function PublicLandingPage() {
  const navigate = useNavigate();
  const { userLocation } = useUserLocation();
  const [message, setMessage] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);
  const [searchError, setSearchError] = createSignal("");

  let railRef: HTMLDivElement | undefined;
  let fillRef: HTMLDivElement | undefined;

  onMount(() => {
    const reduce = prefersReducedMotion();
    const stops = Array.from(document.querySelectorAll<HTMLElement>(".route-stop"));

    const onScroll = () => {
      if (!railRef || !fillRef) return;
      const box = railRef.getBoundingClientRect();
      if (!reduce) {
        const progress = Math.min(
          1,
          Math.max(0, (window.innerHeight * 0.55 - box.top) / box.height),
        );
        fillRef.style.height = `${progress * box.height}px`;
      }
      for (const s of stops) {
        if (s.getBoundingClientRect().top < window.innerHeight * 0.62) s.classList.add("is-lit");
      }
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onCleanup(() => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    });
  });

  const runSearch = async () => {
    const query = message().trim();
    if (!query) {
      setSearchError("Tell Loci where you're headed first.");
      return;
    }
    if (isLoading()) return;
    setSearchError("");
    setIsLoading(true);

    try {
      const domain = detectDomain(query);
      const session = createStreamingSession(domain);
      session.query = query;
      sessionStorage.setItem("currentStreamingSession", JSON.stringify(session));

      streamingService.startStream(
        {
          // Not a profile id. Empty lets the server fall back to the default
          // profile instead of silently failing to parse this.
          profileId: "",
          message: query,
          userLocation: userLocation()
            ? { userLat: userLocation()!.latitude, userLon: userLocation()!.longitude }
            : undefined,
        },
        {
          session,
          // Leave for the results page the moment the server names the
          // session. The stream keeps running on the service singleton; the
          // destination binds to it through the live store and fills in as
          // events land. Waiting for `complete` here meant a blank search bar
          // for the whole generation.
          onStart: (started) => {
            setIsLoading(false);
            navigate(getDomainRoute(started.domain, started.sessionId, started.city));
          },
          onProgress: (updated) =>
            sessionStorage.setItem("currentStreamingSession", JSON.stringify(updated)),
          onComplete: () => {
            // The service records the finished session; nothing left to do
            // here — this component has usually unmounted by now.
            setIsLoading(false);
          },
          onError: (error) => {
            console.error("Free streaming error:", error);
            setIsLoading(false);
            // The concurrent-search cap says what to do; say it verbatim.
            setSearchError(
              startErrorMessage(error, "That didn't go through. Try again in a moment."),
            );
          },
        },
      );
    } catch (error) {
      console.error("Error starting free chat:", error);
      setIsLoading(false);
      navigate("/auth/signin");
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runSearch();
    }
  };

  const prefill = (prompt: string) => {
    setMessage(prompt);
    runSearch();
  };

  return (
    <div class="relative min-h-screen bg-background text-foreground">
      <div class="contour-grid pointer-events-none absolute inset-0" aria-hidden="true" />

      {/* HERO — centred copy, store row, the web search funnel, and a wall of
          postcards fanned along the bottom. Full-bleed, so it sits above the
          route spine rather than on it. */}
      <section aria-labelledby="landing-hero-heading" class="landing-hero pt-14 sm:pt-20">
        <div class="hero-glow" aria-hidden="true" />
        <div class="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-4 text-center sm:px-6">
          <a href="#how" class="hero-pill">
            <span class="hero-pill-dot" aria-hidden="true" />
            Loci · cities, with friends
            <span class="hero-pill-arrow" aria-hidden="true">
              →
            </span>
          </a>
          <h1
            id="landing-hero-heading"
            class="mt-6 text-[2.25rem] font-bold leading-[1.05] tracking-[-0.025em] sm:text-5xl lg:text-[3.75rem]"
          >
            <span class="block text-balance">Explore a city</span>
            <span class="block text-balance text-muted-foreground">
              with your <span class="text-primary">friends</span>.
            </span>
          </h1>
          <p class="mt-5 max-w-[36rem] text-base text-balance text-muted-foreground sm:text-lg">
            Plan a trip in one sentence, walk it stop by stop, and collect the places you've really
            been. See who's explored most this week.
          </p>

          <AppButtons class="mt-8" />

          <div class="mt-9 w-full max-w-xl">
            <div
              class="flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5 pl-4 text-left shadow-sm focus-within:border-accent"
              classList={{ "opacity-70": isLoading() }}
            >
              <input
                type="text"
                value={message()}
                onInput={(e) => setMessage(e.currentTarget.value)}
                onKeyDown={onKeyDown}
                disabled={isLoading()}
                placeholder="Where to? Try 'three chill days in Lisbon for food and views'"
                aria-label="Describe your trip"
                class="min-w-0 flex-1 bg-transparent text-[0.98rem] outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={runSearch}
                disabled={isLoading()}
                aria-label="Plot this trip"
                class="grid h-10 w-10 flex-none place-items-center rounded-xl bg-accent text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                <Show
                  when={!isLoading()}
                  fallback={<Loader2 class="h-[18px] w-[18px] animate-spin" />}
                >
                  <ArrowRight class="h-[18px] w-[18px]" />
                </Show>
              </button>
            </div>
            <Show when={searchError()}>
              <p class="mt-2 text-sm text-destructive">{searchError()}</p>
            </Show>

            <div class="mt-3.5 flex flex-wrap justify-center gap-2">
              <For each={examplePrompts}>
                {(p, i) => (
                  <button
                    type="button"
                    onClick={() => prefill(p)}
                    disabled={isLoading()}
                    // Two fit on one phone row; a third would wrap onto its own.
                    class="font-coord rounded-full border border-border bg-background/70 px-2.5 py-1.5 text-[0.7rem] text-muted-foreground sm:px-3 sm:text-xs transition hover:border-accent hover:text-foreground"
                    classList={{ "hidden sm:inline-block": i() >= 2 }}
                  >
                    {p}
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>

        <HeroCardWall />
      </section>

      <main class="relative mx-auto max-w-[1160px] px-6">
        <div class="grid grid-cols-[44px_1fr] sm:grid-cols-[96px_1fr]">
          {/* route spine */}
          <div class="route-rail" ref={railRef} aria-hidden="true">
            <div class="route-fill" ref={fillRef} />
          </div>

          <div class="min-w-0">
            <HowItWorks />
            <WhatItFinds />

            {/* The mascot, below the fold on purpose.
                The hero's headline is the LCP element and the card wall is
                plain HTML/CSS, and putting a
                WebGL canvas there would put a dependency on the critical path
                of the one route audited at performance >= 0.95. Here it costs
                nothing until someone scrolls to it, and it is the moment the
                page stops explaining and just says hello. */}
            <section
              aria-labelledby="landing-mascot-heading"
              class="route-stop mx-auto flex w-full max-w-4xl flex-col-reverse items-center gap-8 px-4 py-14 sm:flex-row sm:gap-12 sm:py-20"
            >
              <span class="route-stop-mark" aria-hidden="true" />
              <MascotScene class="h-56 w-44 flex-none sm:h-72 sm:w-56" />
              <div class="max-w-sm">
                <p class="font-coord text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground">
                  Your guide
                </p>
                <h2 id="landing-mascot-heading" class="mt-3 text-3xl leading-tight sm:text-4xl">
                  Someone who has already read the map.
                </h2>
                <p class="mt-4 text-sm leading-6 text-muted-foreground">
                  Loci reads the reviews, the opening hours, and the walk between one place and the
                  next, so the plan you get is one you can actually follow.
                </p>
              </div>
            </section>

            {/* Reach. Pure SVG, no WebGL and no Mapbox chunk — `/` is audited
                at performance >= 0.95 as a hard error, and the map bundle is
                ~1.9 MB raw. This is a second, wider statement further down
                the page. */}
            <section
              aria-labelledby="landing-globe-heading"
              class="mx-auto flex w-full max-w-5xl flex-col items-center gap-8 px-4 py-16 md:flex-row md:justify-between md:py-24"
            >
              <div class="max-w-sm">
                <p class="font-coord text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground">
                  Anywhere you're going
                </p>
                <h2 id="landing-globe-heading" class="mt-3 text-3xl leading-tight sm:text-4xl">
                  One city or six, across a weekend or a month.
                </h2>
                <p class="mt-4 text-sm leading-6 text-muted-foreground">
                  Loci plans routes between real places, works out the legs between them, and keeps
                  the whole thing editable.
                </p>
              </div>
              <SvgGlobe />
            </section>

            <AgentSection />
            <FinalCta />
          </div>
        </div>
      </main>
    </div>
  );
}
