import { For, Show, type JSX } from "solid-js";
import { Trash2 } from "lucide-solid";
import {
  CONSENT_EXPLANATION,
  DAY_CHOICES,
  INCLINE_CHOICES,
  LEG_CHOICES,
  MOBILITY_CHOICES,
  NOTES_LIMIT,
  REST_CHOICES,
  canEditNeeds,
  deleteNeeds,
  minutesLimitLabel,
  needsStepFree,
  type AccessibilityFormState,
  type AccessibilityNeeds,
} from "~/lib/accessibility";

/**
 * The travel profile's access needs, behind an explicit consent.
 *
 * Needs are health data (GDPR Art. 9). Nothing here is editable, and nothing
 * is sent, until the traveller ticks the consent box — it starts unticked and
 * stays a separate choice from everything else in the form. A profile that
 * already holds consented needs opens unlocked, with a way to delete them.
 *
 * The fields sit in a <fieldset disabled>, so while locked they are skipped by
 * the keyboard and announced as unavailable, not merely greyed out.
 */
export default function AccessibilityNeedsSection(props: {
  state: AccessibilityFormState;
  onChange: (next: AccessibilityFormState) => void;
}) {
  const needs = () => props.state.needs;
  const set = <K extends keyof AccessibilityNeeds>(key: K, value: AccessibilityNeeds[K]) =>
    props.onChange({ ...props.state, needs: { ...props.state.needs, [key]: value } });
  const asksConsent = () => props.state.stored === null || props.state.clear;

  const selectClass =
    "w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent";

  const check = (key: BooleanKey, label: string) => (
    <label class="flex items-start gap-2 py-1">
      <input
        type="checkbox"
        class="mt-0.5"
        checked={needs()[key]}
        onChange={(e) => set(key, e.currentTarget.checked)}
      />
      <span class="text-sm">{label}</span>
    </label>
  );

  const minutes = (
    key: "max_walk_minutes_per_leg" | "max_walk_minutes_per_day" | "rest_every_minutes",
    label: string,
    choices: number[],
    zero: string,
  ) => (
    <label class="block">
      <span class="block text-sm font-medium text-foreground mb-2">{label}</span>
      <select
        class={selectClass}
        value={String(needs()[key])}
        onChange={(e) => set(key, Number(e.currentTarget.value))}
      >
        <For each={choices}>
          {(m) => <option value={String(m)}>{m === 0 ? zero : minutesLimitLabel(m)}</option>}
        </For>
      </select>
    </label>
  );

  return (
    <div class="space-y-6">
      <Show when={asksConsent()}>
        <div class="rounded-xl border border-border bg-muted/40 p-4 space-y-2">
          <h4 class="text-sm font-semibold text-foreground">Plans that work for you</h4>
          <p id="accessibility-consent-explanation" class="text-sm text-muted-foreground">
            {CONSENT_EXPLANATION}
          </p>
          <label class="flex items-start gap-2 pt-1">
            <input
              type="checkbox"
              class="mt-0.5"
              data-testid="accessibility-consent"
              aria-describedby="accessibility-consent-explanation"
              checked={props.state.consentGiven}
              onChange={(e) =>
                props.onChange({ ...props.state, consentGiven: e.currentTarget.checked })
              }
            />
            <span class="text-sm font-medium">Let Loci store my accessibility needs</span>
          </label>
        </div>
      </Show>

      <fieldset
        disabled={!canEditNeeds(props.state)}
        class="space-y-6"
        data-testid="accessibility-fields"
      >
        <Group title="Getting around">
          <label class="block">
            <span class="block text-sm font-medium text-foreground mb-2">Mobility</span>
            <select
              class={selectClass}
              value={needs().mobility}
              onChange={(e) =>
                set("mobility", e.currentTarget.value as AccessibilityNeeds["mobility"])
              }
            >
              <For each={MOBILITY_CHOICES}>{(c) => <option value={c.value}>{c.label}</option>}</For>
            </select>
          </label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {minutes(
              "max_walk_minutes_per_leg",
              "Longest walk between stops",
              LEG_CHOICES,
              "No limit",
            )}
            {minutes("max_walk_minutes_per_day", "Walking in a whole day", DAY_CHOICES, "No limit")}
          </div>
          {check("step_free_only", "Step-free routes and entrances only")}
          {check("stroller", "Travelling with a stroller")}
          <Show when={needsStepFree(needs())}>
            <label class="block">
              <span class="block text-sm font-medium text-foreground mb-2">Slopes</span>
              <select
                class={selectClass}
                value={needs().max_incline}
                onChange={(e) =>
                  set("max_incline", e.currentTarget.value as AccessibilityNeeds["max_incline"])
                }
              >
                <For each={INCLINE_CHOICES}>
                  {(c) => <option value={c.value}>{c.label}</option>}
                </For>
              </select>
            </label>
          </Show>
          {check("avoid_cobbles", "Avoid cobblestones")}
        </Group>

        <Group title="Rest and comfort">
          {minutes("rest_every_minutes", "Seated rest every", REST_CHOICES, "No need")}
          {check("needs_seating_at_stops", "Somewhere to sit at each stop")}
          {check("needs_accessible_toilet", "An accessible toilet nearby")}
          {check("fatigue_or_chronic_pain", "I tire quickly or live with pain")}
        </Group>

        <Group title="Seeing, hearing and senses">
          {check("low_vision", "Low vision")}
          {check("blind", "Blind")}
          {check("deaf_or_hard_of_hearing", "Deaf or hard of hearing")}
          {check("sensory_sensitive", "Noise, crowds or bright light are hard")}
          {check("prefers_quiet_times", "Prefer quiet, off-peak times")}
          {check("needs_predictable_plan", "A predictable plan helps me")}
        </Group>

        <Group title="Travelling with">
          {check("service_animal", "A service animal")}
          {check("travelling_with_companion", "A companion or carer")}
        </Group>

        <label class="block">
          <span class="block text-sm font-medium text-foreground mb-2">In your own words</span>
          <textarea
            rows={3}
            maxLength={NOTES_LIMIT}
            class={selectClass}
            placeholder="Anything else Loci should know"
            aria-describedby="accessibility-notes-count"
            value={needs().notes}
            onInput={(e) => set("notes", e.currentTarget.value.slice(0, NOTES_LIMIT))}
          />
          <span
            id="accessibility-notes-count"
            class="mt-1 block text-right text-xs text-muted-foreground"
            aria-label={`${needs().notes.length} of ${NOTES_LIMIT} characters`}
          >
            {needs().notes.length}/{NOTES_LIMIT}
          </span>
        </label>
      </fieldset>

      <Show when={props.state.stored !== null}>
        <div class="space-y-1">
          <Show
            when={props.state.clear}
            fallback={
              <button
                type="button"
                data-testid="accessibility-delete"
                class="inline-flex items-center gap-2 rounded-lg border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-ring"
                onClick={() => props.onChange(deleteNeeds(props.state))}
              >
                <Trash2 class="w-4 h-4" aria-hidden="true" />
                Delete my accessibility info
              </button>
            }
          >
            <p class="text-sm text-muted-foreground" role="status">
              Your accessibility needs will be deleted when you save.
            </p>
          </Show>
          <p class="text-xs text-muted-foreground">
            Deleting also withdraws your consent. Loci will ask again before storing needs.
          </p>
        </div>
      </Show>
    </div>
  );
}

type BooleanKey = {
  [K in keyof AccessibilityNeeds]: AccessibilityNeeds[K] extends boolean ? K : never;
}[keyof AccessibilityNeeds];

function Group(props: { title: string; children: JSX.Element }) {
  return (
    <fieldset class="space-y-3">
      <legend class="text-sm font-semibold text-foreground mb-1">{props.title}</legend>
      {props.children}
    </fieldset>
  );
}
