# Loci native design (SwiftUI + Jetpack Compose)

Implementation-ready parity guide for iOS and Android. Web SSOT: [DESIGN.md](../DESIGN.md).

Quality bar: **Flighty-class** motion and density, **Loci "Explore your way"** theme (obsidian / cream / signal coral, dark-first). Not flight-tracker UI, not purple AI chrome, not Expo defaults. Native chrome stays native: system tab bar, sheets and navigation, tinted coral.

---

## 1. Color tokens

HSL source matches web `src/styles/themes.css`; the sRGB below is that HSL
converted, so web and native render the same pixels. Dark is the flagship
appearance and what the app shows with nothing saved.

### Light

| Token             | HSL         | sRGB      | Use                          |
| ----------------- | ----------- | --------- | ---------------------------- |
| `background`      | 35 60% 96%  | `#FBF6EF` | Screen base (cream)          |
| `foreground`      | 214 25% 11% | `#151B23` | Primary text (ink)           |
| `card`            | 0 0% 100%   | `#FFFFFF` | Surfaces                     |
| `primary`         | 10 60% 45%  | `#B8452E` | Actions, selection; white label |
| `secondary`       | 35 40% 91%  | `#F1EADF` | Chips, inactive fills        |
| `muted`           | 35 41% 92%  | `#F3ECE2` | Subtle fills                 |
| `mutedForeground` | 215 12% 40% | `#5A6472` | Secondary text               |
| `accent`          | 12 87% 66%  | `#F47B5D` | Fills and marks only, never text |
| `lantern`         | 31 74% 35%  | `#9B5B17` | Discovery, in-season, achievements |
| `holo`            | 209 40% 41% | `#3F6A92` | Info, spatial data, routes   |
| `success`         | 150 59% 30% | `#1F7A4D` | Confirmations                |
| `destructive`     | 2 63% 43%   | `#B32D29` | Errors                       |
| `border`          | 34 30% 85%  | `#E4DACD` | 1px edges                    |

### Dark

| Token             | HSL         | sRGB      | Use                          |
| ----------------- | ----------- | --------- | ---------------------------- |
| `background`      | 215 26% 9%  | `#11161D` | Screen base (obsidian)       |
| `foreground`      | 37 45% 94%  | `#F7F1E9` | Primary text (cream)         |
| `card`            | 215 25% 14% | `#1B222D` | Surfaces (graphite)          |
| `primary`         | 12 87% 66%  | `#F47B5D` | Actions, selection; obsidian label |
| `secondary`       | 213 23% 18% | `#232D38` | Chips, raised fills (steel)  |
| `muted`           | 215 24% 15% | `#1D252F` | Subtle fills                 |
| `mutedForeground` | 213 12% 68% | `#A4ACB7` | Secondary text               |
| `accent`          | 19 90% 74%  | `#F8A781` | Peach highlight              |
| `lantern`         | 29 94% 74%  | `#FBBB7E` | Discovery, in-season, achievements |
| `holo`            | 212 37% 62% | `#7A9CC2` | Info, spatial data, routes   |
| `success`         | 150 43% 51% | `#4CB882` | Confirmations                |
| `destructive`     | 2 83% 65%   | `#F0615C` | Errors                       |
| `border`          | 214 21% 21% | `#2A3441` | 1px edges                    |

Brand gradient (the mark only, never text or button fills):
`#F9A47C → #F68667 → #E8735D → #D2645A → #C25A52`, top to bottom.

Bright coral is never text on a light ground (2.5:1 on cream). Hero bands and
the launch screen are obsidian in both appearances.

### Map day palette (itinerary pins + routes)

Same order as web `LOCI_DAY_COLORS` in `src/lib/theme-colors.ts`:

`#e2664a`, `#2f7d6e`, `#b07a2a`, `#7a5ca8`, `#4a7cb0`, `#8c6248`, `#5e8c3a`, `#a34f72`

Indexed as web does: `colors[day % 8]` with the server's 1-based day, so Day 1
is `#2f7d6e`; a list with no days is day 0, `#e2664a`.

Cluster color: `#AE3722` (web `LOCI_MAP_CLUSTER_COLOR`). Ungrouped: `#6e7a82` (web `LOCI_MAP_UNGROUPED_COLOR`).

---

## 2. Typography

