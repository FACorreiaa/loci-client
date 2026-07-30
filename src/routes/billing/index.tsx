import { createSignal, Show, For } from "solid-js";
import { A } from "@solidjs/router";
import {
  CreditCard,
  Crown,
  Zap,
  CheckCircle,
  ArrowUpRight,
  FileText,
  AlertCircle,
  Sparkles,
} from "lucide-solid";
import {
  useUserSubscription,
  useCreateCheckoutSession,
  useCreateCustomerPortalSession,
} from "~/lib/api/billing";
import { Button } from "~/ui/button";
import {
  hasCheckoutConfigured,
  isProPlan,
  planDisplayName,
  stripePriceIds,
} from "~/lib/subscription";

const FREE_FEATURES = [
  "10 AI planning requests per day",
  "Day 1 Trip Kit exports",
  "MCP data tools",
];

const PRO_FEATURES = [
  "Unlimited AI planning (fair-use)",
  "Full multi-day Trip Kit",
  "MCP plan_itinerary",
  "Priority feature access",
];

export default function BillingPage() {
  const subscriptionQuery = useUserSubscription();
  const createCheckoutMutation = useCreateCheckoutSession();
  const createPortalMutation = useCreateCustomerPortalSession();

  const [isUpgrading, setIsUpgrading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const subscription = () => subscriptionQuery.data;
  const plan = () => subscription()?.plan || "free";
  const pro = () => isProPlan(plan());
  const planName = () => planDisplayName(plan());

  const usageLabel = () => {
    const usage = subscription()?.usage;
    if (!usage) return "—";
    if (usage.requestsLimit >= 9999) {
      return `${usage.requestsToday} today (unlimited)`;
    }
    return `${usage.requestsToday} / ${usage.requestsLimit}`;
  };

  const usagePercentage = () => {
    const usage = subscription()?.usage;
    if (!usage || usage.requestsLimit >= 9999 || usage.requestsLimit <= 0) return 0;
    return Math.min((usage.requestsToday / usage.requestsLimit) * 100, 100);
  };

  const handleUpgrade = async (interval: "monthly" | "annual" = "monthly") => {
    setError(null);
    const { monthly, annual } = stripePriceIds();
    const priceId = interval === "annual" ? annual || monthly : monthly || annual;
    if (!priceId) {
      setError("Stripe price IDs are not configured (VITE_STRIPE_PRICE_ID_MONTHLY / ANNUAL).");
      return;
    }

    setIsUpgrading(true);
    try {
      const result = await createCheckoutMutation.mutateAsync({
        priceId,
        successUrl: `${window.location.origin}/billing?success=true`,
        cancelUrl: `${window.location.origin}/billing?canceled=true`,
      });
      if (result.url) {
        window.location.href = result.url;
      } else {
        setError("Checkout session missing redirect URL.");
      }
    } catch (e) {
      console.error("Failed to create checkout session:", e);
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleManageBilling = async () => {
    setError(null);
    try {
      const result = await createPortalMutation.mutateAsync({
        returnUrl: window.location.href,
      });
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (e) {
      console.error("Failed to open billing portal:", e);
      setError(e instanceof Error ? e.message : "Could not open billing portal");
    }
  };

  return (
    <div class="min-h-screen relative bg-background transition-colors">
      <div class="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(12,125,242,0.08),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(99,179,237,0.08),transparent_28%)] dark:bg-[radial-gradient(circle_at_20%_20%,rgba(12,125,242,0.15),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(99,179,237,0.1),transparent_28%)]" />

      <div class="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-foreground mb-2">Billing & Subscription</h1>
          <p class="text-muted-foreground">Manage your plan, usage, and payment methods</p>
        </div>

        <Show when={error()}>
          <div class="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error()}
          </div>
        </Show>

        <div class="grid gap-6 lg:grid-cols-3">
          <div class="lg:col-span-2">
            <div class="relative overflow-hidden rounded-3xl border border-white/30 bg-gradient-to-br from-[#0c7df2] via-[#6aa5ff] to-[#0c1747] text-white shadow-2xl">
              <div class="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.45),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.35),transparent_30%)]" />
              <div class="relative p-6 sm:p-8">
                <div class="flex items-start justify-between mb-6">
                  <div class="flex items-center gap-4">
                    <div class="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                      {pro() ? (
                        <Crown class="w-7 h-7 text-white" />
                      ) : (
                        <Zap class="w-7 h-7 text-white" />
                      )}
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <h2 class="text-2xl font-bold">{planName()} Plan</h2>
                        <Show when={pro()}>
                          <span class="px-2.5 py-0.5 rounded-full bg-accent/20 text-accent-foreground text-xs font-medium border border-accent/30">
                            Active
                          </span>
                        </Show>
                      </div>
                      <div class="flex items-baseline gap-1 mt-1">
                        <span class="text-3xl font-bold">{pro() ? "$9.99" : "$0"}</span>
                        <span class="text-white/70">{pro() ? "/month" : "forever"}</span>
                      </div>
                    </div>
                  </div>

                  <Show when={pro()}>
                    <Button
                      variant="secondary"
                      class="bg-white/15 hover:bg-white/25 text-white border-white/20"
                      onClick={() => void handleManageBilling()}
                      disabled={createPortalMutation.isPending}
                    >
                      Manage Billing
                      <ArrowUpRight class="w-4 h-4 ml-1" />
                    </Button>
                  </Show>
                </div>

                <div class="grid grid-cols-2 gap-4 mb-6">
                  <div class="rounded-2xl bg-white/10 border border-white/20 p-4 backdrop-blur">
                    <div class="text-xs uppercase tracking-wide text-white/70 mb-2">
                      Today's usage
                    </div>
                    <div class="text-2xl font-bold">{usageLabel()}</div>
                    <div class="text-xs text-white/80">AI planning requests</div>
                    <Show when={!pro()}>
                      <div class="mt-3 h-2 rounded-full bg-white/20 overflow-hidden">
                        <div
                          class="h-full rounded-full bg-accent transition-all duration-500"
                          style={{ width: `${usagePercentage()}%` }}
                        />
                      </div>
                    </Show>
                  </div>
                  <div class="rounded-2xl bg-white/10 border border-white/20 p-4 backdrop-blur">
                    <div class="text-xs uppercase tracking-wide text-white/70 mb-2">Includes</div>
                    <ul class="space-y-1">
                      <For each={(pro() ? PRO_FEATURES : FREE_FEATURES).slice(0, 3)}>
                        {(feature) => (
                          <li class="flex items-center gap-2 text-sm">
                            <CheckCircle class="w-3.5 h-3.5 text-accent" />
                            <span class="text-white/90">{feature}</span>
                          </li>
                        )}
                      </For>
                    </ul>
                  </div>
                </div>

                <Show when={!pro()}>
                  <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/10 border border-white/20 backdrop-blur">
                    <div class="flex items-center gap-3">
                      <Sparkles class="w-5 h-5 text-accent shrink-0" />
                      <span class="text-sm font-medium">
                        Unlock full Trip Kit + unlimited AI with Pro
                      </span>
                    </div>
                    <Button
                      class="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                      onClick={() => void handleUpgrade("monthly")}
                      disabled={isUpgrading()}
                    >
                      {isUpgrading() ? "Redirecting..." : "Upgrade to Pro"}
                    </Button>
                  </div>
                </Show>
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <div class="loci-card p-6">
              <h3 class="font-semibold text-foreground mb-4">Quick actions</h3>
              <div class="space-y-3">
                <Show when={pro()}>
                  <button
                    type="button"
                    onClick={() => void handleManageBilling()}
                    class="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-muted text-foreground border border-border hover:border-primary/30 transition-all"
                  >
                    <span class="flex items-center gap-2 text-sm font-medium">
                      <CreditCard class="w-4 h-4 text-primary" />
                      Update payment method
                    </span>
                    <ArrowUpRight class="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleManageBilling()}
                    class="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-muted text-foreground border border-border hover:border-primary/30 transition-all"
                  >
                    <span class="flex items-center gap-2 text-sm font-medium">
                      <FileText class="w-4 h-4 text-primary" />
                      View invoices
                    </span>
                    <ArrowUpRight class="w-4 h-4 text-muted-foreground" />
                  </button>
                </Show>
                <A
                  href="/pricing"
                  class="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-muted text-foreground border border-border hover:border-primary/30 transition-all"
                >
                  <span class="flex items-center gap-2 text-sm font-medium">
                    <Zap class="w-4 h-4 text-primary" />
                    Compare plans
                  </span>
                  <ArrowUpRight class="w-4 h-4 text-muted-foreground" />
                </A>
              </div>
            </div>

            <div class="rounded-2xl bg-primary/5 border border-primary/20 p-6 shadow-sm">
              <div class="flex items-center gap-2 mb-2">
                <AlertCircle class="w-5 h-5 text-primary" />
                <h4 class="font-semibold text-foreground">Need help?</h4>
              </div>
              <p class="text-sm text-muted-foreground mb-3">
                Questions about billing or your subscription? We're here to help.
              </p>
              <a
                href="mailto:support@loci.app"
                class="text-sm text-primary font-medium hover:underline"
              >
                Contact Support →
              </a>
            </div>
          </div>
        </div>

        <Show when={!pro()}>
          <div class="mt-8">
            <h2 class="text-xl font-bold text-foreground mb-4">Upgrade to Pro</h2>
            <div class="loci-card border-2 border-primary/30 p-6 max-w-md">
              <div class="flex items-center gap-3 mb-3">
                <Crown class="w-6 h-6 text-primary" />
                <h3 class="text-lg font-bold text-foreground">Pro</h3>
              </div>
              <div class="flex items-baseline gap-1 mb-3">
                <span class="text-2xl font-bold text-foreground">$9.99</span>
                <span class="text-muted-foreground">/month</span>
                <span class="text-sm text-muted-foreground ml-2">or $99.90/year</span>
              </div>
              <ul class="space-y-2 mb-4">
                <For each={PRO_FEATURES}>
                  {(feature) => (
                    <li class="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle class="w-4 h-4 text-accent" />
                      {feature}
                    </li>
                  )}
                </For>
              </ul>
              <div class="flex flex-col sm:flex-row gap-2">
                <Button
                  class="flex-1"
                  onClick={() => void handleUpgrade("monthly")}
                  disabled={isUpgrading() || !hasCheckoutConfigured()}
                >
                  {isUpgrading() ? "Processing..." : "Pro monthly"}
                </Button>
                <Button
                  variant="outline"
                  class="flex-1"
                  onClick={() => void handleUpgrade("annual")}
                  disabled={isUpgrading() || !hasCheckoutConfigured()}
                >
                  Pro annual
                </Button>
              </div>
              <Show when={!hasCheckoutConfigured()}>
                <p class="text-xs text-muted-foreground mt-3">
                  Configure VITE_STRIPE_PRICE_ID_MONTHLY / ANNUAL to enable checkout.
                </p>
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
