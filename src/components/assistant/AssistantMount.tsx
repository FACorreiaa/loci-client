import { lazy, onCleanup, onMount, Show, Suspense, type Component } from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import { useAuth } from "~/contexts/AuthContext";
import { useUserLocation } from "~/contexts/LocationContext";
import {
  assistantOpenedBy,
  closeAssistant,
  openAssistant,
  sendToPlanner,
} from "~/lib/assistant/open-state";

// Loaded on first open: recording and speech have no business in the Worker's
// server render, and everybody else needn't download them.
const AssistantOverlay = lazy(() => import("./AssistantOverlay"));

/** Ask Loci, for anyone signed in, on every screen with the nav. */
export const AssistantMount: Component = () => {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const place = useUserLocation();

  onMount(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && auth.isAuthenticated()) {
        e.preventDefault();
        openAssistant("keyboard");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    onCleanup(() => document.removeEventListener("keydown", onKeyDown));
  });

  return (
    <Show when={auth.isAuthenticated() && assistantOpenedBy()}>
      {(openedBy) => (
        <Suspense>
          <AssistantOverlay
            openedBy={openedBy()}
            path={() => location.pathname}
            coordinates={() => place.userLocation()}
            onClose={closeAssistant}
            onHandoff={(query, city) => {
              sendToPlanner(query, city);
              closeAssistant();
              navigate("/chat");
            }}
          />
        </Suspense>
      )}
    </Show>
  );
};
