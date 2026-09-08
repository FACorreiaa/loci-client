import { createMemo, createSignal, For, Show } from "solid-js";
import { Globe2 } from "lucide-solid";
import { Button } from "~/ui/button";
import { TextField, TextFieldRoot } from "~/ui/textfield";
import { Label } from "~/ui/label";
import { useUpdateProfileMutation, useUserProfileQuery } from "~/lib/api/user";
import { useLocale } from "~/contexts/LocaleContext";
import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  formatDistance,
  formatPrice,
  groupTimezones,
  guessTimezone,
  supportedTimezones,
  UNITS_OPTIONS,
  type Units,
} from "~/lib/locale";

interface LocaleSettingsProps {
  onNotification: (message: string, type: "success" | "error") => void;
}

/** A distance and a price worth previewing — the two things these settings change. */
const SAMPLE_KM = 13.2;
const SAMPLE_PRICE = 24;

/**
 * Timezone, units and currency.
 *
 * These live on the account rather than in this browser, and timezone is what
 * forces that: anything scheduled runs when no tab is open, and "9pm" means
 * nothing without knowing whose evening it is.
 */
export default function LocaleSettings(props: LocaleSettingsProps) {
  const profileQuery = useUserProfileQuery();
  const updateProfile = useUpdateProfileMutation();
  const locale = useLocale();

  const [timezone, setTimezone] = createSignal<string | null>(null);
  const [units, setUnits] = createSignal<Units | null>(null);
  const [currency, setCurrency] = createSignal<string | null>(null);

  // Null means "not touched", so the form shows what is stored until somebody
  // changes something. Falling back to the context means an unset timezone
  // shows the browser's guess, which is what the app is already using.
  const currentTimezone = () => timezone() ?? locale.timezone();
  const currentUnits = () => units() ?? locale.units();
  const currentCurrency = () => currency() ?? locale.currency();

  const zones = createMemo(() => groupTimezones(supportedTimezones()));
  // Old browsers have no Intl.supportedValuesOf and there is no list worth
  // shipping as a fallback — it would go stale the same way a CHECK constraint
  // would. The server validates against tzdata either way.
  const hasZoneList = () => zones().length > 0;

  const dirty = () =>
    (timezone() !== null && timezone() !== (profileQuery.data?.timezone ?? "")) ||
    (units() !== null && units() !== locale.units()) ||
    (currency() !== null && currency() !== locale.currency());

  const handleSave = async (e: Event) => {
    e.preventDefault();
    try {
      await updateProfile.mutateAsync({
        timezone: currentTimezone(),
        units: currentUnits(),
        currency: currentCurrency(),
      });
      setTimezone(null);
      setUnits(null);
      setCurrency(null);
      props.onNotification("Saved.", "success");
    } catch (err) {
      props.onNotification(
        err instanceof Error ? err.message : "Couldn't save your locale settings.",
        "error",
      );
    }
  };

  return (
    <form onSubmit={handleSave} class="space-y-6">
      <div>
        <h3 class="text-lg font-semibold text-foreground flex items-center gap-2">
          <Globe2 class="w-5 h-5 text-primary" />
          Region and units
        </h3>
        <p class="text-sm text-muted-foreground mt-1">
          Kept on your account, not in this browser — so they follow you between devices, and
          anything Loci schedules knows what time it is where you are.
        </p>
      </div>

      <div>
        <Label for="tz" class="text-sm">
          Time zone
        </Label>
        <Show
          when={hasZoneList()}
          fallback={
            <>
              <TextFieldRoot class="mt-1">
                <TextField
                  id="tz"
                  placeholder="Atlantic/Madeira"
                  value={currentTimezone()}
                  onInput={(e) => setTimezone(e.currentTarget.value)}
                  maxLength={64}
                />
              </TextFieldRoot>
              <p class="text-xs text-muted-foreground mt-1">
                This browser can't list zones, so type an IANA name. Loci checks it against the
                zones the server knows before saving.
              </p>
            </>
          }
        >
          <select
            id="tz"
            value={currentTimezone()}
            onChange={(e) => setTimezone(e.currentTarget.value)}
            class="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
          >
            {/* A zone the browser does not list — set on another device, or from
                a newer tzdata — must stay selectable rather than silently
                becoming something else. */}
            <Show when={currentTimezone() && !supportedTimezones().includes(currentTimezone())}>
              <option value={currentTimezone()}>{currentTimezone()}</option>
            </Show>
            <For each={zones()}>
              {(group) => (
                <optgroup label={group.region}>
                  <For each={group.zones}>
                    {(zone) => <option value={zone}>{zone.replace(/_/g, " ")}</option>}
                  </For>
                </optgroup>
              )}
            </For>
          </select>
        </Show>
        <Show when={locale.timezoneIsGuess() && timezone() === null}>
          <p class="text-xs text-muted-foreground mt-1">
            Currently guessed from this browser ({guessTimezone() || "unknown"}
            ). Save to fix it to your account — useful if you travel, since the guess follows the
            laptop and your account should not.
          </p>
        </Show>
      </div>

      <fieldset>
        <legend class="text-sm font-medium text-foreground">Units</legend>
        <div class="mt-2 grid grid-cols-2 gap-2">
          <For each={UNITS_OPTIONS}>
            {(option) => (
              <button
                type="button"
                aria-pressed={currentUnits() === option.value}
                onClick={() => setUnits(option.value)}
                class={`rounded-lg border p-3 text-left transition-colors ${
                  currentUnits() === option.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <span class="block text-sm font-medium text-foreground">{option.label}</span>
                <span class="block text-xs text-muted-foreground">{option.detail}</span>
              </button>
            )}
          </For>
        </div>
      </fieldset>

      <div>
        <Label for="currency" class="text-sm">
          Currency
        </Label>
        <select
          id="currency"
          value={currentCurrency()}
          onChange={(e) => setCurrency(e.currentTarget.value)}
          class="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
        >
          {/* Same reason as the timezone escape hatch: a code the list does not
              carry is still what this account is set to. */}
          <Show when={!CURRENCY_OPTIONS.some((c) => c.value === currentCurrency())}>
            <option value={currentCurrency()}>{currentCurrency()}</option>
          </Show>
          <For each={CURRENCY_OPTIONS}>
            {(option) => <option value={option.value}>{option.label}</option>}
          </For>
        </select>
        <p class="text-xs text-muted-foreground mt-1">
          Loci shows prices in this currency. It does not convert them — a price from a source in
          euros is still that price.
        </p>
      </div>

      {/* What the choices above actually do, before saving them. */}
      <div class="rounded-lg border border-border bg-muted/40 p-3">
        <div class="text-xs font-medium text-foreground">Preview</div>
        <div class="text-sm text-muted-foreground mt-1">
          A place {formatDistance(SAMPLE_KM, currentUnits())} away, around{" "}
          {formatPrice(SAMPLE_PRICE, currentCurrency())} a head.
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <Show when={dirty()}>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setTimezone(null);
              setUnits(null);
              setCurrency(null);
            }}
          >
            Cancel
          </Button>
        </Show>
        <Button type="submit" disabled={updateProfile.isPending || !dirty()}>
          {updateProfile.isPending ? "Saving…" : "Save"}
        </Button>
      </div>

      <Show when={currentCurrency() !== DEFAULT_CURRENCY && profileQuery.isError}>
        <p class="text-xs text-destructive">
          Your profile didn't load, so what's shown may not be what's stored.
        </p>
      </Show>
    </form>
  );
}