| Role                  | Web        | iOS                                     | Android                               |
| --------------------- | ---------- | --------------------------------------- | ------------------------------------- |
| Display / brand       | Outfit     | `Font.custom("Outfit", …)`, bundled TTF | `FontFamily(Font(R.font.outfit))`     |
| UI body               | DM Sans    | DM Sans                                 | `FontFamily(Font(R.font.dm_sans))`    |
| Coords / seq / status | Space Mono | Space Mono                              | `FontFamily(Font(R.font.space_mono))` |

Outfit is OFL (vendored with its licence in `tools/brand/fonts/`). It replaces
Fraunces: its rounded geometry is the wordmark's.

### Scale (iOS Dynamic Type / Compose `sp`)

| Style      | Size  | Weight   | Font                           |
| ---------- | ----- | -------- | ------------------------------ |
| `display`  | 34–40 | Semibold | Outfit                         |
| `title`    | 22–28 | Semibold | Outfit                         |
| `headline` | 17–20 | Medium   | DM Sans                        |
| `body`     | 15–17 | Regular  | DM Sans                        |
| `caption`  | 12–13 | Regular  | DM Sans                        |
| `coord`    | 10–11 | Medium   | Space Mono, uppercase tracking |

---

## 3. Spacing & radius

| Token          | Value                      |
| -------------- | -------------------------- |
| `radius`       | 12.8pt / 12.8dp (`0.8rem`) |
| `radiusHero`   | 14.4pt                     |
| Min tap target | 44×44                      |
| Screen padding | 16 mobile / 24 tablet      |
| Card padding   | 16–20                      |

Elevation: **flat + 1px border**. Shadow only for floating island panels and nav.

---

## 4. Motion

| Name              | Duration | Curve                                | Use                |
| ----------------- | -------- | ------------------------------------ | ------------------ |
| `resultArrive`    | 400ms    | ease-out (0.16, 1, 0.3, 1)           | List/card stagger  |
| `selectionSettle` | 250ms    | ease-out (0.22, 1, 0.36, 1)          | Map↔list selection |
| `routeDraw`       | 800ms    | linear opacity                       | Route line appear  |
| `sheetPresent`    | 320ms    | spring (iOS) / `FastOutSlowInEasing` | Bottom sheet, chat |
| `mascotIdle`      | 4s loop  | ease-in-out, 2pt bob                 | Mascot on empty/welcome |
| `press`           | 150ms    | scale 0.98                           | Buttons, cards     |

**Reduce Motion:** disable stagger, route draw, scale press and the mascot bob; keep opacity fades ≤200ms.

### iOS

- SwiftUI: `.animation(.spring(response: 0.35, dampingFraction: 0.86), value:)` for selection
- UIKit haptics: `.light` on pin select, `.medium` on add-to-trip

### Android

- Compose: `animateFloatAsState`, `AnimatedVisibility`, `Modifier.graphicsLayer { scaleX/scaleY }`
- `HapticFeedbackConstants.KEYBOARD_TAP` on selection

---

## 5. Component catalog

### Tab bar / primary nav

- Four journeys: Discover, Nearby, Trips, Ask Loci
- Active: `secondary` fill + `foreground` label
- iOS: `TabView` or custom tab bar; Android: `NavigationBar` (Material 3, **not** default purple — theme `LociTheme`)

### Field card (`LociCard`)

- Background `card`, border `border`, radius `radius`
- Interactive: border darkens to `primary/35` on press; no nested shadows

### Stop card

- Seq number in Space Mono circle (terracotta border)
- Title Fraunces; category DM Sans caption
- Trust chip below description

### Chat bubble vs embed

- **User:** compact `primary` bubble
- **Assistant text:** flat `card` bubble
- **Structured results:** full-width `LociCard` **outside** bubble (itinerary stream, POI lists)

### Composer

- Flat top border; textarea + primary send button (44dp)
- Stop button replaces send while streaming

### Map pin + route

- Circle marker, white stroke, day color fill, Space Mono label
- Selected: stroke 4pt, radius +4
- Route: dashed line, day color, `routeDraw` opacity

### Trust chip

- Border `primary/20`, fill `primary/5`, Sparkles icon, “Why this:” label

### Empty / error

- Where the moment earns it (saved, trips, lists, recents, no results, offline, error): the mascot in its state pose, decorative (hidden from VoiceOver/TalkBack — the title says what happened)
- Everywhere else: centered icon (Lucide → SF Symbol / Material icon map)
- Outfit title + DM Sans subtitle; single primary CTA

