import { createSignal, Show } from "solid-js";
import { Gift, Check, AlertCircle, Loader2, Sparkles, Tags } from "lucide-solid";

interface PromoCodeSectionProps {
  onSuccess?: (promoData: any) => void;
  className?: string;
}

export default function PromoCodeSection(props: PromoCodeSectionProps) {
  const [promoCode, setPromoCode] = createSignal("");
  const [isValidating, setIsValidating] = createSignal(false);
  const [validationResult, setValidationResult] = createSignal<{
    type: "success" | "error" | null;
    message: string;
    data?: any;
  }>({ type: null, message: "" });
  const [showPromoSection, setShowPromoSection] = createSignal(false);

  // Simulated promo codes for demo purposes
  const VALID_PROMO_CODES = {
    WELCOME2024: {
      type: "discount",
      discount: 50,
      description: "50% off your first 3 months",
      planAccess: "explorer",
      validity: "3 months",
    },
    FREETRIAL30: {
      type: "free_trial",
      duration: 30,
      description: "30 days of Explorer plan for free",
      planAccess: "explorer",
      validity: "30 days",
    },
    BETA100: {
      type: "free_access",
      description: "Free Explorer access for beta testers",
      planAccess: "explorer",
      validity: "lifetime",
    },
    STUDENT20: {
      type: "discount",
      discount: 20,
      description: "20% off Explorer plan (student discount)",
      planAccess: "explorer",
      validity: "12 months",
    },
    FRIEND15: {
      type: "discount",
      discount: 15,
      description: "15% off any plan (friend referral)",
      planAccess: "any",
      validity: "6 months",
    },
  };

  const validatePromoCode = async () => {
    const code = promoCode().trim().toUpperCase();
    if (!code) return;

    setIsValidating(true);
    setValidationResult({ type: null, message: "" });

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Check if promo code exists
    if (VALID_PROMO_CODES[code as keyof typeof VALID_PROMO_CODES]) {
      const promoData = VALID_PROMO_CODES[code as keyof typeof VALID_PROMO_CODES];
      setValidationResult({
        type: "success",
        message: `🎉 Promo code applied! ${promoData.description}`,
        data: promoData,
      });
      props.onSuccess?.(promoData);
    } else {
      setValidationResult({
        type: "error",
        message: "Invalid promo code. Please check and try again.",
      });
    }

    setIsValidating(false);
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      validatePromoCode();
    }
  };

  const resetPromoCode = () => {
    setPromoCode("");
    setValidationResult({ type: null, message: "" });
    setIsValidating(false);
  };

  return (
    <div class={`w-full ${props.className || ""}`}>
      {/* Toggle Button */}
      <div class="text-center mb-8">
        <button
          onClick={() => setShowPromoSection(!showPromoSection())}
          class="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Toggle promo code section"
        >
          <Gift class="w-5 h-5" />
          <span>Have a Promo Code or Free Token?</span>
          <Sparkles class="w-4 h-4 animate-pulse" />
        </button>
      </div>

      {/* Promo Code Section */}
      <Show when={showPromoSection()}>
        <div class="max-w-2xl mx-auto">
          <div class="loci-card p-8">
            {/* Header */}
            <div class="text-center mb-6">
              <div class="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <Tags class="w-8 h-8 text-white" />
              </div>
              <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Enter Your Promo Code
              </h3>
              <p class="text-gray-600 dark:text-gray-300 mb-6">
                Unlock special discounts, free trials, or exclusive access to premium features
              </p>
            </div>

            {/* Promo Code Input */}
            <div class="space-y-4">
              <div class="relative">
                <input
                  type="text"
                  value={promoCode()}
                  onInput={(e) => setPromoCode(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter promo code (e.g., WELCOME2024)"
                  class="w-full px-4 py-4 text-lg font-mono uppercase border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                  disabled={isValidating() || validationResult().type === "success"}
                />

                {/* Loading Spinner */}
                <Show when={isValidating()}>
                  <div class="absolute right-4 top-1/2 transform -translate-y-1/2">
                    <Loader2 class="w-6 h-6 text-blue-500 animate-spin" />
                  </div>
                </Show>
              </div>

              {/* Action Buttons */}
              <div class="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={validatePromoCode}
                  disabled={
                    !promoCode().trim() || isValidating() || validationResult().type === "success"
                  }
                  class="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <Show when={isValidating()}>
                    <Loader2 class="w-4 h-4 animate-spin" />
                  </Show>
                  <span>
                    {isValidating()
                      ? "Validating..."
                      : validationResult().type === "success"
                        ? "Applied!"
                        : "Apply Code"}
                  </span>
                </button>

                <Show when={validationResult().type === "success"}>
                  <button
                    onClick={resetPromoCode}
                    class="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    Try Another Code
                  </button>
                </Show>
              </div>

              {/* Validation Result */}
              <Show when={validationResult().message}>
                <div
                  class={`p-4 rounded-lg border-l-4 ${
                    validationResult().type === "success"
                      ? "bg-green-50 dark:bg-green-900/20 border-green-500 text-green-800 dark:text-green-200"
                      : "bg-red-50 dark:bg-red-900/20 border-red-500 text-red-800 dark:text-red-200"
                  }`}
                >
                  <div class="flex items-start gap-3">
                    <div class="flex-shrink-0 mt-0.5">
                      {validationResult().type === "success" ? (
                        <Check class="w-5 h-5 text-green-500" />
                      ) : (
                        <AlertCircle class="w-5 h-5 text-red-500" />
                      )}
                    </div>
                    <div class="flex-1">
                      <p class="font-medium mb-1">{validationResult().message}</p>
                      <Show when={validationResult().type === "success" && validationResult().data}>
                        <div class="text-sm opacity-90 space-y-1">
                          <p>
                            • Plan Access:{" "}
                            {validationResult().data?.planAccess === "any"
                              ? "Any Plan"
                              : validationResult().data?.planAccess}
                          </p>
                          <p>• Valid for: {validationResult().data?.validity}</p>
                        </div>
                      </Show>
                    </div>
                  </div>
                </div>
              </Show>
            </div>

            {/* Sample Codes Hint */}
            <Show when={!validationResult().type}>
              <div class="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  💡 Try these sample codes:
                </h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div class="flex items-center gap-2">
                    <code class="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded font-mono">
                      WELCOME2024
                    </code>
                    <span class="text-gray-600 dark:text-gray-300">50% off</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <code class="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded font-mono">
                      FREETRIAL30
                    </code>
                    <span class="text-gray-600 dark:text-gray-300">30 days free</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <code class="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded font-mono">
                      BETA100
                    </code>
                    <span class="text-gray-600 dark:text-gray-300">Free access</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <code class="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded font-mono">
                      STUDENT20
                    </code>
                    <span class="text-gray-600 dark:text-gray-300">Student discount</span>
                  </div>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}
