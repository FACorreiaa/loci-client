# Product

<!--
Drafted 2026-10-30 by the impeccable audit from DESIGN.md, README.md and the
codebase, without an interview. Everything here is inferred; correct anything
that reads wrong and delete this note.
-->

## Register

product

## Users

Travellers planning or walking a city trip, usually on a phone, often outdoors
and often with one hand. Two moments matter: the evening before (planning,
comparing cities, inviting friends to a trip) and the moment itself (what is
nearby, is it open today, what is the next stop). A second audience is agents:
Claude, Codex and other MCP clients call the same API through the `/mcp` setup
flow, so the web app must also explain and hand off to that path.

Fluent in Google Maps, Airbnb and Flighty. They expect map-first interfaces,
instant search, and will not tolerate a chat box that forgets the plan.

## Product Purpose

Loci turns one sentence into a trip that knows what changed today: holiday
closures, strikes, real prices. It keeps the plan after the chat is gone,
lets friends plan together, and records the places you actually went.
Success is a stranger planning a trip, walking it, and coming back for the
next one. The public landing page already executes the design system; the
work is making every signed-in surface look and behave like it.

## Brand Personality

Observant, grounded, useful. A field guide, not a dashboard. Cream ground,
slate ink, coral mark; Fraunces for destinations, DM Sans for interface,
Space Mono for coordinates, day numbers and status. Calm density, motion only
for state, map as a living surface.

## Anti-references

- Purple-on-white or indigo "AI dashboard" chrome, gradient text, glass stacks.
- Mapbox default blue clusters and rainbow itinerary pins.
- Emoji as navigation, in quick prompts, badges or map popups.
- Generic shadcn / zinc defaults on product screens (the drift the 2026-09
  audit named).
- Two chat qualities: a rich `/chat` and a plain floating widget.
- Fake metrics, fabricated ratings, "coming soon" strips without a date.

## Design Principles

1. **The plan outlives the chat.** Every result lands in a durable, editable
   surface; chat is an input, never the only record.
2. **Say why.** Each recommendation carries its rationale, freshness and
   trust signal next to the recommendation, not in a tooltip.
3. **Earned familiarity.** Standard product affordances (nav, tabs, forms,
   sheets) in Loci's materials. Surprise is spent on the map, not on
   controls.
4. **Readable outdoors.** Contrast and touch targets are measured, not
   assumed; opacity-faded text is a bug.
5. **One visual language, every route.** If a control looks different on two
   screens, one of them is wrong.

## Accessibility & Inclusion

WCAG 2.2 AA as the floor: 4.5:1 for body text in both appearances, 3:1 for
control boundaries, 44 px touch targets on mobile, visible `:focus-visible`,
labels bound to every input, reduced-motion alternatives for every
animation. Light, dark and system appearance are modes of one theme and are
both verified. Lighthouse CI already asserts accessibility 1.0 on the public
routes; the same bar applies behind sign-in.
