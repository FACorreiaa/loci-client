import { For } from "solid-js";
import { A } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import {
  Brain,
  MapPin,
  Filter,
  Heart,
  List,
  Clock,
  Smartphone,
  Zap,
  Globe,
  Users,
  Search,
  Database,
} from "lucide-solid";

export default function Features() {
  const features = [
    {
      icon: Search,
      title: "Intelligent Semantic Search",
      description:
        "Experience the power of natural language understanding with our state-of-the-art semantic search that comprehends your intent and delivers contextually relevant recommendations.",
      details: [
        "Understands natural language queries",
        "Provides contextually relevant results",
        "Powered by pgvector embeddings",
        "Delivers intelligent recommendations beyond keyword matching",
      ],
    },
    {
      icon: Brain,
      title: "AI-Powered Personalization",
      description:
        "Our advanced AI learns your preferences and adapts recommendations based on your interests, past choices, and behavior patterns.",
      details: [
        "Learns from your explicit preferences",
        "Adapts to your behavior over time",
        "Powered by Google Gemini AI",
        "Gets smarter with every interaction",
      ],
    },
    {
      icon: Filter,
      title: "Contextual Filtering",
      description:
        "Filter recommendations by distance, available time, opening hours, interests, and soon budget to find exactly what fits your needs.",
      details: [
        "Distance & location-based filtering",
        "Time-aware suggestions",
        "Opening hours integration",
        "Interest-based categorization",
        "Budget filtering (coming soon)",
      ],
    },
    {
      icon: MapPin,
      title: "Interactive Map Integration",
      description:
        "Visualize all recommendations on an interactive map with routes, directions, and real-time location tracking.",
      details: [
        "Interactive map visualization",
        "Route planning and directions",
        "Real-time location tracking",
        "Geospatial intelligence with PostGIS",
      ],
    },
    {
      icon: Heart,
      title: "Save & Organize",
      description:
        "Bookmark your favorite places, create custom lists, and build personalized itineraries for future visits.",
      details: [
        "Bookmark favorite locations",
        "Create custom lists",
        "Build personalized itineraries",
        "Enhanced organization in Premium",
      ],
    },
    {
      icon: Smartphone,
      title: "Mobile-First Design",
      description:
        "Optimized for on-the-go exploration with a responsive design that works perfectly on any device.",
      details: [
        "Mobile-optimized interface",
        "Progressive Web App (PWA)",
        "Offline access (Premium)",
        "Cross-platform compatibility",
      ],
    },
    {
      icon: Clock,
      title: "Time-Aware Recommendations",
      description:
        "Get suggestions based on your available time, whether you have 30 minutes or a full day to explore.",
      details: [
        "Duration-based filtering",
        "Quick activities for short breaks",
        "Full-day itinerary planning",
        "Real-time availability updates",
      ],
    },
    {
      icon: Database,
      title: "Smart Memory System",
      description:
        "Our AI remembers your conversations and preferences, building a personalized knowledge base that gets smarter over time.",
      details: [
        "Remembers your chat history and preferences",
        "Learns from your interactions",
        "Provides contextual recommendations",
        "Builds a personalized travel profile",
      ],
    },
  ];

  const searchCapabilities = [
    {
      icon: Globe,
      title: "Cities & Destinations",
      description:
        "Discover new cities and explore destinations with AI-curated recommendations tailored to your interests.",
    },
    {
      icon: Users,
      title: "Restaurants & Dining",
      description:
        "Find the perfect dining experiences from local hidden gems to acclaimed establishments, filtered by cuisine and preferences.",
    },
    {
      icon: MapPin,
      title: "Hotels & Accommodation",
      description:
        "Search and discover hotels, boutique stays, and unique accommodations that match your travel style and budget.",
    },
    {
      icon: Zap,
      title: "Activities & Attractions",
      description:
        "Uncover activities, attractions, and experiences that align with your interests, from museums to outdoor adventures.",
    },
  ];

  return (
    <>
      <Title>Features - AI-Powered Travel Discovery & Personalization | Loci</Title>
      <Meta
        name="description"
        content="Discover Loci's powerful features: AI-powered personalization, semantic search, contextual filtering, interactive maps, smart memory, and time-aware recommendations for perfect travel experiences."
      />
      <Meta
        name="keywords"
        content="AI travel features, semantic search, personalized recommendations, interactive maps, smart memory, contextual filtering, travel technology, AI itinerary planning"
      />
      <Meta property="og:title" content="Features - AI-Powered Travel Discovery | Loci" />
      <Meta
        property="og:description"
        content="Explore Loci's advanced features: AI personalization, semantic search, smart memory, and time-aware recommendations for intelligent travel planning."
      />
      <Meta property="og:url" content="https://loci.app/features" />
      <Meta name="twitter:title" content="Features - AI-Powered Travel Discovery | Loci" />
      <Meta
        name="twitter:description"
        content="AI personalization, semantic search, smart memory, and contextual understanding for your perfect travel experience."
      />
      <link rel="canonical" href="https://loci.app/features" />

      <div class="min-h-screen bg-background text-foreground transition-colors">
        <div class="max-w-6xl mx-auto px-4 py-12 space-y-12">
          {/* Hero Section */}
          <header class="text-center">
            <div class="rounded-3xl bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 border border-border shadow-lg p-10">
              <p class="text-sm uppercase tracking-[0.2em] text-accent mb-3">Features</p>
              <h1 class="text-4xl md:text-6xl font-bold text-foreground mb-4">
                AI-powered travel.
              </h1>
              <p class="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                Discover what makes Loci the smartest way to explore cities. We aim for WCAG AA/AAA
                contrast in both Light (Latte) and Dark mode so it stays readable everywhere.
              </p>
            </div>
          </header>

          {/* Core Features Grid */}
          <section class="mb-20" aria-labelledby="core-features">
            <h2 id="core-features" class="text-3xl font-bold text-foreground text-center mb-12">
              Core Features
            </h2>
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8" role="list">
              <For each={features}>
                {(feature, index) => {
                  const IconComponent = feature.icon;
                  return (
                    <article
                      class="bg-card border border-border rounded-lg p-6 shadow-lg hover:shadow-xl transition-all duration-300 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                      role="listitem"
                      aria-labelledby={`feature-${index()}`}
                    >
                      <div class="flex items-center mb-4">
                        <div class="bg-primary/10 p-3 rounded-lg mr-4" aria-hidden="true">
                          <IconComponent class="w-6 h-6 text-primary" />
                        </div>
                        <h3
                          id={`feature-${index()}`}
                          class="text-xl font-semibold text-card-foreground"
                        >
                          {feature.title}
                        </h3>
                      </div>
                      <p class="text-muted-foreground mb-4 leading-relaxed">
                        {feature.description}
                      </p>
                      <ul class="space-y-2" role="list">
                        <For each={feature.details}>
                          {(detail) => (
                            <li
                              class="flex items-center text-sm text-muted-foreground"
                              role="listitem"
                            >
                              <div
                                class="w-1.5 h-1.5 bg-primary rounded-full mr-2"
                                aria-hidden="true"
                              />
                              {detail}
                            </li>
                          )}
                        </For>
                      </ul>
                    </article>
                  );
                }}
              </For>
            </div>
          </section>

          {/* Search Capabilities */}
          <section class="mb-20" aria-labelledby="search-capabilities">
            <h2
              id="search-capabilities"
              class="text-3xl font-bold text-foreground text-center mb-12"
            >
              What You Can Discover
            </h2>
            <div class="grid md:grid-cols-2 gap-8" role="list">
              <For each={searchCapabilities}>
                {(capability, index) => {
                  const IconComponent = capability.icon;
                  return (
                    <article
                      class="loci-card p-6"
                      role="listitem"
                      aria-labelledby={`capability-${index()}`}
                    >
                      <div class="flex items-center mb-4">
                        <div class="bg-background p-3 rounded-lg mr-4 shadow-md" aria-hidden="true">
                          <IconComponent class="w-6 h-6 text-primary" />
                        </div>
                        <h3
                          id={`capability-${index()}`}
                          class="text-xl font-semibold text-foreground"
                        >
                          {capability.title}
                        </h3>
                      </div>
                      <p class="text-foreground/80 leading-relaxed">{capability.description}</p>
                    </article>
                  );
                }}
              </For>
            </div>
          </section>

          {/* AI Capabilities */}
          <section class="loci-card p-8 mb-20" aria-labelledby="ai-capabilities">
            <div class="text-center mb-8">
              <h2 id="ai-capabilities" class="text-3xl font-bold mb-4 text-foreground">
                AI-Generated Itineraries
              </h2>
              <p class="text-lg text-muted-foreground max-w-3xl mx-auto">
                Let our advanced AI create personalized itineraries based on your interests,
                available time, and location. From quick lunch breaks to full-day adventures.
              </p>
            </div>
            <div class="grid md:grid-cols-3 gap-6" role="list">
              <div class="text-center" role="listitem">
                <div
                  class="bg-muted/70 rounded-lg p-4 mb-4 shadow-md border border-border"
                  aria-hidden="true"
                >
                  <Clock class="w-8 h-8 mx-auto text-primary" />
                </div>
                <h3 class="font-semibold mb-2 text-foreground">Time-Optimized</h3>
                <p class="text-sm text-muted-foreground">Perfect timing for every activity</p>
              </div>
              <div class="text-center" role="listitem">
                <div
                  class="bg-muted/70 rounded-lg p-4 mb-4 shadow-md border border-border"
                  aria-hidden="true"
                >
                  <Brain class="w-8 h-8 mx-auto text-primary" />
                </div>
                <h3 class="font-semibold mb-2 text-foreground">Personalized</h3>
                <p class="text-sm text-muted-foreground">Tailored to your unique interests</p>
              </div>
              <div class="text-center" role="listitem">
                <div
                  class="bg-muted/70 rounded-lg p-4 mb-4 shadow-md border border-border"
                  aria-hidden="true"
                >
                  <MapPin class="w-8 h-8 mx-auto text-primary" />
                </div>
                <h3 class="font-semibold mb-2 text-foreground">Location-Aware</h3>
                <p class="text-sm text-muted-foreground">Optimized routes and distances</p>
              </div>
            </div>
          </section>

          {/* Smart Memory & RAG Section */}
          <section class="loci-card p-8 mb-20" aria-labelledby="smart-memory">
            <div class="text-center mb-8">
              <h2 id="smart-memory" class="text-3xl font-bold text-foreground mb-4">
                Smart Memory & Contextual Understanding
              </h2>
              <p class="text-lg text-muted-foreground max-w-4xl mx-auto">
                Our AI doesn't just answer your questions - it remembers your conversations and
                builds a personalized knowledge base that gets smarter with every interaction.
              </p>
            </div>
            <div class="grid md:grid-cols-2 gap-8" role="list">
              <div class="bg-card rounded-lg p-6 border border-border" role="listitem">
                <div class="flex items-center mb-4">
                  <div class="bg-accent/10 p-3 rounded-lg mr-4" aria-hidden="true">
                    <Database class="w-6 h-6 text-accent" />
                  </div>
                  <h3 class="text-xl font-semibold text-card-foreground">Conversation Memory</h3>
                </div>
                <p class="text-muted-foreground mb-4">
                  Unlike traditional chatbots that forget your previous messages, Loci remembers
                  your entire conversation history. Ask follow-up questions, reference earlier
                  discussions, and build on previous recommendations naturally.
                </p>
                <ul class="space-y-2" role="list">
                  <li class="flex items-center text-sm text-muted-foreground">
                    <div class="w-1.5 h-1.5 bg-accent rounded-full mr-2" aria-hidden="true" />
                    Remembers your preferences from past conversations
                  </li>
                  <li class="flex items-center text-sm text-muted-foreground">
                    <div class="w-1.5 h-1.5 bg-accent rounded-full mr-2" aria-hidden="true" />
                    Understands context from previous interactions
                  </li>
                  <li class="flex items-center text-sm text-muted-foreground">
                    <div class="w-1.5 h-1.5 bg-accent rounded-full mr-2" aria-hidden="true" />
                    Builds a personalized knowledge base over time
                  </li>
                </ul>
              </div>
              <div class="bg-card rounded-lg p-6 border border-border" role="listitem">
                <div class="flex items-center mb-4">
                  <div class="bg-primary/10 p-3 rounded-lg mr-4" aria-hidden="true">
                    <Search class="w-6 h-6 text-primary" />
                  </div>
                  <h3 class="text-xl font-semibold text-card-foreground">Intelligent Retrieval</h3>
                </div>
                <p class="text-muted-foreground mb-4">
                  When you ask a question, our AI doesn't just generate a generic response. It
                  searches through your conversation history and preferences to provide
                  personalized, contextually relevant recommendations.
                </p>
                <ul class="space-y-2" role="list">
                  <li class="flex items-center text-sm text-muted-foreground">
                    <div class="w-1.5 h-1.5 bg-primary rounded-full mr-2" aria-hidden="true" />
                    Finds relevant information from your past interactions
                  </li>
                  <li class="flex items-center text-sm text-muted-foreground">
                    <div class="w-1.5 h-1.5 bg-primary rounded-full mr-2" aria-hidden="true" />
                    Combines your preferences with real-time data
                  </li>
                  <li class="flex items-center text-sm text-muted-foreground">
                    <div class="w-1.5 h-1.5 bg-primary rounded-full mr-2" aria-hidden="true" />
                    Provides contextual recommendations that improve over time
                  </li>
                </ul>
              </div>
            </div>
            <div class="mt-8 text-center">
              <div class="bg-gradient-to-r from-accent/10 to-primary/10 rounded-lg p-6 border border-border">
                <h4 class="text-lg font-semibold text-foreground mb-2">Example in Action</h4>
                <p class="text-sm text-muted-foreground">
                  <strong>You:</strong> "Show me some good restaurants in downtown."
                  <br />
                  <strong>Later:</strong> "What about something similar but vegetarian?"
                  <br />
                  <strong>Loci:</strong> Remembers your downtown preference and suggests vegetarian
                  restaurants in the same area, taking into account your conversation history to
                  provide exactly what you're looking for.
                </p>
              </div>
            </div>
          </section>

          {/* Coming Soon */}
          <section class="bg-muted/50 rounded-lg p-8 mb-12" aria-labelledby="coming-soon">
            <h2 id="coming-soon" class="text-2xl font-bold text-foreground text-center mb-6">
              Coming Soon
            </h2>
            <div class="grid md:grid-cols-2 gap-6" role="list">
              <div class="flex items-center" role="listitem">
                <div class="bg-primary/10 p-2 rounded-lg mr-4" aria-hidden="true">
                  <Zap class="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 class="font-semibold text-foreground">Speech-to-Text</h3>
                  <p class="text-sm text-muted-foreground">Voice-powered search and commands</p>
                </div>
              </div>
              <div class="flex items-center" role="listitem">
                <div class="bg-primary/10 p-2 rounded-lg mr-4" aria-hidden="true">
                  <List class="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 class="font-semibold text-foreground">Itinerary Export</h3>
                  <p class="text-sm text-muted-foreground">Download as PDF or Markdown</p>
                </div>
              </div>
              <div class="flex items-center" role="listitem">
                <div class="bg-primary/10 p-2 rounded-lg mr-4" aria-hidden="true">
                  <Users class="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 class="font-semibold text-foreground">24/7 AI Agent</h3>
                  <p class="text-sm text-muted-foreground">Personal travel companion</p>
                </div>
              </div>
              <div class="flex items-center" role="listitem">
                <div class="bg-primary/10 p-2 rounded-lg mr-4" aria-hidden="true">
                  <Globe class="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 class="font-semibold text-foreground">Advanced Memory Features</h3>
                  <p class="text-sm text-muted-foreground">
                    Cross-conversation learning and deeper personalization
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Call to Action */}
          <section class="text-center" aria-labelledby="cta-heading">
            <h2 id="cta-heading" class="text-2xl font-bold text-foreground mb-4">
              Ready to Experience These Features?
            </h2>
            <p class="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Start exploring with our free tier or upgrade to Premium for advanced features and
              unlimited access.
            </p>
            <div class="flex flex-col sm:flex-row gap-4 justify-center">
              <A href="/auth/signup" class="inline-block">
                <button
                  class="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
                  aria-label="Sign up for free to start using Loci features"
                >
                  Get Started Free
                </button>
              </A>
              <A href="/pricing" class="inline-block">
                <button
                  class="border border-border text-foreground hover:bg-muted focus:bg-muted font-semibold px-8 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
                  aria-label="View pricing plans for Loci"
                >
                  View Pricing
                </button>
              </A>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
