import { For } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { CheckCircle2, Rocket, Zap, Globe, Share2, Download, Mic, Calendar } from "lucide-solid";
import { A } from "@solidjs/router";
import { Button } from "~/ui/button";

interface Phase {
  number: number;
  title: string;
  status: "completed" | "in-progress" | "planned";
  description: string;
  features: string[];
}

export default function Roadmap() {
  const phases: Phase[] = [
    {
      number: 1,
      title: "MVP Foundation",
      status: "completed",
      description: "The core engine powering personal travel discovery.",
      features: [
        "Gemini-powered recommendation engine",
        "Interactive map & routing",
        "User accounts & basic bookmarks",
        "Itinerary personalization",
      ],
    },
    {
      number: 2,
      title: "Enhanced Intelligence",
      status: "in-progress",
      description: "Deepening the AI capabilities and premium features.",
      features: [
        "Vector database (pgvector) context",
        "Speech-to-text hands-free planning",
        "PDF/Markdown itinerary downloads",
        "Premium subscription tier",
      ],
    },
    {
      number: 3,
      title: "Global Scale",
      status: "planned",
      description: "Mobile apps and community-driven exploration.",
      features: [
        "Native iOS & Android Apps",
        "Collaborative trip planning",
        "Offline maps & guides",
        "Community curated lists",
      ],
    },
  ];

  return (
    <>
      <Title>Product Roadmap - Loci</Title>
      <Meta name="description" content="Explore Loci's product roadmap and vision." />

      <div class="min-h-screen bg-background text-foreground selection:bg-primary/30 font-sans transition-colors duration-300">
        <section class="relative bg-gradient-to-r from-primary via-primary/90 to-accent overflow-hidden pb-32 lg:pb-48">
          <div
            class="absolute bottom-0 left-0 right-0 h-24 bg-background transition-colors duration-300"
            style={{ "clip-path": "polygon(0 100%, 100% 0, 100% 100%)" }}
          />

          <div class="container mx-auto px-4 pt-24 sm:pt-32 relative z-10">
            <div class="max-w-4xl">
              <h1 class="text-5xl sm:text-6xl md:text-7xl font-bold mb-6 tracking-tight text-primary-foreground">
                Roadmap
              </h1>
              <p class="text-xl sm:text-2xl text-primary-foreground/80 max-w-2xl font-light leading-relaxed">
                We love travel and mad science. Here is what powers Loci and where we are heading
                next.
              </p>
            </div>

            <div class="hidden lg:block absolute right-10 top-20 opacity-90 animate-in fade-in slide-in-from-right-10 duration-1000">
              <div class="relative w-96 h-96">
                <div class="absolute inset-0 bg-primary-foreground/10 blur-3xl rounded-full" />
                <Rocket class="w-full h-full text-primary-foreground/70 drop-shadow-[0_0_30px_hsl(var(--primary-foreground)/0.35)] rotate-12" />
              </div>
            </div>
          </div>
        </section>

        <section class="container mx-auto px-4 py-12 -mt-10 relative z-20">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-16">
            <div class="group">
              <div class="flex items-start gap-6">
                <div class="shrink-0">
                  <CheckCircle2 class="w-16 h-16 text-primary hover:scale-110 transition-transform" />
                </div>
                <div>
                  <h2 class="text-3xl font-bold mb-3 text-foreground">{phases[0].title}</h2>
                  <p class="text-muted-foreground leading-relaxed mb-4 text-lg">
                    {phases[0].description}
                  </p>
                  <ul class="space-y-2">
                    <For each={phases[0].features}>
                      {(feat) => (
                        <li class="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                          <span class="w-1.5 h-1.5 rounded-full bg-primary" />
                          {feat}
                        </li>
                      )}
                    </For>
                  </ul>
                </div>
              </div>
            </div>

            <div class="group">
              <div class="flex items-start gap-6">
                <div class="shrink-0">
                  <Zap class="w-16 h-16 text-accent hover:scale-110 transition-transform" />
                </div>
                <div>
                  <h2 class="text-3xl font-bold mb-3 text-foreground">{phases[1].title}</h2>
                  <p class="text-muted-foreground leading-relaxed mb-4 text-lg">
                    {phases[1].description}
                  </p>
                  <ul class="space-y-2">
                    <For each={phases[1].features}>
                      {(feat) => (
                        <li class="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                          <span class="w-1.5 h-1.5 rounded-full bg-accent" />
                          {feat}
                        </li>
                      )}
                    </For>
                  </ul>
                </div>
              </div>
            </div>

            <div class="group lg:col-span-2 lg:w-2/3">
              <div class="flex items-start gap-6">
                <div class="shrink-0">
                  <Globe class="w-16 h-16 text-primary hover:scale-110 transition-transform" />
                </div>
                <div>
                  <h2 class="text-3xl font-bold mb-3 text-foreground">{phases[2].title}</h2>
                  <p class="text-muted-foreground leading-relaxed mb-4 text-lg">
                    {phases[2].description}
                  </p>
                  <ul class="space-y-2">
                    <For each={phases[2].features}>
                      {(feat) => (
                        <li class="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                          <span class="w-1.5 h-1.5 rounded-full bg-primary" />
                          {feat}
                        </li>
                      )}
                    </For>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="container mx-auto px-4 py-24">
          <div class="mb-12">
            <h3 class="text-2xl font-bold text-foreground mb-2">Upcoming Highlights</h3>
            <div class="h-1 w-20 bg-primary rounded-full" />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div class="flex gap-4 p-4 rounded-xl hover:bg-muted transition-colors">
              <div class="mt-1">
                <Mic class="w-8 h-8 text-accent" />
              </div>
              <div>
                <h4 class="text-xl font-bold text-foreground mb-2">Voice Interaction</h4>
                <p class="text-muted-foreground">
                  Speak to Loci naturally to refine plans while on the go. Perfect for when you need
                  quick answers without typing.
                </p>
              </div>
            </div>

            <div class="flex gap-4 p-4 rounded-xl hover:bg-muted transition-colors">
              <div class="mt-1">
                <Share2 class="w-8 h-8 text-primary" />
              </div>
              <div>
                <h4 class="text-xl font-bold text-foreground mb-2">Social Itineraries</h4>
                <p class="text-muted-foreground">
                  Share your perfect trip with friends or publish it to the Loci community to help
                  others discover hidden gems.
                </p>
              </div>
            </div>

            <div class="flex gap-4 p-4 rounded-xl hover:bg-muted transition-colors">
              <div class="mt-1">
                <Download class="w-8 h-8 text-primary" />
              </div>
              <div>
                <h4 class="text-xl font-bold text-foreground mb-2">Offline Mode</h4>
                <p class="text-muted-foreground">
                  Download your city guides and maps for use without data roaming. Essential for
                  international travel.
                </p>
              </div>
            </div>

            <div class="flex gap-4 p-4 rounded-xl hover:bg-muted transition-colors">
              <div class="mt-1">
                <Calendar class="w-8 h-8 text-accent" />
              </div>
              <div>
                <h4 class="text-xl font-bold text-foreground mb-2">Smart Scheduling</h4>
                <p class="text-muted-foreground">
                  AI that understands opening hours and travel time to build realistically playable
                  itineraries.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section class="relative bg-primary mt-20 pt-24 pb-24 overflow-hidden">
          <div
            class="absolute top-0 left-0 right-0 h-16 bg-background transition-colors duration-300"
            style={{ "clip-path": "polygon(0 0, 100% 0, 0 100%)" }}
          />

          <div class="container mx-auto px-4 relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
            <div class="text-primary-foreground max-w-lg">
              <h2 class="text-3xl md:text-4xl font-bold mb-4">Join the party now</h2>
              <p class="text-primary-foreground/80 text-lg">
                Start planning your next adventure with the most advanced AI travel companion.
              </p>
            </div>

            <div class="flex flex-col gap-4">
              <A href="/auth/signup">
                <Button class="bg-background text-primary hover:bg-background/90 font-bold px-8 py-4 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all text-lg w-full md:w-auto h-auto">
                  Get Loci for Free
                </Button>
              </A>
              <div class="flex items-center gap-4 opacity-75 grayscale hover:grayscale-0 transition-all cursor-not-allowed">
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
                  class="h-12"
                  alt="Play Store"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
