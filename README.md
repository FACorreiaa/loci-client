# Loci — the plan that knows what changed today

Every AI can write you an itinerary. Loci is the one that knows the museum is
shut for a public holiday, the transit strike is on, and what the trip actually
costs today — and then keeps the plan when the chat is gone.

Web client for the Loci API. SolidStart on Vinxi, deployed to Cloudflare
Workers. See `DESIGN.md` for the design system, `docs/UI_AUDIT_2026-09.md` for
the current state of the interface, and the workspace `README.md` for how the
repositories fit together.

## Getting started

```bash
pnpm install
pnpm dev          # dev server
pnpm test         # unit tests
pnpm typecheck    # tsgo --noEmit
pnpm run lint     # oxlint
pnpm build        # production build
```

Copy `.env.example` to `.env` and point `VITE_CONNECT_BASE_URL` at a running
API. Analytics stays off until `VITE_POSTHOG_KEY` is set.

---

# **Loci** – Personalized City Discovery 🗺️✨

Loci is a smart, mobile-first web application delivering hyper-personalized city exploration recommendations based on user interests, time, location, and an evolving AI engine. It starts with an HTTP/REST API, utilizing WebSockets/SSE for real-time features.

## 🚀 Elevator Pitch & Core Features

Tired of generic city guides? loci learns your preferences (history, food, art, etc.) and combines them with your available time and location to suggest the perfect spots.

- **🧠 AI-Powered Personalization:** Recommendations adapt to explicit preferences and learned behavior.
- **🔍 Contextual Filtering:** Filter by distance, time, opening hours, interests, and soon, budget.
- **🗺 Interactive Map Integration:** Visualize recommendations and routes.
- **📌 Save & Organize:** Bookmark favorites and create lists/itineraries (enhanced in Premium).
- **📱 Mobile-First Design:** Optimized for on-the-go web browsing.

## 💰 Business Model & Monetization

Loci uses a **Freemium Model**:

- **Free Tier:** Core recommendations, basic filters, limited saves, non-intrusive ads.
- **Premium Tier (Subscription):** Enhanced/Advanced AI recommendations & filters (niche tags, cuisine, accessibility), unlimited saves, offline access, exclusive content, ad-free.

**Monetization Avenues:**

- Premium Subscriptions
- **Partnerships & Commissions:** Booking referrals (GetYourGuide, Booking.com, OpenTable), transparent featured listings, exclusive deals.
- **Future:** One-time purchases (guides), aggregated anonymized trend data.

## 🛠 Technology Stack & Design Choices

The stack prioritizes performance, personalization, SEO, and developer experience.

- **Backend:** **Go (Golang)** with **Chi/Gin Gonic**, **PostgreSQL + PostGIS** (for geospatial queries), `pgx` or `sqlc`.
  - _Rationale:_ Go for performance and concurrency; PostGIS for essential location features.
- **Frontend:** **SvelteKit** _or_ **Next.js (React)** with **Tailwind CSS**, **Mapbox GL JS/MapLibre GL JS/Leaflet**.
  - _Rationale:_ Modern SSR frameworks for SEO and performance.
- **AI / Recommendation Engine:**

Direct Google Gemini API integration via `google/generative-ai-go` SDK.** \* *Rationale:* Leverage latest models (e.g., Gemini 1.5 Pro) for deep personalization via rich prompts and function calling to access PostgreSQL data (e.g., nearby POIs from PostGIS). \* **Vector Embeddings:\*\* PostgreSQL with `pgvector` extension for semantic search and advanced recommendations.

- **API Layer:** Primary **HTTP/REST API**.
  - _Rationale:_ Simplicity for frontend integration and broad compatibility. gRPC considered for future backend-to-backend needs.
- **Authentication:** Standard JWT + `Goth` package for social logins.
- **Infrastructure:** Docker, Docker Compose; Cloud (AWS/GCP/Azure for managed services like Postgres, Kubernetes/Fargate/Cloud Run); CI/CD (GitHub Actions/GitLab CI).

## 🚀 Elevator Pitch

Tired of generic city guides? **WanderWise** learns what you love—be it history, food, art, nightlife, or hidden gems—and combines it with your available time and location to suggest the perfect spots, activities, and restaurants.

Whether you're a tourist on a tight schedule or a local looking for something new, discover your city like never before with hyper-personalized, intelligent recommendations.

---

## 🌟 Core Features

- **🧠 AI-Powered Personalization**  
  Recommendations adapt based on explicit user preferences and learned behavior over time.

- **🔍 Contextual Filtering**  
  Filters results by:
  - Distance / Location
  - Available Time (e.g., “things to do in the next 2 hours”)
  - Opening Hours
  - User Interests (e.g., "art", "foodie", "outdoors", "history")
  - Budget (coming soon)

- **🗺 Interactive Map Integration**  
  Visualize recommendations, your location, and potential routes.

- **📌 Save & Organize**  
  Bookmark favorites, create custom lists or simple itineraries (enhanced in Premium).

- **📱 Mobile-First Design**  
  Optimized for on-the-go browsing via web browser.

---

## 💰 Business Model & Monetization

### Freemium Model

- **Free Tier**:
  - Access to core recommendation engine
  - Basic preference filters
  - Limited saves/lists
  - Non-intrusive contextual ads

- **Premium Tier (Monthly/Annual Subscription)**:
  - Enhanced AI recommendations
  - Advanced filters (cuisine, accessibility, niche tags, specific hours)
  - Unlimited saves & lists
  - Offline access
  - Exclusive curated content & themed tours
  - Ad-free experience

### Partnerships & Commissions

- **Booking Referrals**  
  Earn commission via integrations with platforms like GetYourGuide, Booking.com, OpenTable, etc.

- **Featured Listings (Transparent)**  
  Local businesses can pay for premium visibility in relevant results.

- **Exclusive Deals**  
  Offer users special discounts via business partnerships (potentially Premium-only).

### Future Monetization Options

- One-time in-app purchases (premium guides, city packs)
- Aggregated anonymized trend data (for tourism boards, researchers)

## 🗺️ Roadmap Highlights

- **Phase 1 (MVP):** Core recommendation engine (Gemini-powered), user accounts, map view, itinerary personalisation.
- **Phase 2:** Premium tier, enhanced AI (embeddings, `pgvector`), add more gemini features like

* speech to text
* itinerary download to different formats (pdf/markdown)
* itinerary uploads
* 24/7 agent more personalised agent

reviews/ratings, booking partnerships.

- **Phase 3:** Multi-city expansion, curated content, native app exploration.

## 🧪 Getting Started

### Demo Credentials

For demo purposes, you can use the following hardcoded test credentials to login without requiring backend authentication (only works in development mode):

- **Email:** `test@email.com`
- **Password:** `test12345`

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 🤝 Contributing

> 🛠 _Contribution guidelines and code of conduct coming soon._

## 📄 License

> 📃 _License type to be defined (MIT, Apache 2.0, or Proprietary)._

---

s
