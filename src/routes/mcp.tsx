import { For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import { Plug, KeyRound, Terminal, Sparkles, ArrowRight } from "lucide-solid";
import { useAuth } from "~/contexts/AuthContext";
import { MCP_ENDPOINT } from "~/lib/mcp-endpoint";

export default function McpPage() {
  const { isAuthenticated } = useAuth();

  const steps = [
    {
      icon: KeyRound,
      title: "Create an API key",
      body: "Open Settings → API Keys and create a key. Copy it right away — it's shown only once.",
    },
    {
      icon: Plug,
      title: "Add the remote server",
      body: "Point your AI client at Loci's MCP endpoint with your key as a Bearer token. No install needed.",
    },
    {
      icon: Sparkles,
      title: "Ask your agent about places",
      body: "Search POIs, find nearby restaurants, manage lists and favorites, and (on Pro) generate full itineraries — all from your agent.",
    },
  ];

  const tools = [
    ["search_pois", "Keyword + semantic search over Loci's places"],
    ["find_nearby", "Restaurants, hotels, activities, or attractions near a point"],
    ["get_poi_details", "Full details for one place"],
    ["list_itineraries / get_itinerary / update_itinerary", "Read and edit your saved itineraries"],
    ["list_user_lists / get_list / add_poi_to_list", "Work with your saved lists"],
    ["list_favorites / add_favorite", "Read and add favorites"],
    ["plan_itinerary", "Generate and save a full itinerary (Pro)"],
  ];

  return (
    <>
      <Title>Connect Claude to Loci over MCP | Loci</Title>
      <Meta
        name="description"
        content="Connect Claude, Codex, Gemini, and other AI agents to Loci with the Model Context Protocol. Search places, plan itineraries, and manage lists from your favorite AI client."
      />
      <Meta property="og:title" content="Connect your AI agent to Loci over MCP" />
      <Meta
        property="og:description"
        content="Use Loci's travel data and itinerary planning directly inside Claude, Codex, Gemini, and other MCP clients."
      />
      <Meta property="og:url" content="https://lociai.fyi/mcp" />
      <link rel="canonical" href="https://lociai.fyi/mcp" />

      <div class="min-h-screen bg-background text-foreground transition-colors">
        <div class="max-w-5xl mx-auto px-4 py-12 space-y-12">
          {/* Hero */}
          <header class="text-center">
            <div class="rounded-3xl bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 border border-border shadow-lg p-10">
              <p class="text-sm uppercase tracking-[0.2em] text-accent mb-3 flex items-center justify-center gap-2">
                <Plug class="w-4 h-4" /> Model Context Protocol
              </p>
              <h1 class="text-4xl md:text-6xl font-bold text-foreground mb-4">
                Bring Loci into your AI agent.
              </h1>
              <p class="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                Connect Claude, Codex, Gemini, Grok, and any MCP-capable client to Loci. Your agent
                searches real places, manages your lists, and plans itineraries on your account.
              </p>
              <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
                <A
                  href={isAuthenticated() ? "/settings" : "/auth/signup"}
                  class="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-primary-foreground font-medium hover:opacity-90 transition"
                >
                  {isAuthenticated() ? "Create an API key" : "Get started"}
                  <ArrowRight class="w-4 h-4" />
                </A>
                <A
                  href="/pricing"
                  class="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 font-medium hover:bg-muted/50 transition"
                >
                  See Pro plans
                </A>
              </div>
            </div>
          </header>

          {/* Steps */}
          <section aria-labelledby="steps">
            <h2 id="steps" class="text-2xl font-bold text-foreground mb-6">
              Three steps to connect
            </h2>
            <div class="grid gap-4 md:grid-cols-3">
              <For each={steps}>
                {(step, i) => (
                  <div class="rounded-2xl border border-border bg-card p-6">
                    <div class="flex items-center gap-2 text-primary">
                      <step.icon class="w-5 h-5" />
                      <span class="text-sm font-semibold">Step {i() + 1}</span>
                    </div>
                    <h3 class="mt-3 font-semibold text-foreground">{step.title}</h3>
                    <p class="mt-1 text-sm text-muted-foreground">{step.body}</p>
                  </div>
                )}
              </For>
            </div>
          </section>

          {/* Connection details */}
          <section aria-labelledby="config" class="space-y-4">
            <h2 id="config" class="text-2xl font-bold text-foreground flex items-center gap-2">
              <Terminal class="w-6 h-6" /> Connection details
            </h2>

            <div class="rounded-2xl border border-border bg-card p-6 space-y-4">
              <div>
                <p class="text-sm font-medium text-foreground">Remote (recommended)</p>
                <p class="text-sm text-muted-foreground mt-1">
                  Streamable HTTP — works in Claude and any client that supports remote MCP servers.
                </p>
                <pre class="mt-2 overflow-x-auto rounded-lg bg-muted/50 p-3 text-xs sm:text-sm">
                  <code>{`Endpoint:  ${MCP_ENDPOINT}
Header:    Authorization: Bearer <your-api-key>`}</code>
                </pre>
                <p class="text-sm text-muted-foreground mt-2">
                  In Claude Code:{" "}
                  <code class="text-foreground break-all">
                    claude mcp add --transport http loci {MCP_ENDPOINT} --header "Authorization:
                    Bearer &lt;your-api-key&gt;"
                  </code>
                </p>
              </div>

              <div class="border-t border-border pt-4">
                <p class="text-sm font-medium text-foreground">Local (stdio)</p>
                <p class="text-sm text-muted-foreground mt-1">
                  Prefer a local binary? Run the <code class="text-foreground">loci-mcp</code>{" "}
                  proxy; it forwards to the same endpoint.
                </p>
                <pre class="mt-2 overflow-x-auto rounded-lg bg-muted/50 p-3 text-xs sm:text-sm">
                  <code>{`LOCI_API_KEY=<your-api-key> loci-mcp`}</code>
                </pre>
              </div>
            </div>
          </section>

          {/* Tools */}
          <section aria-labelledby="tools" class="space-y-4">
            <h2 id="tools" class="text-2xl font-bold text-foreground">
              What your agent can do
            </h2>
            <div class="divide-y divide-border rounded-2xl border border-border">
              <For each={tools}>
                {([name, desc]) => (
                  <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 p-4">
                    <code class="text-sm text-primary font-mono sm:w-96 shrink-0">{name}</code>
                    <span class="text-sm text-muted-foreground">{desc}</span>
                  </div>
                )}
              </For>
            </div>
            <p class="text-sm text-muted-foreground">
              Data tools are available on every plan (with a daily limit).{" "}
              <A href="/pricing" class="text-primary underline underline-offset-2">
                Loci Pro
              </A>{" "}
              unlocks <code class="text-foreground">plan_itinerary</code> and higher limits.
            </p>
          </section>

          {/* Footer CTA */}
          <Show when={!isAuthenticated()}>
            <section class="rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-accent/10 p-8 text-center">
              <h2 class="text-2xl font-bold text-foreground">Ready to connect?</h2>
              <p class="text-muted-foreground mt-2">
                Create a free account, mint an API key, and plug Loci into your agent.
              </p>
              <A
                href="/auth/signup"
                class="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-primary-foreground font-medium hover:opacity-90 transition"
              >
                Get started free
                <ArrowRight class="w-4 h-4" />
              </A>
            </section>
          </Show>
        </div>
      </div>
    </>
  );
}
