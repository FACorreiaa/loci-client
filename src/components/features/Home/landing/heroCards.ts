/**
 * Everything on the hero's card wall, in one place. Edit freely: the wall
 * reads `frontRow` / `backRow` left to right, and each entry names a card in
 * `heroCards`. Keep neighbours different kinds/tones so the wall doesn't band.
 *
 * Coordinates are the places' real ones (rounded to 4 dp).
 */

export type Tone = "paper" | "ink" | "coral";

export type HeroCard =
  | {
      kind: "place";
      tone: Tone;
      stamp: string;
      name: string;
      city: string;
      coords: string;
      route: string;
      chip?: string;
    }
  | {
      kind: "plan";
      tone: Tone;
      title: string;
      stops: { time: string; name: string }[];
      chip?: string;
    }
  | {
      kind: "tally";
      tone: Tone;
      title: string;
      rows: { who: string; places: number }[];
    }
  | { kind: "shot"; src: string };

export const heroCards = {
  graca: {
    kind: "place",
    tone: "paper",
    stamp: "Viewpoint",
    name: "Miradouro da Graça",
    city: "Lisbon",
    coords: "38.7163° N · 9.1316° W",
    route: "3 stops · 1.8 km",
    chip: "Sunset 19:42",
  },
  brasileira: {
    kind: "place",
    tone: "ink",
    stamp: "Coffee",
    name: "Café A Brasileira",
    city: "Lisbon",
    coords: "38.7107° N · 9.1426° W",
    route: "4 stops · 2.4 km",
    chip: "Rain at 4pm → indoor swap",
  },
  tsukiji: {
    kind: "place",
    tone: "paper",
    stamp: "Market",
    name: "Tsukiji Outer Market",
    city: "Tokyo",
    coords: "35.6655° N · 139.7707° E",
    route: "5 stops · 3.2 km",
    chip: "Busy 10–12 · go early",
  },
  guell: {
    kind: "place",
    tone: "coral",
    stamp: "Park",
    name: "Park Güell",
    city: "Barcelona",
    coords: "41.4145° N · 2.1527° E",
    route: "3 stops · 1.8 km",
    chip: "Holiday Fri · book ahead",
  },
  bolhao: {
    kind: "place",
    tone: "paper",
    stamp: "Market",
    name: "Mercado do Bolhão",
    city: "Porto",
    coords: "41.1488° N · 8.6060° W",
    route: "2 stops · 900 m",
  },
  inari: {
    kind: "place",
    tone: "ink",
    stamp: "Temple",
    name: "Fushimi Inari Taisha",
    city: "Kyoto",
    coords: "34.9671° N · 135.7727° E",
    route: "4 stops · 2.9 km",
    chip: "Rain at 2pm → tea house",
  },
  lello: {
    kind: "place",
    tone: "paper",
    stamp: "Books",
    name: "Livraria Lello",
    city: "Porto",
    coords: "41.1469° N · 8.6148° W",
    route: "3 stops · 1.2 km",
  },
  arabica: {
    kind: "place",
    tone: "coral",
    stamp: "Coffee",
    name: "% Arabica Arashiyama",
    city: "Kyoto",
    coords: "35.0137° N · 135.6766° E",
    route: "2 stops · 1.1 km",
  },
  orangerie: {
    kind: "place",
    tone: "paper",
    stamp: "Museum",
    name: "Musée de l'Orangerie",
    city: "Paris",
    coords: "48.8638° N · 2.3226° E",
    route: "4 stops · 2.2 km",
    chip: "Closed Tue → moved to Wed",
  },
  se: {
    kind: "place",
    tone: "ink",
    stamp: "Cathedral",
    name: "Sé de Braga",
    city: "Braga",
    coords: "41.5499° N · 8.4271° W",
    route: "3 stops · 1.4 km",
  },
  portoDay: {
    kind: "plan",
    tone: "paper",
    title: "Porto · day 1",
    stops: [
      { time: "09:30", name: "Bolhão" },
      { time: "11:00", name: "Lello" },
      { time: "13:00", name: "Ribeira" },
      { time: "18:40", name: "Ponte Luís I" },
    ],
    chip: "Wine · 4 stops",
  },
  kyotoDay: {
    kind: "plan",
    tone: "ink",
    title: "Kyoto · temples + coffee",
    stops: [
      { time: "07:00", name: "Fushimi Inari" },
      { time: "10:30", name: "% Arabica" },
      { time: "14:00", name: "Kiyomizu-dera" },
    ],
    chip: "Rain at 4pm → indoor swap",
  },
  week: {
    kind: "tally",
    tone: "coral",
    title: "This week",
    rows: [
      { who: "Ana", places: 14 },
      { who: "Rui", places: 11 },
      { who: "You", places: 9 },
    ],
  },
  crew: {
    kind: "tally",
    tone: "paper",
    title: "Lisbon crew",
    rows: [
      { who: "Marta", places: 22 },
      { who: "You", places: 17 },
      { who: "Tiago", places: 12 },
    ],
  },
  plan: { kind: "shot", src: "/images/hero/01-plan.webp" },
  dodge: { kind: "shot", src: "/images/hero/02-dodge.webp" },
  walk: { kind: "shot", src: "/images/hero/03-walk.webp" },
  compare: { kind: "shot", src: "/images/hero/04-compare.webp" },
} satisfies Record<string, HeroCard>;

export type HeroCardId = keyof typeof heroCards;

/** 15 cards, 0% → 100%. Indices 0, 4, 7, 10, 14 always show (mobile). */
export const frontRow: HeroCardId[] = [
  "graca",
  "portoDay",
  "tsukiji",
  "week",
  "dodge",
  "lello",
  "inari",
  "brasileira",
  "crew",
  "guell",
  "plan",
  "orangerie",
  "kyotoDay",
  "bolhao",
  "arabica",
];

/** 14 cards, md+ only, behind the front row. */
export const backRow: HeroCardId[] = [
  "se",
  "brasileira",
  "walk",
  "guell",
  "kyotoDay",
  "bolhao",
  "crew",
  "graca",
  "inari",
  "compare",
  "orangerie",
  "week",
  "tsukiji",
  "lello",
];
