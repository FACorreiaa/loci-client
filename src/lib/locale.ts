// Units and currency, in one place.
//
// Everything Loci measures is metric: `calculateDistance` is a Haversine with
// R in kilometres, `search_radius_km` is kilometres, and the API's
// `distance_km` is too. Imperial is therefore a presentation choice made at the
// edge — never a second unit carried through the app, which is how you end up
// with a field whose units depend on which code path filled it.
//
// The counterexample is in this repository's own history: the LLM path wrote
// metres into a field the client read as kilometres, so a POI 1.8 km away was
// published as 1800. Formatting in one place is what stops that being
// reinvented per component.

export type Units = "metric" | "imperial";

export const UNITS_OPTIONS: { value: Units; label: string; detail: string }[] = [
  { value: "metric", label: "Metric", detail: "kilometres and metres" },
  { value: "imperial", label: "Imperial", detail: "miles and feet" },
];

/** Exact by definition: a statute mile is 1609.344 metres. */
export const KM_PER_MILE = 1.609344;
const FEET_PER_KM = 3280.839895;

/**
 * formatDistance renders a distance given **in kilometres**.
 *
 * The unit of the argument is the whole contract here, so it is in the name of
 * nothing and the head of this comment instead: callers pass km, always.
 */
export function formatDistance(km: number, units: Units = "metric"): string {
  if (!Number.isFinite(km) || km < 0) return "";

  if (units === "imperial") {
    const miles = km / KM_PER_MILE;
    // Under a tenth of a mile, feet are what somebody would actually say.
    if (miles < 0.1) return `${Math.round(km * FEET_PER_KM)} ft`;
    if (miles < 10) return `${miles.toFixed(1)} mi`;
    return `${Math.round(miles)} mi`;
  }

  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/** The currencies offered in settings. Any ISO 4217 code the server accepts works. */
export const CURRENCY_OPTIONS: { value: string; label: string }[] = [
  { value: "EUR", label: "Euro (€)" },
  { value: "GBP", label: "British pound (£)" },
  { value: "USD", label: "US dollar ($)" },
  { value: "CHF", label: "Swiss franc (CHF)" },
  { value: "JPY", label: "Japanese yen (¥)" },
  { value: "CAD", label: "Canadian dollar (C$)" },
  { value: "AUD", label: "Australian dollar (A$)" },
  { value: "BRL", label: "Brazilian real (R$)" },
];

export const DEFAULT_CURRENCY = "EUR";

/**
 * formatPrice renders an amount in the user's currency.
 *
 * The old implementation hardcoded EUR *and* the locale `"en-EU"`, which is not
 * a locale — `Intl` falls back to the default when it cannot parse one, so the
 * grouping and symbol placement were whatever the browser felt like rather than
 * anything chosen.
 */
export function formatPrice(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  locale?: string,
): string {
  if (!Number.isFinite(amount)) return "";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // An unknown currency code throws rather than degrading. Showing the number
    // with the code beside it is more use than showing nothing.
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * guessTimezone returns the browser's own idea of the zone.
 *
 * Only ever a *suggestion*: it is what settings offers when nobody has chosen,
 * and it must never overwrite a zone somebody set deliberately — that account
 * may be travelling, and the point of storing one is that it does not follow
 * the laptop around.
 */
export function guessTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

/**
 * supportedTimezones lists the zones this browser knows, newest API first.
 *
 * `Intl.supportedValuesOf` is not everywhere yet, and there is no useful
 * fallback list worth shipping — a hand-written one goes stale exactly like a
 * CHECK constraint would. When it is missing the settings card falls back to a
 * free-text field, which the server validates against tzdata anyway.
 */
export function supportedTimezones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  try {
    return intl.supportedValuesOf?.("timeZone") ?? [];
  } catch {
    return [];
  }
}

/** Groups zone names by their region prefix, for a select that is navigable. */
export function groupTimezones(zones: string[]): { region: string; zones: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const zone of zones) {
    const region = zone.includes("/") ? zone.slice(0, zone.indexOf("/")) : "Other";
    const list = groups.get(region);
    if (list) list.push(zone);
    else groups.set(region, [zone]);
  }
  return [...groups.entries()]
    .map(([region, list]) => ({ region, zones: list.sort() }))
    .sort((a, b) => a.region.localeCompare(b.region));
}
