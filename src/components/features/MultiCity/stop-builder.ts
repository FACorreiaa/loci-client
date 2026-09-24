// The stop builder's list operations: pure, capped at MAX_STOPS, and a city
// named twice (in any case or spacing) is one city.
import { MAX_STOPS, type StopInput } from "./multi-city-view";

const key = (s: string) => s.trim().toLowerCase();

/** Two nights is the default: a first guess the traveller adjusts. */
export function addStop(list: StopInput[], name: string): StopInput[] {
  const cityName = name.trim();
  if (!cityName || list.length >= MAX_STOPS || list.some((s) => key(s.cityName) === key(cityName)))
    return list;
  return [...list, { cityName, nights: 2 }];
}

export function moveStop(list: StopInput[], from: number, to: number): StopInput[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Nights stay within what the server accepts (1–14). */
export const setNights = (list: StopInput[], i: number, n: number): StopInput[] =>
  list.map((s, j) => (j === i ? { ...s, nights: Math.min(14, Math.max(1, Math.round(n))) } : s));

export const removeStop = (list: StopInput[], i: number): StopInput[] =>
  list.filter((_, j) => j !== i);
