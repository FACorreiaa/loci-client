import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { useAuth } from "~/contexts/AuthContext";
import { useInterests } from "~/lib/api/interests";
import {
  fetchPreferenceProfilesRPC,
  useCreateSearchProfileMutation,
  useSearchProfiles,
  useUpdateSearchProfileMutation,
} from "~/lib/api/profiles";
import {
  TRIP_SETUP_INTERESTS,
  markTripSetupSeen,
  safeNextPath,
  tripSetupSave,
} from "~/lib/trip-setup";

// A short, focused pre-trip questionnaire that writes a default search profile,
// so the very first chat/discover request is already personalised. Reuses the
// existing profile API — no new backend surface.

type Choice = { value: string; label: string; icon: string; hint?: string };

const BUDGETS: Choice[] = [
  { value: "1", label: "Shoestring", icon: "🎒", hint: "Free & cheap picks" },
  { value: "2", label: "Balanced", icon: "💶", hint: "Mix of value & treats" },
  { value: "3", label: "Comfortable", icon: "✨", hint: "Lean into quality" },
  { value: "4", label: "Luxury", icon: "👑", hint: "Best of everything" },
];

const PACES: Choice[] = [
  { value: "relaxed", label: "Relaxed", icon: "🌿", hint: "A few things, unhurried" },
  { value: "moderate", label: "Moderate", icon: "🚶", hint: "A comfortable rhythm" },
  { value: "packed", label: "Packed", icon: "⚡", hint: "See as much as possible" },
];

const MOBILITY: Choice[] = [
  { value: "walking", label: "On foot", icon: "🚶" },
  { value: "transit", label: "Public transit", icon: "🚇" },
  { value: "car", label: "By car", icon: "🚗" },
  { value: "wheelchair", label: "Step-free / accessible", icon: "♿" },
];

const STEPS = ["Budget", "Pace", "Getting around", "Interests"] as const;

