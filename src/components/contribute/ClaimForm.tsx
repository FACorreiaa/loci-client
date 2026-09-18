import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { CheckCircle2, ShieldCheck } from "lucide-solid";
import {
  type PlaceFactField,
  type VerificationTask,
  useSubmitPlaceClaims,
} from "~/lib/api/place-intelligence";
import { capture } from "~/lib/analytics";
import {
  defaultOpeningHours,
  encodeOpeningHours,
  isValidOpeningHours,
  type OpeningHours,
} from "~/lib/place-facts/opening-hours";
import {
  claimValuesFor,
  fieldLabel,
  fieldQuestion,
  vocabularyFor,
} from "~/lib/place-facts/vocabulary";
import { ErrorView } from "~/components/ErrorView";
import { Button } from "~/ui/button";
import { ToggleGroup, ToggleGroupItem } from "~/ui/toggle-group";
import { ClaimResult } from "./ClaimResult";
import { FieldPicker } from "./FieldPicker";

/**
 * One field report about one place.
 *
 * Everything here exists to make the submitted value canonical: the scout picks
 * from a vocabulary, and what goes on the wire is that selection sorted and
 * joined the one agreed way. Two scouts reporting the same thing then produce
 * the same string, which is the only way the server can ever corroborate them.
 */
export function ClaimForm(props: { task: VerificationTask }) {
  const submit = useSubmitPlaceClaims();
  const [field, setField] = createSignal<PlaceFactField>();
  const [tokens, setTokens] = createSignal<string[]>([]);
  const [hours, setHours] = createSignal<OpeningHours>(defaultOpeningHours());

  // A task can legitimately arrive with nothing left to ask, so the first field
  // is read reactively rather than assumed to exist.
  createEffect(() => {
    const requested = props.task.requestedFields;
    setField(requested[0]);
    setTokens([]);
    setHours(defaultOpeningHours());
    submit.reset();
  });

  const structured = createMemo(() => {
    const current = field();
    return current ? vocabularyFor(current).kind === "structured" : false;
  });

  // One claim per answer, so each is corroborated on its own rather than only
  // as part of an identical set.
  const claimValues = createMemo(() => {
    const current = field();
    if (!current) return [];
    return structured() ? [encodeOpeningHours(hours())] : claimValuesFor(current, tokens());
  });

  const ready = createMemo(() => {
    if (!field()) return false;
    if (structured()) return isValidOpeningHours(hours());
    return tokens().length > 0;
  });

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    const selectedField = field();
    if (!selectedField || !ready()) return;
    const values = claimValues();
    submit.mutate(
      { poiId: props.task.poiId, field: selectedField, values },
      {
        onSuccess: (result) => {
          capture("place_claim_submitted", {
            field: selectedField,
            status: result.status,
            poiId: props.task.poiId,
            answers: values.length,
          });
          setTokens([]);
        },
      },
    );
  };

  return (
    <form onSubmit={onSubmit}>
      <p class="font-coord text-[10px] uppercase tracking-[0.18em] text-accent">Field report</p>
      <h2 class="mt-2 text-2xl">{props.task.poiName}</h2>

      <Show
        when={props.task.requestedFields.length > 0}
        fallback={
          <p class="mt-6 text-sm text-muted-foreground">
            Everything we ask about this place is already covered. Pick another.
          </p>
        }
      >
        <label class="mt-6 block text-sm font-semibold">What did you verify?</label>
        <ToggleGroup
          size="sm"
          variant="outline"
          value={field() ?? ""}
          onChange={(next) => {
            if (!next) return;
            setField(next as PlaceFactField);
            setTokens([]);
            submit.reset();
          }}
          aria-label="What did you verify?"
          class="mt-2 flex-wrap justify-start"
        >
          <For each={props.task.requestedFields}>
            {(requested) => (
              <ToggleGroupItem value={requested} aria-label={fieldLabel(requested)}>
                {fieldLabel(requested)}
              </ToggleGroupItem>
            )}
          </For>
        </ToggleGroup>

        <Show when={field()}>
          {(selected) => (
            <>
              <label class="mt-5 block text-sm font-semibold">{fieldQuestion(selected())}</label>
              <FieldPicker
                field={selected()}
                tokens={tokens()}
                onTokensChange={setTokens}
                hours={hours()}
                onHoursChange={setHours}
              />
            </>
          )}
        </Show>

        <div class="mt-4 flex items-start gap-2 rounded-lg bg-secondary/60 p-3 text-xs leading-5 text-secondary-foreground">
          <ShieldCheck class="mt-0.5 h-4 w-4 shrink-0" /> Reports expire as places change. Your
          reputation grows when another scout corroborates your observation.
        </div>

        <Button type="submit" class="mt-5 w-full gap-2" disabled={!ready() || submit.isPending}>
          <CheckCircle2 class="h-4 w-4" />
          {submit.isPending ? "Submitting…" : "Submit field report"}
        </Button>

        <Show when={submit.isError}>
          <ErrorView error={submit.error} class="mt-4" />
        </Show>

        <Show when={submit.isSuccess && submit.data}>
          {(result) => <ClaimResult status={result().status} />}
        </Show>
      </Show>
    </form>
  );
}
