/**
 * The curated "in season" table: destinations with a reason to go this month.
 * Hooks are tied to the destination's own calendar (Oktoberfest is September
 * wherever the viewer sits), so there is no hemisphere logic. Iberia and the
 * rest of Europe come first; the user base is there. Pure data, no DOM.
 */

export interface SeasonalPick {
  city: string;
  /** ISO 3166-1 alpha-2, for the flag. */
  countryCode: string;
  /** Months (1–12) the hook applies. */
  months: number[];
  /** Reads after "for": "the harvest season", "Oktoberfest", "early blossom". */
  hook: string;
  emoji: string;
  /** Trip length the prompt asks for. Default 3. */
  days?: number;
}

export const SEASONAL_PICKS: SeasonalPick[] = [
  // January
  {
    city: "Tromsø",
    countryCode: "NO",
    months: [1, 2, 11, 12],
    hook: "the northern lights",
    emoji: "🌌",
    days: 4,
  },
  { city: "Madeira", countryCode: "PT", months: [1, 2], hook: "a mild winter escape", emoji: "🌿" },
  { city: "Seville", countryCode: "ES", months: [1, 2], hook: "the orange harvest", emoji: "🍊" },
  { city: "Vienna", countryCode: "AT", months: [1], hook: "ball season", emoji: "🎻" },
  { city: "Innsbruck", countryCode: "AT", months: [1, 2], hook: "a ski weekend", emoji: "⛷️" },
  // February
  { city: "Venice", countryCode: "IT", months: [2], hook: "carnival", emoji: "🎭" },
  { city: "Valencia", countryCode: "ES", months: [2, 3], hook: "Las Fallas", emoji: "🔥" },
  {
    city: "Marrakech",
    countryCode: "MA",
    months: [2, 3, 11],
    hook: "the mild season",
    emoji: "🏺",
  },
  // March
  { city: "Kyoto", countryCode: "JP", months: [3, 4], hook: "early blossom", emoji: "🌸", days: 5 },
  { city: "Lisbon", countryCode: "PT", months: [3, 4], hook: "the first spring light", emoji: "☀️" },
  { city: "Dublin", countryCode: "IE", months: [3], hook: "St Patrick's week", emoji: "☘️" },
  { city: "Rome", countryCode: "IT", months: [3, 4, 10], hook: "shoulder season", emoji: "🏛️" },
  // April
  { city: "Amsterdam", countryCode: "NL", months: [4], hook: "tulip season", emoji: "🌷" },
  { city: "Seville", countryCode: "ES", months: [4], hook: "Feria de Abril", emoji: "💃" },
  { city: "Paris", countryCode: "FR", months: [4, 5], hook: "spring in the parks", emoji: "🥐" },
  {
    city: "Istanbul",
    countryCode: "TR",
    months: [4, 5, 10],
    hook: "the tulip festival",
    emoji: "🕌",
  },
  // May
  { city: "Lisbon", countryCode: "PT", months: [5, 6], hook: "the jacarandas", emoji: "💜" },
  { city: "Porto", countryCode: "PT", months: [5, 6], hook: "São João", emoji: "🎈" },
  {
    city: "Amalfi",
    countryCode: "IT",
    months: [5, 6, 9],
    hook: "the coast before the crowds",
    emoji: "🍋",
  },
  {
    city: "Crete",
    countryCode: "GR",
    months: [5, 6, 9, 10],
    hook: "warm sea, quiet beaches",
    emoji: "🏖️",
    days: 5,
  },
  // June
  {
    city: "Reykjavik",
    countryCode: "IS",
    months: [6, 7],
    hook: "the midnight sun",
    emoji: "🌞",
    days: 4,
  },
  { city: "Stockholm", countryCode: "SE", months: [6], hook: "Midsummer", emoji: "🌼" },
  {
    city: "Sintra",
    countryCode: "PT",
    months: [6, 7, 8],
    hook: "cool hills above Lisbon",
    emoji: "🏰",
  },
  // July
  {
    city: "Dubrovnik",
    countryCode: "HR",
    months: [7, 8],
    hook: "the summer festival",
    emoji: "🎪",
  },
  { city: "Avignon", countryCode: "FR", months: [7], hook: "the theatre festival", emoji: "🎟️" },
  {
    city: "Bergen",
    countryCode: "NO",
    months: [7, 8],
    hook: "long fjord days",
    emoji: "⛰️",
    days: 4,
  },
  {
    city: "Azores",
    countryCode: "PT",
    months: [7, 8, 9],
    hook: "hydrangeas and whales",
    emoji: "🐋",
    days: 5,
  },
  // August
  { city: "Edinburgh", countryCode: "GB", months: [8], hook: "the Fringe", emoji: "🎤", days: 4 },
  { city: "Salzburg", countryCode: "AT", months: [8], hook: "the summer festival", emoji: "🎼" },
  {
    city: "San Sebastián",
    countryCode: "ES",
    months: [8, 9],
    hook: "Semana Grande and pintxos",
    emoji: "🍢",
  },
  // September
  { city: "Porto", countryCode: "PT", months: [9, 10], hook: "the harvest season", emoji: "🍇" },
  { city: "Munich", countryCode: "DE", months: [9, 10], hook: "Oktoberfest", emoji: "🍺" },
  { city: "Ljubljana", countryCode: "SI", months: [9, 10], hook: "the golden hour", emoji: "🍂" },
  { city: "Bordeaux", countryCode: "FR", months: [9, 10], hook: "the vendanges", emoji: "🍷" },
  { city: "Barcelona", countryCode: "ES", months: [9], hook: "La Mercè", emoji: "🎆" },
  // October
  {
    city: "Douro Valley",
    countryCode: "PT",
    months: [10],
    hook: "the grape harvest",
    emoji: "🍇",
    days: 2,
  },
  {
    city: "Boston",
    countryCode: "US",
    months: [10],
    hook: "New England foliage",
    emoji: "🍁",
    days: 5,
  },
  {
    city: "Alsace",
    countryCode: "FR",
    months: [10, 11],
    hook: "wine villages in autumn",
    emoji: "🍂",
  },
  // November
  { city: "Madrid", countryCode: "ES", months: [11], hook: "the museum season", emoji: "🖼️" },
  { city: "Bruges", countryCode: "BE", months: [11, 12], hook: "misty canals", emoji: "🍫" },
  { city: "Malta", countryCode: "MT", months: [11], hook: "late sun", emoji: "🌅", days: 4 },
  // December
  { city: "Vienna", countryCode: "AT", months: [12], hook: "the Christmas markets", emoji: "🎄" },
  {
    city: "Strasbourg",
    countryCode: "FR",
    months: [12],
    hook: "the Christmas market",
    emoji: "⭐",
  },
  { city: "Copenhagen", countryCode: "DK", months: [12], hook: "hygge season", emoji: "🕯️" },
];

/** Picks for a month (1–12), in table order; empty for anything else. */
export const picksForMonth = (month: number): SeasonalPick[] =>
  SEASONAL_PICKS.filter((p) => p.months.includes(month));

/** The request the hero box can send as-is. */
export const promptFor = (p: SeasonalPick): string =>
  `Plan ${p.days ?? 3} days in ${p.city} for ${p.hook}`;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const monthLabel = (now: Date): string => MONTHS[now.getMonth()];
