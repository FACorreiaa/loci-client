import { createSignal, onCleanup, onMount, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { ArrowRight, Loader2 } from "lucide-solid";
import { useUserLocation } from "~/contexts/LocationContext";
import { prefersReducedMotion } from "~/lib/hooks/useInView";
import { detectDomain } from "~/lib/api/llm";
import { createStreamingSession, getDomainRoute, streamingService } from "~/lib/chat-stream";
import HeroPlot from "./landing/HeroPlot";
import SvgGlobe from "./landing/SvgGlobe";
import HowItWorks from "./landing/HowItWorks";
import WhatItFinds from "./landing/WhatItFinds";
import AgentSection from "./landing/AgentSection";
import FinalCta from "./landing/FinalCta";
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
          profileId: "free",
          message: query,
          userLocation: userLocation()
            ? { userLat: userLocation()!.latitude, userLon: userLocation()!.longitude }
            : undefined,
        },
        {
          session,
          onProgress: (updated) =>
            sessionStorage.setItem("currentStreamingSession", JSON.stringify(updated)),
          onComplete: (completed) => {
            setIsLoading(false);
            sessionStorage.setItem("completedStreamingSession", JSON.stringify(completed));
            const route = getDomainRoute(completed.domain, completed.sessionId, completed.city);
            if (route) {
              navigate(route, {
                state: {
                  streamingData: completed.data,
                  sessionId: completed.sessionId,
                  originalMessage: query,
                },
              });
            }
          },
          onError: (error) => {
            console.error("Free streaming error:", error);
            setIsLoading(false);
            setSearchError("That didn't go through. Try again in a moment.");
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

      <main class="relative mx-auto max-w-[1160px] px-6">
        <div class="grid grid-cols-[44px_1fr] sm:grid-cols-[96px_1fr]">
          {/* route spine */}
          <div class="route-rail" ref={railRef} aria-hidden="true">
            <div class="route-fill" ref={fillRef} />
          </div>

          <div class="min-w-0">
            {/* HERO */}
            <section class="route-stop is-lit relative pt-16 sm:pt-24">
              <span class="route-stop-mark" aria-hidden="true" />
              <div class="grid items-center gap-11 pb-4 lg:grid-cols-[1.05fr_0.95fr]">
                <div>
                  <span class="font-coord text-xs uppercase tracking-[0.18em] text-accent">
                    Loci · places, plotted
                  </span>
                  <h1 class="mt-4 text-[clamp(2.6rem,5.4vw,4.1rem)] font-bold leading-[1.02] tracking-tight text-balance">
                    Turn a vibe
                    <br />
                    into a <span class="text-accent">route</span>.
                  </h1>
                  <p class="mt-5 max-w-[30ch] text-lg text-muted-foreground">
                    Tell Loci a city and a mood. Get a real itinerary of real places — mapped,
                    ordered, and yours to reshape.
                  </p>

                  <div
                    class="mt-7 flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5 pl-4 focus-within:border-accent"
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

                  <div class="mt-3.5 flex flex-wrap gap-2">
                    <For each={examplePrompts}>
                      {(p) => (
                        <button
                          type="button"
                          onClick={() => prefill(p)}
                          disabled={isLoading()}
                          class="font-coord rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-accent hover:text-foreground"
                        >
                          {p}
                        </button>
                      )}
                    </For>
                  </div>
                </div>

                <HeroPlot />
              </div>
            </section>

            <HowItWorks />
            <WhatItFinds />

            {/* Reach. Pure SVG, no WebGL and no Mapbox chunk — `/` is audited
                at performance >= 0.95 as a hard error, and the map bundle is
                ~1.9 MB raw. HeroPlot above stays the signature graphic; this
                is a second, wider statement further down the page. */}
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
