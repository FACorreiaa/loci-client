# Loci native design (SwiftUI + Jetpack Compose)

Implementation-ready parity guide for iOS and Android. Web SSOT: [DESIGN.md](../DESIGN.md).

Quality bar: **Flighty-class** motion and density, **Loci field-guide** theme (parchment / forest / sage / terracotta). Not flight-tracker UI, not purple AI chrome, not Expo defaults.

---

## 1. Color tokens

HSL source matches web `themes.css`. Use sRGB in native.

### Light

| Token             | HSL         | sRGB (approx) | Use                   |
| ----------------- | ----------- | ------------- | --------------------- |
| `background`      | 43 38% 94%  | `#F5F0E6`     | Screen base           |
| `foreground`      | 157 28% 14% | `#1A2E26`     | Primary text          |
| `card`            | 42 44% 98%  | `#FDFBF7`     | Surfaces              |
| `primary`         | 157 35% 20% | `#214D3C`     | Actions, map clusters |
| `secondary`       | 91 18% 84%  | `#D8E0D0`     | Chips, inactive tabs  |
| `muted`           | 40 23% 88%  | `#E8E2D6`     | Subtle fills          |
| `mutedForeground` | 151 10% 39% | `#5A6B62`     | Secondary text        |
| `accent`          | 16 52% 48%  | `#C76B4A`     | Map marks, CTAs       |
| `border`          | 42 18% 75%  | `#CFC5B5`     | 1px edges             |
| `destructive`     | 2 58% 44%   | `#B33A32`     | Errors                |

### Dark

| Token        | HSL         | sRGB (approx) |
| ------------ | ----------- | ------------- |
| `background` | 157 22% 8%  | `#101A16`     |
| `foreground` | 42 30% 91%  | `#EDE8DC`     |
| `card`       | 157 20% 11% | `#162019`     |
| `primary`    | 88 21% 68%  | `#A8B896`     |
| `accent`     | 20 60% 61%  | `#D4845C`     |
| `border`     | 154 12% 25% | `#384840`     |

### Map day palette (itinerary pins + routes)

Same order as web `LOCI_DAY_COLORS` in `src/lib/theme-colors.ts`:

`#e2664a`, `#2f7d6e`, `#b07a2a`, `#7a5ca8`, `#4a7cb0`, `#8c6248`, `#5e8c3a`, `#a34f72`

Indexed as web does: `colors[day % 8]` with the server's 1-based day, so Day 1
is `#2f7d6e`; a list with no days is day 0, `#e2664a`.

Cluster color: `#294d3c`. Ungrouped: `#6e7a82` (web `LOCI_MAP_UNGROUPED_COLOR`).

---

## 2. Typography

| Role                  | Web        | iOS                                                       | Android                               |
| --------------------- | ---------- | --------------------------------------------------------- | ------------------------------------- |
| Destination headlines | Fraunces   | `Font.custom("Fraunces", …)` or Fraunces via Google Fonts | `FontFamily(Font(R.font.fraunces))`   |
| UI body               | DM Sans    | DM Sans                                                   | `FontFamily(Font(R.font.dm_sans))`    |
| Coords / seq / status | Space Mono | Space Mono                                                | `FontFamily(Font(R.font.space_mono))` |

### Scale (iOS Dynamic Type / Compose `sp`)

| Style      | Size  | Weight   | Font                           |
| ---------- | ----- | -------- | ------------------------------ |
| `display`  | 34–40 | Semibold | Fraunces                       |
| `title`    | 22–28 | Semibold | Fraunces                       |
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
| `sheetPresent`    | 300ms    | spring (iOS) / `FastOutSlowInEasing` | Bottom sheet, chat |
| `press`           | 150ms    | scale 0.98                           | Buttons, cards     |

**Reduce Motion:** disable stagger, route draw, scale press; keep opacity fades ≤200ms.

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

- Centered icon (Lucide → SF Symbol / Material icon map)
- Fraunces title + DM Sans subtitle; single primary CTA

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
