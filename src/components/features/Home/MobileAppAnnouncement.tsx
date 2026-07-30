import { createSignal } from "solid-js";
import { Card, CardContent } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { Smartphone, Apple, Play } from "lucide-solid";
import WaitlistModal from "~/components/WaitlistModal";

export default function MobileAppAnnouncement() {
  const [isWaitlistOpen, setIsWaitlistOpen] = createSignal(false);

  return (
    <>
      <WaitlistModal isOpen={isWaitlistOpen} onClose={() => setIsWaitlistOpen(false)} />
      <section
        class="w-full py-20 sm:py-24 lg:py-28 relative overflow-hidden"
        aria-labelledby="mobile-app-heading"
      >
        <div
          class="pointer-events-none absolute inset-0 bg-gradient-to-r from-emerald-400/5 via-transparent to-purple-500/5"
          aria-hidden="true"
        />
        <div class="container px-4 sm:px-6 lg:px-8 relative z-10">
          <Card class="max-w-5xl mx-auto relative overflow-hidden">
            {/* Background decoration */}
            <div class="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div class="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <CardContent class="p-10 sm:p-12 lg:p-16 relative z-10">
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-16 items-center">
                {/* Left Column: Text Content */}
                <div class="text-left space-y-6">
                  <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-500/10 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-500/20">
                    <Smartphone class="w-3 h-3" />
                    Native Experience
                  </div>

                  <h2
                    id="mobile-app-heading"
                    class="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight"
                  >
                    Loci in your pocket.
                    <span class="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-300">
                      Coming soon.
                    </span>
                  </h2>

                  <p class="text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                    We're building fully native iOS and Android apps for smoother offline maps,
                    instant location-based tips, and zero-latency interactions.
                  </p>

                  <div class="flex flex-wrap gap-4 pt-2">
                    {/* Fake App Store Button */}
                    <button
                      onClick={() => setIsWaitlistOpen(true)}
                      class="group flex items-center gap-3 bg-black hover:bg-gray-900 text-white px-4 py-2 rounded-xl border border-gray-800 transition-all hover:-translate-y-0.5 shadow-lg"
                    >
                      <Apple class="w-8 h-8 fill-current" />
                      <div class="text-left">
                        <div class="text-[10px] uppercase font-medium leading-none opacity-80">
                          Download on the
                        </div>
                        <div class="text-lg font-bold leading-tight">App Store</div>
                      </div>
                    </button>

                    {/* Fake Google Play Button */}
                    <button
                      onClick={() => setIsWaitlistOpen(true)}
                      class="group flex items-center gap-3 bg-black hover:bg-gray-900 text-white px-4 py-2 rounded-xl border border-gray-800 transition-all hover:-translate-y-0.5 shadow-lg"
                    >
                      <Play class="w-7 h-7 fill-current ml-1" />{" "}
                      {/* Using Play icon as generic representation */}
                      <div class="text-left">
                        <div class="text-[10px] uppercase font-medium leading-none opacity-80">
                          GET IT ON
                        </div>
                        <div class="text-lg font-bold leading-tight">Google Play</div>
                      </div>
                    </button>
                  </div>

                  <p class="text-xs text-slate-500 dark:text-slate-400 pl-1">
                    * Tap buttons to join the beta waitlist.
                  </p>
                </div>

                {/* Right Column: Visual Feature List */}
                <div class="relative">
                  <div class="grid gap-4">
                    <div class="loci-card flex items-center gap-4 p-5">
                      <div class="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <Smartphone class="w-6 h-6" />
                      </div>
                      <div>
                        <h3 class="font-bold text-gray-900 dark:text-white">Offline Mode</h3>
                        <p class="text-sm text-gray-600 dark:text-slate-300">
                          Access maps & guides without roaming data.
                        </p>
                      </div>
                    </div>

                    <div class="loci-card flex items-center gap-4 p-5">
                      <div class="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                        <Badge class="w-6 h-6 rounded-full p-0 flex items-center justify-center" />{" "}
                        {/* Reusing Badge or Icon */}
                        <span class="text-lg font-bold">🔔</span>
                      </div>
                      <div>
                        <h3 class="font-bold text-gray-900 dark:text-white">Smart Alerts</h3>
                        <p class="text-sm text-gray-600 dark:text-slate-300">
                          "You're near a 4.9★ coffee shop."
                        </p>
                      </div>
                    </div>

                    <div class="loci-card flex items-center gap-4 p-5">
                      <div class="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <span class="text-lg font-bold">⚡️</span>
                      </div>
                      <div>
                        <h3 class="font-bold text-gray-900 dark:text-white">Instant Sync</h3>
                        <p class="text-sm text-gray-600 dark:text-slate-300">
                          Plan on web, navigate on mobile.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
