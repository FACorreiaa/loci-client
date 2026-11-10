import { For } from "solid-js";
import { nightsBetween, type Stay } from "~/lib/api/pricing";
import { fieldControlClass } from "~/ui/textfield";
import { cn } from "~/lib/utils";

const control = cn(fieldControlClass, "w-auto");

const MAX_NIGHTS = 30;

const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * The stay hotel prices are quoted for. Changing it reprices the list; it
 * never regenerates it. Checkout is kept after checkin and within 30 nights,
 * the server's limits.
 */
export default function StayControl(props: {
  stay: Stay;
  onChange: (stay: Stay) => void;
  today?: string;
}) {
  const today = () => props.today ?? new Date().toISOString().slice(0, 10);
  const nights = () => nightsBetween(props.stay);

  const setCheckin = (checkin: string) => {
    if (!checkin) return;
    let checkout = props.stay.checkout;
    const n = nightsBetween({ checkin, checkout });
    if (n < 1 || n > MAX_NIGHTS)
      checkout = addDays(checkin, Math.max(1, Math.min(nights(), MAX_NIGHTS)));
    props.onChange({ ...props.stay, checkin, checkout });
  };
  const setCheckout = (checkout: string) => {
    if (!checkout) return;
    const n = nightsBetween({ checkin: props.stay.checkin, checkout });
    if (n < 1 || n > MAX_NIGHTS) return;
    props.onChange({ ...props.stay, checkout });
  };

  return (
    <fieldset class="flex flex-wrap items-end gap-3 text-sm" data-testid="stay-control">
      <legend class="sr-only">Dates and guests for prices</legend>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted-foreground">Check-in</span>
        <input
          type="date"
          class={control}
          min={today()}
          value={props.stay.checkin}
          onChange={(e) => setCheckin(e.currentTarget.value)}
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted-foreground">Check-out</span>
        <input
          type="date"
          class={control}
          min={addDays(props.stay.checkin, 1)}
          max={addDays(props.stay.checkin, MAX_NIGHTS)}
          value={props.stay.checkout}
          onChange={(e) => setCheckout(e.currentTarget.value)}
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted-foreground">Guests</span>
        <select
          class={control}
          value={String(props.stay.adults)}
          onChange={(e) => props.onChange({ ...props.stay, adults: Number(e.currentTarget.value) })}
        >
          <For each={[1, 2, 3, 4, 5, 6, 7, 8]}>
            {(n) => (
              <option value={String(n)}>
                {n} {n === 1 ? "adult" : "adults"}
              </option>
            )}
          </For>
        </select>
      </label>
      <span class="pb-3 text-xs text-muted-foreground" aria-live="polite">
        {nights()} {nights() === 1 ? "night" : "nights"}
      </span>
    </fieldset>
  );
}
