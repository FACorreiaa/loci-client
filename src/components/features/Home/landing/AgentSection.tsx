import { For } from "solid-js";
import { A } from "@solidjs/router";
import { ArrowRight } from "lucide-solid";
import RouteStop from "./RouteStop";
import { MCP_ENDPOINT } from "~/lib/mcp-endpoint";

const clients = ["Claude", "Codex", "Gemini", "Grok", "+ any MCP client"];

export default function AgentSection() {
  return (
    <RouteStop id="agent" class="pt-24">
      <div class="flex items-baseline gap-3.5">
        <span class="font-coord text-xs uppercase tracking-[0.18em] text-accent">stop 03</span>
        <span class="font-coord text-xs text-muted-foreground">bring your own AI</span>
      </div>
      <h2 class="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
        Already live in Claude? Loci comes with you.
      </h2>
      <p class="mt-3 max-w-[58ch] text-muted-foreground">
        Loci speaks the Model Context Protocol. Connect it to Claude, Codex, Gemini, or Grok and let
        your own agent search places and build itineraries — on your account.
      </p>

      <div class="mt-7 grid items-center gap-7 rounded-3xl border border-border bg-card p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <pre class="font-coord overflow-x-auto rounded-xl border border-border bg-background p-4 text-[0.82rem] leading-relaxed text-muted-foreground">
            <code>
              <span class="text-accent">claude mcp add</span>
              {` --transport http loci \\\n  ${MCP_ENDPOINT} \\\n  --header "Authorization: Bearer `}
              <span class="text-accent">loci_sk_…</span>
              {`"`}
            </code>
          </pre>
          <div class="mt-4 flex flex-wrap gap-2.5">
            <For each={clients}>
              {(c) => (
                <span class="font-coord rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground">
                  {c}
                </span>
              )}
            </For>
          </div>
        </div>
        <div>
          <p class="text-muted-foreground">
            Ten tools, from <span class="font-coord text-foreground">search_pois</span> to{" "}
            <span class="font-coord text-foreground">plan_itinerary</span>. Free tools on every
            plan; itinerary generation on Pro.
          </p>
          <A
            href="/mcp"
            class="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 font-medium transition hover:bg-muted/50"
          >
            Read the connection guide
            <ArrowRight class="h-4 w-4" />
          </A>
        </div>
      </div>
    </RouteStop>
  );
}