### Upgrade prompt

- Flat card, accent border, no gradient hero

---

## 6. Screen map

| Screen       | Composition                                                                  |
| ------------ | ---------------------------------------------------------------------------- |
| **Discover** | Search hero + category grid + result cards (list-first); optional map later  |
| **Nearby**   | **Map hero** default; bottom/side sheet for POI list                         |
| **Trips**    | Route cards grid; editor = day/stop list (map v2 when stop coords available) |
| **Ask Loci** | Full-screen chat; structured embeds as cards                                 |
| **Settings** | Field kit sections in `LociCard` stacks                                      |

Floating web chat FAB → native **bottom sheet** or dedicated tab (prefer tab for parity with primary nav).

---

## 7. Libraries to add

### iOS (SwiftUI)

| Package                             | Purpose                                                       |
| ----------------------------------- | ------------------------------------------------------------- |
| Mapbox Maps SDK (`mapbox-maps-ios`) | Branded basemap + GeoJSON layers (matches web)                |
| — or MapKit                         | Lighter v1 if Mapbox key sharing is awkward                   |
| —                                   | Embed Fraunces, DM Sans, Space Mono (Google Fonts or bundled) |
| —                                   | SF Symbols mapped from Lucide semantics (see parity table)    |

Architecture: `NavigationStack`, `.sheet` for detail, `@Observable` view models, Connect Swift client for API.

### Android (Jetpack Compose)

| Dependency                | Purpose                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| `com.mapbox.maps:android` | Map parity with web                                                  |
| Material 3                | Themed with Loci colors (`ColorScheme` override — no dynamic purple) |
| Navigation Compose        | Primary journeys                                                     |
| Compose Animation         | Motion tokens                                                        |

---

## 8. Icon parity (Lucide → native)

| Lucide        | SF Symbol                      | Material      |
| ------------- | ------------------------------ | ------------- |
| Compass       | `safari`                       | `Explore`     |
| MapPin        | `mappin.and.ellipse`           | `Place`       |
| Map           | `map`                          | `Map`         |
| MessageCircle | `bubble.left.and.bubble.right` | `Chat`        |
| Utensils      | `fork.knife`                   | `Restaurant`  |
| Bed           | `bed.double`                   | `Hotel`       |
| Sparkles      | `sparkles`                     | `AutoAwesome` |
| Heart         | `heart`                        | `Favorite`    |
| Navigation    | `location.north`               | `Navigation`  |

---

## 9. Parity checklist

| Web surface                  | iOS                    | Android                     | Notes              |
| ---------------------------- | ---------------------- | --------------------------- | ------------------ |
| Design tokens (`themes.css`) | `LociColors.swift`     | `LociTheme.kt`              | §1                 |
| Motion tokens                | `LociMotion.swift`     | `LociMotion.kt`             | §4                 |
| `Map.tsx` pins/routes        | Mapbox layers          | Mapbox layers               | Day colors §1      |
| `SplitView`                  | Map + sheet            | Map + `BottomSheetScaffold` | Map default Nearby |
| `ChatMessage` + embeds       | Bubble + card stack    | Same                        | No nested blur     |
| `ItineraryStreamView`        | Stop list + phase rail | Same                        | Reuse stop card    |
| `WhyThisStop`                | Trust chip             | Trust chip                  |                    |
| `Discover` cards             | Field card + stagger   | Same                        |                    |
| `Nav` / tab bar              | TabView                | NavigationBar               | Four journeys      |
| Auth                         | `SignIn` layout        | Same                        | Flat inputs        |
| Settings field kit           | Section cards          | Same                        |                    |
| PWA / FAB chat               | **Sheet or tab**       | **Sheet or tab**            | No web FAB clone   |

---

## 10. Out of scope (native v1)

- SolidStart / PWA install chrome
- Web-only `FloatingChat` FAB shape (use platform sheet)
- Flighty flight-specific UI (gates, delays, airplane motifs)
- Expo / React Native shared UI layer

---

## 11. Implementation order

1. Color + type theme objects
2. `LociCard`, trust chip, tab bar
3. Map pins + list sheet (Nearby)
4. Chat bubbles + itinerary embeds
5. Discover + Trips lists
6. Settings + auth

Validate against web screenshots on each milestone; run Reduce Motion QA on iOS Simulator + Android emulator.
