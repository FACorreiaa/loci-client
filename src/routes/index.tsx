import { Show } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { useAuth } from "~/contexts/AuthContext";
import LoggedInDashboard from "~/components/features/Dashboard/LoggedInDashboard";
import PublicLandingPage from "~/components/features/Home/PublicLandingPage";

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <>
      <Title>Loci — Explore cities with friends</Title>
      <Meta
        name="description"
        content="Plan a city trip in one sentence, walk it stop by stop, collect the places you've really been and see how you rank against your friends."
      />
      <Meta
        name="keywords"
        content="AI travel planner, personalized travel, trip planning, travel recommendations, itinerary planner, restaurant finder, travel discovery, AI travel assistant"
      />
      <Meta property="og:title" content="Loci — Explore cities with friends" />
      <Meta
        property="og:description"
        content="Plan a city trip in one sentence, walk it stop by stop, collect the places you've really been and see how you rank against your friends."
      />
      <Meta property="og:url" content="https://lociai.fyi" />
      <Meta name="twitter:title" content="Loci — Explore cities with friends" />
      <Meta
        name="twitter:description"
        content="Plan a city trip in one sentence, walk it stop by stop, collect the places you've really been and see how you rank against your friends."
      />
      <link rel="canonical" href="https://lociai.fyi" />

      {/* Structured Data - Organization */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Loci",
          url: "https://lociai.fyi",
          logo: "https://lociai.fyi/images/brand/icon-512.png",
          description:
            "City trip planner for exploring cities with friends: plan a trip, walk it and collect the places you've really been.",
          sameAs: ["https://twitter.com/loci"],
        })}
      </script>

      {/* Structured Data - WebSite with Search */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Loci",
          url: "https://lociai.fyi",
          description: "Explore cities with friends",
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: "https://lociai.fyi/discover?q={search_term_string}",
            },
            "query-input": "required name=search_term_string",
          },
        })}
      </script>

      {/* Structured Data - SoftwareApplication */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Loci - AI Travel Companion",
          applicationCategory: "TravelApplication",
          operatingSystem: "Web, iOS (beta), Android (coming soon)",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
          },
        })}
      </script>

      <Show
        when={!isLoading()}
        fallback={
          <div class="min-h-screen flex items-center justify-center">
            <div class="loci-card rounded-2xl p-6 text-center shadow-lg">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
              <p class="text-muted-foreground font-medium">Loading...</p>
            </div>
          </div>
        }
      >
        <Show when={isAuthenticated()} fallback={<PublicLandingPage />}>
          <LoggedInDashboard />
        </Show>
      </Show>
    </>
  );
}
