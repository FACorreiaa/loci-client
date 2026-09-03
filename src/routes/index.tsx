import { Show } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { useAuth } from "~/contexts/AuthContext";
import LoggedInDashboard from "~/components/features/Dashboard/LoggedInDashboard";
import PublicLandingPage from "~/components/features/Home/PublicLandingPage";

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <>
      <Title>Loci - AI-Powered Travel Discovery & Personalized Recommendations</Title>
      <Meta
        name="description"
        content="Discover your perfect travel experiences with Loci's AI-powered recommendations. Get personalized itineraries, restaurant suggestions, and activities tailored to your preferences."
      />
      <Meta
        name="keywords"
        content="AI travel planner, personalized travel, trip planning, travel recommendations, itinerary planner, restaurant finder, travel discovery, AI travel assistant"
      />
      <Meta property="og:title" content="Loci - AI-Powered Travel Discovery" />
      <Meta
        property="og:description"
        content="Discover your perfect travel experiences with AI-powered, personalized recommendations for itineraries, restaurants, and activities."
      />
      <Meta property="og:url" content="https://loci.app" />
      <Meta name="twitter:title" content="Loci - AI-Powered Travel Discovery" />
      <Meta
        name="twitter:description"
        content="Discover your perfect travel experiences with AI-powered, personalized recommendations."
      />
      <link rel="canonical" href="https://loci.app" />

      {/* Structured Data - Organization */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Loci",
          url: "https://loci.app",
          logo: "https://loci.app/images/loci.png",
          description:
            "AI-powered travel discovery platform delivering hyper-personalized city exploration recommendations",
          sameAs: ["https://twitter.com/loci"],
        })}
      </script>

      {/* Structured Data - WebSite with Search */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Loci",
          url: "https://loci.app",
          description: "AI-Powered Travel Discovery & Personalized Recommendations",
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: "https://loci.app/discover?q={search_term_string}",
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
          operatingSystem: "Web, iOS (coming soon), Android (coming soon)",
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