export default function TripSetup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const createMut = useCreateSearchProfileMutation();
  const updateMut = useUpdateSearchProfileMutation();
  const profilesQuery = useSearchProfiles();
  const interestsQuery = useInterests();
  // Chips are the curated labels the catalogue actually has; the request sends
  // their ids (labels used to go out as interest_ids and were refused). When
  // none of the curated names exist, the catalogue's own names stand in.
  const catalogue = () => (interestsQuery.data ?? []).map((i) => ({ id: i.id, name: i.name }));
  const chips = createMemo(() => {
    const names = new Set(catalogue().map((i) => i.name.trim().toLowerCase()));
    const curated = TRIP_SETUP_INTERESTS.filter((label) => names.has(label.toLowerCase()));
    if (curated.length > 0) return curated;
    return catalogue()
      .map((i) => i.name)
      .slice(0, 12);
  });
  const [saveError, setSaveError] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);

  // Where the user was headed before the questionnaire; /discover otherwise.
  const nextPath = () =>
    safeNextPath(typeof searchParams.next === "string" ? searchParams.next : undefined);

  // Offered once per account: seen counts from the first look, finished or
  // not. The user can arrive before the profile call that fills user() does.
  createEffect(() => markTripSetupSeen(user()?.id));

  const [step, setStep] = createSignal(0);
  const [budget, setBudget] = createSignal("2");
  const [pace, setPace] = createSignal("moderate");
  const [mobility, setMobility] = createSignal("walking");
  const [interests, setInterests] = createSignal<string[]>([]);

  const toggleInterest = (i: string) =>
    setInterests((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));

  // Interests are required only when there is a catalogue to pick from; a
  // failed catalogue load must not trap the user on the last step.
  const canNext = () => {
    if (step() === 3) return interests().length > 0 || chips().length === 0;
    return true;
  };

  const finish = async () => {
    if (saving()) return;
    setSaveError(null);
    setSaving(true);
    try {
      // Every account already has the server-created default profile; update
      // it rather than adding a second one.
      const profiles = profilesQuery.data ?? (await fetchPreferenceProfilesRPC());
      const save = tripSetupSave(
        {
          budget: budget(),
          pace: pace(),
          mobility: mobility(),
          interests: interests(),
          catalogue: catalogue(),
        },
        profiles,
      );
      if (save.mode === "update") {
        await updateMut.mutateAsync({ profileId: save.profileId, data: save.data });
      } else {
        await createMut.mutateAsync(save.data);
      }
      navigate(nextPath());
    } catch (error) {
      // The profile is what personalises the first search, so a failed save
      // is said out loud with a retry, never swallowed on the way out.
      setSaveError(
        error instanceof Error && error.message
          ? error.message
          : "We couldn't save your preferences.",
      );
    } finally {
      setSaving(false);
    }
  };

  const skip = () => navigate(nextPath());

  const next = () => (step() < STEPS.length - 1 ? setStep(step() + 1) : finish());
  const back = () => step() > 0 && setStep(step() - 1);

  return (
    <main class="mx-auto flex min-h-[70vh] max-w-lg flex-col px-4 py-10">
      {/* Progress */}
      <div class="mb-8">
        <div class="mb-2 flex justify-between text-xs text-muted-foreground">
          <span>{STEPS[step()]}</span>
          <span>
            {step() + 1} / {STEPS.length}
          </span>
        </div>
        <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            class="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((step() + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div class="flex-1">
        <Show when={step() === 0}>
          <Question title="What's your budget?" subtitle="We'll tune recommendations to match.">
            <ChoiceGrid choices={BUDGETS} selected={budget()} onSelect={setBudget} />
          </Question>
        </Show>

        <Show when={step() === 1}>
          <Question title="How packed should days be?">
            <ChoiceGrid choices={PACES} selected={pace()} onSelect={setPace} />
          </Question>
        </Show>

        <Show when={step() === 2}>
          <Question title="How will you get around?">
            <ChoiceGrid choices={MOBILITY} selected={mobility()} onSelect={setMobility} />
          </Question>
        </Show>

        <Show when={step() === 3}>
          <Question title="What are you into?" subtitle="Pick a few — you can change these later.">
            <Show when={interestsQuery.isPending}>
              <p class="text-sm text-muted-foreground">Loading interests…</p>
            </Show>
            <Show when={interestsQuery.isError}>
              <p role="alert" class="text-sm text-destructive">
                We couldn't load interests. You can finish without them and add some later in your
                profile.
              </p>
            </Show>
            <div class="flex flex-wrap gap-2">
              <For each={chips()}>
                {(i) => (
                  <button
                    type="button"
                    onClick={() => toggleInterest(i)}
                    class={`rounded-full border px-3 py-1.5 text-sm transition ${
                      interests().includes(i)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-accent"
                    }`}
                  >
                    {i}
                  </button>
                )}
              </For>
            </div>
          </Question>
        </Show>
      </div>

      <Show when={saveError()}>
        <div
          role="alert"
          class="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
        >
          <p>{saveError()}</p>
          <div class="mt-2 flex gap-3">
            <button type="button" class="font-medium underline" onClick={() => void finish()}>
              Try again
            </button>
            <button type="button" class="text-muted-foreground underline" onClick={skip}>
              Skip for now
            </button>
          </div>
        </div>
      </Show>

      {/* Nav */}
      <div class="mt-8 flex items-center justify-between">
        <button
          type="button"
          class="text-sm text-muted-foreground hover:text-foreground disabled:opacity-0"
          onClick={back}
          disabled={step() === 0}
        >
          ← Back
        </button>
        <div class="flex items-center gap-4">
          <button
            type="button"
            class="text-sm text-muted-foreground hover:text-foreground"
            onClick={skip}
          >
            Skip
          </button>
          <button
            type="button"
            class="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            onClick={() => void next()}
            disabled={!canNext() || saving()}
          >
            {step() === STEPS.length - 1 ? (saving() ? "Saving…" : "Start planning") : "Next"}
          </button>
        </div>
      </div>
    </main>
  );
}

function Question(props: { title: string; subtitle?: string; children: any }) {
  return (
    <div>
      <h1 class="text-2xl font-semibold">{props.title}</h1>
      <Show when={props.subtitle}>
        <p class="mt-1 text-sm text-muted-foreground">{props.subtitle}</p>
      </Show>
      <div class="mt-6">{props.children}</div>
    </div>
  );
}

function ChoiceGrid(props: { choices: Choice[]; selected: string; onSelect: (v: string) => void }) {
  return (
    <div class="grid grid-cols-2 gap-3">
      <For each={props.choices}>
        {(c) => (
          <button
            type="button"
            onClick={() => props.onSelect(c.value)}
            class={`flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition ${
              props.selected === c.value
                ? "border-primary ring-2 ring-primary/30"
                : "hover:bg-accent"
            }`}
          >
            <span class="text-2xl">{c.icon}</span>
            <span class="font-medium">{c.label}</span>
            <Show when={c.hint}>
              <span class="text-xs text-muted-foreground">{c.hint}</span>
            </Show>
          </button>
        )}
      </For>
    </div>
  );
}
