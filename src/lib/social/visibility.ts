// Trip visibility as people read it. Pure, so the picker, the trip cards and
// the shared page describe a level the same way.
import type { TripVisibility } from "../api/trips";

export interface VisibilityOption {
  value: TripVisibility;
  label: string;
  description: string;
}

export const VISIBILITY_OPTIONS: VisibilityOption[] = [
  { value: "private", label: "Only me", description: "Nobody else can open it." },
  {
    value: "friends",
    label: "Friends",
    description: "Your friends see it on their feed and your profile.",
  },
  {
    value: "link",
    label: "Anyone with the link",
    description: "Not listed anywhere; whoever has the link can open it.",
  },
  {
    value: "public",
    label: "Public",
    description: "Anyone with the link, and listed on your profile.",
  },
];

export const visibilityLabel = (v: TripVisibility | undefined): string =>
  VISIBILITY_OPTIONS.find((o) => o.value === (v ?? "private"))?.label ?? "Only me";

/** Whether a trip at this level has a link worth copying. */
export const hasShareLink = (v: TripVisibility | undefined): boolean => !!v && v !== "private";

/** The web address a share code opens (the iOS app claims the same path). */
export const SHARE_ORIGIN = "https://lociai.fyi";
export const sharedTripPath = (code: string): string => `/t/${encodeURIComponent(code)}`;
export const sharedTripUrl = (code: string): string => SHARE_ORIGIN + sharedTripPath(code);
