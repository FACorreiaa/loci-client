// The question box: where a trip starts. Streams the prompt and hands off to the result route.
import { createEffect, createSignal, on, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Send, Loader2, Settings } from "lucide-solid";
import { detectDomain } from "~/lib/api/llm";
import { startErrorMessage } from "~/lib/errors";
import { createStreamingSession, getDomainRoute, streamingService } from "~/lib/chat-stream";
import type { StreamingSession, AiCityResponse } from "~/lib/api/types";
import { useUserLocation } from "~/contexts/LocationContext";
import { useDefaultSearchProfile } from "~/lib/api/profiles";
import { formatCoord } from "~/lib/dashboard/format";
import { placeLabel, settledBrief, useHereBrief } from "~/lib/api/hereBrief";
import { heroPrompt } from "~/lib/dashboard/hero-prompt";
import { prefersReducedMotion } from "~/lib/hooks/useInView";
import QuickSettingsModal from "~/components/modals/QuickSettingsModal";
import ProfileQuickSelect from "./ProfileQuickSelect";
import DictationButton, {
  appendTranscript,
  DictationHint,
  type DictationStatus,
} from "~/components/ui/DictationButton";

export default function DeskHero() {
  const navigate = useNavigate();
  const [currentMessage, setCurrentMessage] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);
  const [streamProgress, setStreamProgress] = createSignal("");
  // Said inline under the box. Most failures happen after the hand-off to the
  // result page; the one that doesn't is the server refusing a 4th concurrent
  // search, and until this existed that refusal just stopped the spinner.
  const [searchError, setSearchError] = createSignal("");
  const [_streamingSession, setStreamingSession] = createSignal<StreamingSession | null>(null);
  const [isQuickSettingsOpen, setIsQuickSettingsOpen] = createSignal(false);
  // The box is locked while a recording is in flight, so what is typed during
  // it cannot race the transcript that lands afterwards.
  const [dictation, setDictation] = createSignal<DictationStatus>({ state: "idle", error: null });
  const dictating = () => dictation().state !== "idle";
  let textareaRef: HTMLTextAreaElement | undefined;

  // The in-season strip writes a request here; the person still presses
  // Discover. Nonce 0 is the untouched initial value, so the box is not
  // cleared on mount.
  createEffect(
    on(
      heroPrompt,
      (p) => {
        if (!p.nonce) return;
        setCurrentMessage(p.text);
        textareaRef?.focus();
        textareaRef?.scrollIntoView({
          block: "center",
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
      },
      { defer: true },
    ),
  );

  const { userLocation } = useUserLocation();
  // Same query key as HereNowBand, so this costs no second request.
  const here = useHereBrief(
    () => userLocation()?.latitude,
    () => userLocation()?.longitude,
  );
  // Streaming needs a position; Lisbon stands in when the browser gives none.
  // It is never rendered: the kicker shows "Plan" instead of a made-up coordinate.
  const userLatitude = () => userLocation()?.latitude ?? 38.7223;
  const userLongitude = () => userLocation()?.longitude ?? -9.1393;

  const defaultProfileQuery = useDefaultSearchProfile();
  const profileId = () => defaultProfileQuery.data?.id;

  const sendMessage = async (override?: string) => {
    const message = (override ?? currentMessage()).trim();
    if (!message || isLoading() || dictating()) return;

    setIsLoading(true);
    setSearchError("");
    setStreamProgress("Reading the request...");

    try {
      sessionStorage.removeItem("currentStreamingSession");
      sessionStorage.removeItem("completedStreamingSession");
      sessionStorage.removeItem("localChatSessions");

      const domain = detectDomain(message);
      const session = createStreamingSession(domain);
      session.query = message;
      setStreamingSession(session);
      sessionStorage.setItem("currentStreamingSession", JSON.stringify(session));

      const currentProfileId = profileId();
      if (!currentProfileId) {
        throw new Error("No default search profile found");
      }

      streamingService.startStream(
        {
          profileId: currentProfileId,
          message,
          userLocation: {
            userLat: userLatitude(),
            userLon: userLongitude(),
          },
        },
        {
          session,
          onStart: (started) => {
            setIsLoading(false);
            setStreamProgress("");
            setCurrentMessage("");
            navigate(getDomainRoute(started.domain, started.sessionId, started.city));
          },
          onProgress: (updatedSession) => {
            setStreamingSession(updatedSession);
            const domain = updatedSession.domain;
            const cityData = (updatedSession.data as Partial<AiCityResponse>)?.general_city_data;

            if (cityData) {
              setStreamProgress(`Found ${cityData.city}...`);
            } else if (domain === "accommodation") {
              setStreamProgress("Finding hotels...");
            } else if (domain === "dining") {
              setStreamProgress("Searching restaurants...");
            } else if (domain === "activities") {
              setStreamProgress("Discovering activities...");
            } else {
              setStreamProgress("Sketching the route...");
            }
            sessionStorage.setItem("currentStreamingSession", JSON.stringify(updatedSession));
          },
          onComplete: () => {
            setIsLoading(false);
            setStreamProgress("");
          },
          onError: (error) => {
            console.error("Streaming error:", error);
            setIsLoading(false);
            setStreamProgress("");
            setSearchError(
              startErrorMessage(error, "That didn't go through. Try again in a moment."),
            );
          },
        },
      );
    } catch (error) {
      console.error("Error sending message:", error);
      setIsLoading(false);
      setStreamProgress("");
    }
  };

  return (
    <>
      <section class="loci-hero mb-6">
        <div class="loci-hero__content p-6 sm:p-9">
          <div class="mb-4 flex items-start justify-between gap-3">
            <Show
              when={userLocation()}
              fallback={
                <p class="font-coord text-[10px] uppercase tracking-[0.2em] text-primary-foreground/65">
                  Plan
                </p>
              }
            >
              {(loc) => (
                <p class="font-coord text-[10px] uppercase tracking-[0.2em] text-primary-foreground/65">
                  <Show when={placeLabel(settledBrief(here))}>{(name) => <>{name()} · </>}</Show>
                  {formatCoord(loc().latitude, loc().longitude)}
                </p>
              )}
            </Show>
            <button
              type="button"
              onClick={() => setIsQuickSettingsOpen(true)}
              class="rounded-lg border border-primary-foreground/25 p-2 text-primary-foreground/80 transition-transform hover:bg-primary-foreground/10 hover:text-primary-foreground active:scale-[0.98]"
              title="Quick settings"
            >
              <Settings class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <h1 class="max-w-2xl font-display text-3xl tracking-tight text-primary-foreground sm:text-5xl">
            Where next
          </h1>
          <p class="loci-hero__subtitle mt-3 max-w-xl text-sm leading-6 sm:text-base">
            Start with a city, a mood, or one stop you refuse to miss.
          </p>

          <div class="mt-6">
            <ProfileQuickSelect />
          </div>

          <div class="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
            <div class="flex flex-1 items-end gap-2">
              <textarea
                ref={textareaRef}
                value={currentMessage()}
                onInput={(e) => setCurrentMessage(e.target.value)}
                placeholder="Lisbon for two days, walking, late dinners"
                class="min-h-12 w-full flex-1 resize-none rounded-xl border border-primary-foreground/20 bg-primary-foreground/95 px-4 py-3 text-primary placeholder:text-primary/45 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
                rows="1"
                disabled={dictating()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              {/* The words land in the box, not straight into a search: place
                  names come back misheard often enough that they need a look. */}
              <DictationButton
                variant="hero"
                label="Dictate a trip"
                disabled={isLoading()}
                onTranscript={(text) => setCurrentMessage((cur) => appendTranscript(cur, text))}
                onStatusChange={setDictation}
              />
            </div>
            <button
              type="button"
              onClick={() => sendMessage()}
              disabled={!currentMessage().trim() || isLoading() || dictating()}
              class="loci-hero__cta shrink-0 rounded-xl px-6 py-3 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
            >
              <Show
                when={isLoading()}
                fallback={
                  <>
                    <Send class="h-4 w-4" aria-hidden="true" />
                    Discover
                  </>
                }
              >
                <Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
                {streamProgress() || "Working..."}
              </Show>
            </button>
          </div>
          <DictationHint
            status={dictation()}
            class="mt-2 text-xs text-primary-foreground/75"
            errorClass="text-sm text-primary-foreground/90"
          />
          <Show when={searchError()}>
            <p role="alert" class="mt-3 text-sm text-primary-foreground/90">
              {searchError()}
            </p>
          </Show>
        </div>
      </section>

      <QuickSettingsModal
        isOpen={isQuickSettingsOpen()}
        onClose={() => setIsQuickSettingsOpen(false)}
      />
    </>
  );
}
