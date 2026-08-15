import { createSignal, For, Show } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { Brain, ChevronLeft, ChevronDown, Trash2, Download, Info } from "lucide-solid";
import {
  useMemory,
  useForgetTrait,
  useForgetEvidence,
  describeEvent,
  type TraitView,
} from "../../lib/api/memory";
import { exportUserData } from "../../lib/api/user";

/**
 * "What Loci remembers about you."
 *
 * Every belief is shown with the actions that produced it, and each can be
 * removed on its own. Deleting evidence rebuilds the rest of the profile from
 * what survives, so removing one thing never leaves the others asserting
 * something the record no longer supports.
 */
export default function MemorySettings() {
  const memory = useMemory(true);
  const forgetTrait = useForgetTrait();
  const forgetEvidence = useForgetEvidence();

  const [expanded, setExpanded] = createSignal<string | null>(null);
  const [confirming, setConfirming] = createSignal<string | null>(null);
  const [exporting, setExporting] = createSignal(false);
  const [exportError, setExportError] = createSignal<string | null>(null);

  // Export is an RPC that returns the bytes, not a URL — the download is
  // assembled client-side by exportUserData.
  const handleExport = async () => {
    setExportError(null);
    setExporting(true);
    try {
      await exportUserData();
    } catch {
      setExportError("Could not build your export just now. Try again in a moment.");
    } finally {
      setExporting(false);
    }
  };

  const toggle = (key: string) => setExpanded((current) => (current === key ? null : key));

  return (
    <>
      <Title>What Loci remembers about you | Loci</Title>
      <Meta
        name="description"
        content="Inspect everything Loci has learned about your travel taste, see the evidence behind each conclusion, and delete any of it."
      />

      <main class="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <A
          href="/settings"
          class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ChevronLeft class="w-4 h-4" />
          Settings
        </A>

        <header class="mb-8">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Brain class="w-5 h-5 text-primary" />
            </div>
            <h1 class="text-2xl sm:text-3xl font-bold text-foreground">
              What Loci remembers about you
            </h1>
          </div>
          <p class="text-muted-foreground text-sm sm:text-base">
            Everything below was learned from things you did in the app. Each belief shows the
            actions behind it, and you can delete any of them.
          </p>
        </header>

        <Show when={memory.data} fallback={<LoadingState error={memory.error} />}>
          {(data) => (
            <>
              <section class="loci-card rounded-3xl p-5 sm:p-6 mb-6">
                <dl class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <Stat label="Things learned" value={String(data().traits.length)} />
                  <Stat label="Actions recorded" value={String(data().signalCount)} />
                  <Stat
                    label="Personalisation"
                    value={data().personalizationEnabled ? "On" : "Off"}
                  />
                  <Stat label="Last activity" value={formatDate(data().lastSignalAt)} />
                </dl>

                <Show when={!data().personalizationEnabled}>
                  <p class="mt-4 flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-xl p-3">
                    <Info class="w-4 h-4 mt-0.5 shrink-0" />
                    <span>
                      Personalisation is off, so none of this is used to rank what you see. It is
                      kept here so you can still read and delete it.
                    </span>
                  </p>
                </Show>
              </section>

              <Show
                when={data().traits.length > 0}
                fallback={
                  <p class="loci-card rounded-3xl p-8 text-center text-muted-foreground">
                    Loci has not learned anything about you yet. Save a few places and it will start
                    noticing patterns.
                  </p>
                }
              >
                <ul class="space-y-3">
                  <For each={data().traits}>
                    {(trait) => (
                      <TraitRow
                        trait={trait}
                        expanded={expanded() === trait.key}
                        confirming={confirming() === trait.key}
                        busy={forgetTrait.isPending || forgetEvidence.isPending}
                        onToggle={() => toggle(trait.key)}
                        onAskForget={() => setConfirming(trait.key)}
                        onCancelForget={() => setConfirming(null)}
                        onForget={async () => {
                          await forgetTrait.mutateAsync(trait.key);
                          setConfirming(null);
                        }}
                        onForgetEvidence={(feedbackId) => forgetEvidence.mutateAsync(feedbackId)}
                      />
                    )}
                  </For>
                </ul>
              </Show>

              <section class="mt-8 loci-card rounded-3xl p-5 sm:p-6">
                <h2 class="font-semibold text-foreground mb-1">Take it with you</h2>
                <p class="text-sm text-muted-foreground mb-4">
                  Download everything Loci holds about you — trips, lists, favourites, places you
                  have been, and the record above — as a single JSON file.
                </p>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exporting()}
                  class="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors text-sm font-medium disabled:opacity-60"
                >
                  <Download class="w-4 h-4" />
                  {exporting() ? "Preparing…" : "Export my data"}
                </button>
                <Show when={exportError()}>
                  <p class="mt-2 text-sm text-destructive">{exportError()}</p>
                </Show>
              </section>
            </>
          )}
        </Show>
      </main>
    </>
  );
}

