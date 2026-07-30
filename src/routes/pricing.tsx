import { A, useNavigate } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import { Check, Star, Zap, Crown, Heart, Plug } from "lucide-solid";
import { createSignal, Show, For } from "solid-js";
import PromoCodeSection from "~/components/PromoCodeSection";
import { useAuth } from "~/contexts/AuthContext";
import { useCreateCheckoutSession, useUserSubscription } from "~/lib/api/billing";
import { hasCheckoutConfigured, isProPlan, stripePriceIds } from "~/lib/subscription";

type BillingInterval = "monthly" | "annual";

export default function Pricing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const subscriptionQuery = useUserSubscription(() => isAuthenticated());
  const checkout = useCreateCheckoutSession();

  const [appliedPromo, setAppliedPromo] = createSignal<{
    description?: string;
    type?: string;
    discount?: number;
    duration?: number;
    planAccess?: string;
  } | null>(null);
  const [interval, setInterval] = createSignal<BillingInterval>("monthly");
  const [checkoutError, setCheckoutError] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);

  const alreadyPro = () => isProPlan(subscriptionQuery.data?.plan);
  const prices = () => stripePriceIds();
  const checkoutReady = () => hasCheckoutConfigured();

  const monthlyPrice = 9.99;
  const annualPrice = 99.9;
  const displayPrice = () =>
    interval() === "monthly" ? `$${monthlyPrice.toFixed(2)}` : `$${annualPrice.toFixed(2)}`;
  const displayPeriod = () => (interval() === "monthly" ? "per month" : "per year");

  const freeFeatures = [
    "10 AI planning requests per day",
    "Core recommendations & maps",
    "Save favorites and lists",
    "Day 1 Trip Kit (Maps + calendar + PDF)",
    "MCP data tools (search places, lists)",
  ];

  const freeLimits = [
    "Multi-day Trip Kit locked after Day 1",
    "MCP plan_itinerary requires Pro",
    "Fair daily AI limit resets at midnight UTC",
  ];

  const proFeatures = [
    "Unlimited AI planning (fair-use protected)",
    "Full multi-day Trip Kit — Maps, calendar, PDF",
    "MCP plan_itinerary in Claude, Codex & more",
    "Priority feature access as we ship",
    "Ad-free experience",
    "30-day money-back guarantee",
  ];

  const comparison = [
    {
      category: "AI & planning",
      items: [
        { feature: "Daily AI requests", free: "10 / day", pro: "Unlimited*" },
        { feature: "Streaming itineraries", free: true, pro: true },
        { feature: "Preference profiles", free: true, pro: true },
        { feature: "MCP plan_itinerary", free: false, pro: true },
      ],
    },
    {
      category: "Trip Kit",
      items: [
        { feature: "Google Maps multi-stop", free: "Day 1", pro: "All days" },
        { feature: "Calendar (.ics) export", free: "Day 1", pro: "All days" },
        { feature: "PDF city pack", free: "Day 1", pro: "Full trip" },
      ],
    },
    {
      category: "Agent access",
      items: [
        { feature: "MCP search & lists", free: true, pro: true },
        { feature: "API keys", free: true, pro: true },
      ],
    },
  ];

  const handlePromoSuccess = (promoData: {
    description?: string;
    type?: string;
    discount?: number;
    duration?: number;
    planAccess?: string;
  }) => {
    setAppliedPromo(promoData);
  };

  const startCheckout = async () => {
    setCheckoutError(null);

    if (!isAuthenticated()) {
      navigate("/auth/signup?next=/pricing");
      return;
    }

    if (alreadyPro()) {
      navigate("/billing");
      return;
    }

    const { monthly, annual } = prices();
    const priceId = interval() === "annual" ? annual || monthly : monthly || annual;
    if (!priceId) {
      setCheckoutError(
        "Checkout is not configured yet. Set VITE_STRIPE_PRICE_ID_MONTHLY (and annual) to match the server Stripe prices.",
      );
      return;
    }

    setLoading(true);
    try {
      const origin = window.location.origin;
      const result = await checkout.mutateAsync({
        priceId,
        successUrl: `${origin}/billing?success=true`,
        cancelUrl: `${origin}/pricing?canceled=true`,
        mode: "subscription",
      });
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      setCheckoutError("Checkout session created but no redirect URL was returned.");
    } catch (e) {
      console.error("Checkout failed:", e);
      setCheckoutError(
        e instanceof Error ? e.message : "Could not start checkout. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const cell = (value: boolean | string) => {
    if (typeof value === "boolean") {
      // `aria-label` is prohibited on a plain <div> (no role to label), so the
      // "not included" marker announced as nothing. Give both states an
      // explicit img role so the meaning survives for screen readers.
      return value ? (
        <Check class="w-5 h-5 text-accent mx-auto" role="img" aria-label="Included" />
      ) : (
        <div
          class="w-5 h-5 mx-auto flex items-center justify-center"
          role="img"
          aria-label="Not included"
        >
          <div class="w-4 h-0.5 bg-muted-foreground/50" />
        </div>
      );
    }
    return <span class="text-sm text-muted-foreground font-medium">{value}</span>;
  };

  return (
    <>
      <Title>Pricing — Free & Pro | Loci AI Travel Companion</Title>
      <Meta
        name="description"
        content="Start free with 10 AI planning requests a day. Upgrade to Loci Pro for unlimited planning, full multi-day Trip Kit exports, and MCP itinerary generation."
      />
      <Meta property="og:title" content="Loci Pricing — Free & Pro" />
      <Meta
        property="og:description"
        content="Free plan for casual explorers. Pro at $9.99/mo for full Trip Kit, unlimited AI, and agent planning."
      />
      <Meta property="og:url" content="https://loci.app/pricing" />
      <link rel="canonical" href="https://loci.app/pricing" />

      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "Loci - AI Travel Companion",
          description: "AI-powered travel planning with Trip Kit exports",
          brand: { "@type": "Brand", name: "Loci" },
          offers: [
            {
              "@type": "Offer",
              name: "Free Plan",
              price: "0",
              priceCurrency: "USD",
              availability: "https://schema.org/InStock",
            },
            {
              "@type": "Offer",
              name: "Pro Plan",
              price: "9.99",
              priceCurrency: "USD",
              availability: "https://schema.org/InStock",
            },
          ],
        })}
      </script>

      <div class="min-h-screen bg-background text-foreground transition-colors">
        <div class="max-w-6xl mx-auto px-4 py-12 space-y-12">
          <header class="text-center">
            <div class="rounded-3xl bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 border border-border shadow-lg p-10 space-y-4">
              <h1 class="text-4xl md:text-6xl font-bold text-foreground">
                Simple <span class="text-primary">Pricing</span>
              </h1>
              <p class="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Plan free. Upgrade when you need the full trip on your phone — Maps, calendar, PDF,
                and unlimited AI.
              </p>
              <div class="inline-flex items-center bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium border border-primary/30">
                <Star class="w-4 h-4 mr-2" aria-hidden="true" />
                30-day money-back guarantee on Pro
              </div>
            </div>
          </header>

          <PromoCodeSection onSuccess={handlePromoSuccess} />

          <Show when={appliedPromo()}>
            <div class="max-w-3xl mx-auto loci-card rounded-2xl p-5">
              <p class="font-semibold text-foreground">Promo applied</p>
              <p class="text-muted-foreground text-sm">{appliedPromo()?.description}</p>
            </div>
          </Show>

          {/* Interval toggle */}
          <div class="flex justify-center">
            <div
              class="inline-flex rounded-full border border-border bg-muted/40 p-1"
              role="group"
              aria-label="Billing interval"
            >
              <button
                type="button"
                class={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                  interval() === "monthly"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setInterval("monthly")}
              >
                Monthly
              </button>
              <button
                type="button"
                class={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                  interval() === "annual"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setInterval("annual")}
              >
                Annual <span class="opacity-80">(~17% off)</span>
              </button>
            </div>
          </div>

          <section
            class="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto"
            aria-labelledby="pricing-plans"
          >
            <h2 id="pricing-plans" class="sr-only">
              Pricing plans
            </h2>

            {/* Free */}
            <article class="relative bg-card border-2 border-border rounded-2xl shadow-lg p-8">
              <div class="flex items-center mb-4 gap-3">
                <div class="bg-muted p-3 rounded-lg">
                  <Heart class="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 class="text-2xl font-bold">Free</h3>
              </div>
              <div class="mb-2">
                <span class="text-4xl font-bold">$0</span>
                <span class="text-muted-foreground ml-2">forever</span>
              </div>
              <p class="text-muted-foreground mb-6">
                For casual explorers trying AI trip planning.
              </p>
              <A
                href={isAuthenticated() ? "/chat" : "/auth/signup"}
                class="block w-full text-center py-3 px-6 rounded-lg font-semibold border border-border hover:bg-muted transition mb-6"
              >
                Get started free
              </A>
              <ul class="space-y-2 mb-4">
                <For each={freeFeatures}>
                  {(f) => (
                    <li class="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check class="w-5 h-5 text-primary shrink-0" />
                      {f}
                    </li>
                  )}
                </For>
              </ul>
              <hr class="my-4 border-border" />
              <p class="text-xs font-semibold text-muted-foreground mb-2">Limits</p>
              <ul class="space-y-1.5">
                <For each={freeLimits}>
                  {(f) => (
                    <li class="text-sm text-muted-foreground flex gap-2">
                      <span class="mt-2 w-1.5 h-1.5 rounded-full bg-muted-foreground shrink-0" />
                      {f}
                    </li>
                  )}
                </For>
              </ul>
            </article>

            {/* Pro */}
            <article class="relative bg-card border-2 border-primary scale-[1.02] rounded-2xl shadow-xl p-8">
              <div class="absolute -top-4 left-1/2 -translate-x-1/2">
                <div class="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium flex items-center">
                  <Zap class="w-4 h-4 mr-1" />
                  Most popular
                </div>
              </div>
              <div class="flex items-center mb-4 gap-3">
                <div class="bg-primary/10 p-3 rounded-lg">
                  <Crown class="w-6 h-6 text-primary" />
                </div>
                <h3 class="text-2xl font-bold">Pro</h3>
              </div>
              <div class="mb-2">
                <span class="text-4xl font-bold">{displayPrice()}</span>
                <span class="text-muted-foreground ml-2">{displayPeriod()}</span>
              </div>
              <Show when={interval() === "annual"}>
                <p class="text-sm text-primary font-medium mb-2">
                  Billed annually · about ${(annualPrice / 12).toFixed(2)}/mo
                </p>
              </Show>
              <p class="text-muted-foreground mb-6">
                For travelers who want the plan on their phone and unlimited refining.
              </p>

              <button
                type="button"
                class="w-full py-3 px-6 rounded-lg font-semibold bg-primary text-primary-foreground hover:opacity-90 transition mb-3 disabled:opacity-60"
                disabled={loading() || alreadyPro()}
                onClick={() => void startCheckout()}
              >
                {alreadyPro()
                  ? "You're on Pro"
                  : loading()
                    ? "Redirecting to checkout…"
                    : interval() === "annual"
                      ? "Start Pro annual"
                      : "Start Pro monthly"}
              </button>

              <Show when={alreadyPro()}>
                <A
                  href="/billing"
                  class="block text-center text-sm text-primary hover:underline mb-4"
                >
                  Manage billing
                </A>
              </Show>

              <Show when={checkoutError()}>
                <p class="text-sm text-destructive mb-4" role="alert">
                  {checkoutError()}
                </p>
              </Show>

              <Show when={!checkoutReady() && !alreadyPro()}>
                <p class="text-xs text-muted-foreground mb-4">
                  Dev note: set <code class="text-foreground">VITE_STRIPE_PRICE_ID_MONTHLY</code> /
                  <code class="text-foreground"> ANNUAL</code> to enable live checkout.
                </p>
              </Show>

              <ul class="space-y-2">
                <For each={proFeatures}>
                  {(f) => (
                    <li class="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check class="w-5 h-5 text-primary shrink-0" />
                      {f}
                    </li>
                  )}
                </For>
              </ul>
            </article>
          </section>

          {/* MCP callout */}
          <section class="rounded-3xl border border-border bg-card p-8 md:p-10 shadow-lg">
            <div class="flex flex-col md:flex-row md:items-center gap-6 justify-between">
              <div class="flex gap-4">
                <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Plug class="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 class="text-2xl font-bold mb-1">Use Loci inside your AI agent</h2>
                  <p class="text-muted-foreground max-w-xl">
                    Free includes MCP search and list tools. Pro unlocks{" "}
                    <code class="text-sm">plan_itinerary</code> so Claude, Codex, Gemini, and others
                    can generate and save trips on your account.
                  </p>
                </div>
              </div>
              <A
                href="/mcp"
                class="inline-flex items-center justify-center rounded-lg border border-border px-5 py-2.5 font-medium hover:bg-muted transition shrink-0"
              >
                MCP setup guide
              </A>
            </div>
          </section>

          {/* Comparison */}
          <section class="bg-muted/40 rounded-2xl p-8" aria-labelledby="feature-comparison">
            <h2 id="feature-comparison" class="text-3xl font-bold text-center mb-8">
              Feature comparison
            </h2>
            <div class="overflow-x-auto">
              <table class="w-full" aria-label="Feature comparison Free vs Pro">
                <thead>
                  <tr class="border-b border-border">
                    <th class="text-left py-4 pr-4 font-semibold" scope="col">
                      Feature
                    </th>
                    <th class="text-center py-4 px-4 font-semibold" scope="col">
                      Free
                    </th>
                    <th class="text-center py-4 pl-4 font-semibold text-primary" scope="col">
                      Pro
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <For each={comparison}>
                    {(cat) => (
                      <>
                        <tr>
                          <td colspan="3" class="pt-6 pb-2">
                            <span class="font-semibold">{cat.category}</span>
                          </td>
                        </tr>
                        <For each={cat.items}>
                          {(item) => (
                            <tr class="border-b border-border/50">
                              <td class="py-3 pr-4 text-muted-foreground">{item.feature}</td>
                              <td class="text-center py-3 px-4">{cell(item.free)}</td>
                              <td class="text-center py-3 pl-4">{cell(item.pro)}</td>
                            </tr>
                          )}
                        </For>
                      </>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
            <p class="text-xs text-muted-foreground mt-4 text-center">
              * Pro is sold as unlimited with a high fair-use cap to protect service quality.
            </p>
          </section>

          {/* FAQ */}
          <section class="max-w-3xl mx-auto space-y-4" aria-labelledby="faq">
            <h2 id="faq" class="text-3xl font-bold text-center mb-8">
              FAQ
            </h2>
            <article class="bg-card rounded-lg p-6 border border-border">
              <h3 class="font-semibold mb-2">Can I cancel anytime?</h3>
              <p class="text-muted-foreground text-sm">
                Yes. Manage or cancel from Billing via the Stripe customer portal. Access continues
                through the paid period.
              </p>
            </article>
            <article class="bg-card rounded-lg p-6 border border-border">
              <h3 class="font-semibold mb-2">What is the Trip Kit?</h3>
              <p class="text-muted-foreground text-sm">
                After the AI builds your itinerary, Trip Kit puts it on your phone: multi-stop
                Google Maps route, calendar events (.ics), and a PDF pack. Free unlocks Day 1; Pro
                unlocks the full multi-day trip.
              </p>
            </article>
            <article class="bg-card rounded-lg p-6 border border-border">
              <h3 class="font-semibold mb-2">Is there a free trial?</h3>
              <p class="text-muted-foreground text-sm">
                The Free plan is the trial — 10 AI requests per day plus Day 1 Trip Kit. Pro
                includes a 30-day money-back guarantee.
              </p>
            </article>
            <article class="bg-card rounded-lg p-6 border border-border">
              <h3 class="font-semibold mb-2">Annual discount?</h3>
              <p class="text-muted-foreground text-sm">
                Annual Pro is $99.90/year (~17% less than monthly). Toggle Annual above to checkout
                yearly.
              </p>
            </article>
          </section>

          <section class="text-center loci-card rounded-2xl p-12">
            <h2 class="text-3xl font-bold mb-4">Ready when your trip is</h2>
            <p class="text-muted-foreground mb-8 max-w-xl mx-auto">
              Generate a plan free. Upgrade when you need every day on Maps and calendar.
            </p>
            <div class="flex flex-wrap justify-center gap-3">
              <A
                href={isAuthenticated() ? "/chat" : "/auth/signup"}
                class="inline-flex rounded-lg border border-border px-6 py-3 font-semibold hover:bg-muted transition"
              >
                Start free
              </A>
              <button
                type="button"
                class="inline-flex rounded-lg bg-primary text-primary-foreground px-6 py-3 font-semibold hover:opacity-90 transition disabled:opacity-60"
                disabled={loading() || alreadyPro()}
                onClick={() => void startCheckout()}
              >
                {alreadyPro() ? "You're on Pro" : "Get Pro"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