function Stat(props: { label: string; value: string }) {
  return (
    <div>
      <dt class="text-xs uppercase tracking-wide text-muted-foreground mb-1">{props.label}</dt>
      <dd class="text-lg font-semibold text-foreground">{props.value}</dd>
    </div>
  );
}

function LoadingState(props: { error?: unknown }) {
  return (
    <Show
      when={!props.error}
      fallback={
        <p class="loci-card rounded-3xl p-8 text-center text-muted-foreground">
          Could not load your profile just now. Try again in a moment.
        </p>
      }
    >
      <div class="loci-card rounded-3xl p-8 flex justify-center">
        <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </Show>
  );
}

function TraitRow(props: {
  trait: TraitView;
  expanded: boolean;
  confirming: boolean;
  busy: boolean;
  onToggle: () => void;
  onAskForget: () => void;
  onCancelForget: () => void;
  onForget: () => void;
  onForgetEvidence: (feedbackId: string) => void;
}) {
  // A negative score is an aversion, not a weak preference — saying "likes" for
  // both would misreport what was learned.
  const verb = () => (props.trait.score < 0 ? "Tends to avoid" : "Tends to like");

  return (
    <li class="loci-card rounded-2xl overflow-hidden">
      <div class="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={props.onToggle}
          class="flex-1 flex items-center gap-3 text-left min-w-0"
          aria-expanded={props.expanded}
        >
          <ChevronDown
            class={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${
              props.expanded ? "rotate-180" : ""
            }`}
          />
          <span class="min-w-0">
            <span class="block font-medium text-foreground truncate">
              {verb()} {props.trait.label.toLowerCase()}
            </span>
            <span class="block text-xs text-muted-foreground">
              from {props.trait.evidenceCount}{" "}
              {props.trait.evidenceCount === 1 ? "action" : "actions"} ·{" "}
              {confidenceLabel(props.trait.confidence)}
            </span>
          </span>
        </button>

        <Show
          when={!props.confirming}
          fallback={
            <span class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={props.onForget}
                disabled={props.busy}
                class="text-xs font-medium px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-60"
              >
                Forget it
              </button>
              <button
                type="button"
                onClick={props.onCancelForget}
                class="text-xs px-2 py-1.5 rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
            </span>
          }
        >
          <button
            type="button"
            onClick={props.onAskForget}
            aria-label={`Forget that you ${verb().toLowerCase()} ${props.trait.label}`}
            class="shrink-0 p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </Show>
      </div>

      <Show when={props.expanded}>
        <div class="border-t border-border px-4 py-3 bg-muted/30">
          <p class="text-xs text-muted-foreground mb-2">Because you:</p>
          <ul class="space-y-1.5">
            <For
              each={props.trait.evidence}
              fallback={
                <li class="text-sm text-muted-foreground">
                  The actions behind this one are no longer on record.
                </li>
              }
            >
              {(item) => (
                <li class="flex items-center gap-2 text-sm">
                  <span class="flex-1 min-w-0 truncate text-foreground">
                    {describeEvent(item.event)}{" "}
                    <span class="font-medium">{item.poiName || "a place"}</span>
                    <Show when={item.cityName}>
                      <span class="text-muted-foreground"> in {item.cityName}</span>
                    </Show>
                    <Show when={item.occurredAt}>
                      <span class="text-muted-foreground"> · {formatDate(item.occurredAt)}</span>
                    </Show>
                  </span>
                  <button
                    type="button"
                    onClick={() => props.onForgetEvidence(item.feedbackId)}
                    disabled={props.busy}
                    aria-label="Forget this action"
                    class="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive disabled:opacity-60"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>
    </li>
  );
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.7) return "fairly sure";
  if (confidence >= 0.4) return "moderately sure";
  return "still guessing";
}

function formatDate(millis?: number): string {
  if (!millis) return "—";
  return new Date(millis).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
