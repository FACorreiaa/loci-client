import { Dynamic } from "solid-js/web";
import {
  Aperture,
  Award,
  Binoculars,
  Bookmark,
  Camera,
  Copy,
  Crown,
  Feather,
  Flag,
  Flame,
  Footprints,
  Globe,
  Handshake,
  House,
  Library,
  ListChecks,
  ListOrdered,
  Locate,
  Lock,
  Map as MapIcon,
  MapPin,
  MapPinPlus,
  Megaphone,
  Milestone,
  Moon,
  NotebookPen,
  Package,
  PenLine,
  Repeat,
  Route,
  Signpost,
  Sun,
  Sunrise,
  ThumbsUp,
  UserPlus,
  Users,
} from "lucide-solid";
import type { AchievementKind, Tier } from "~/lib/api/achievements";

// The server sends a semantic icon key (a lucide name), so the art can change
// without a contract change. An unknown key falls back to a plain award.
const GLYPHS = {
  aperture: Aperture,
  binoculars: Binoculars,
  bookmark: Bookmark,
  camera: Camera,
  copy: Copy,
  crown: Crown,
  feather: Feather,
  flag: Flag,
  flame: Flame,
  footprints: Footprints,
  globe: Globe,
  handshake: Handshake,
  house: House,
  library: Library,
  "list-checks": ListChecks,
  "list-ordered": ListOrdered,
  locate: Locate,
  lock: Lock,
  map: MapIcon,
  "map-pin": MapPin,
  "map-pin-plus": MapPinPlus,
  megaphone: Megaphone,
  milestone: Milestone,
  moon: Moon,
  "notebook-pen": NotebookPen,
  package: Package,
  "pen-line": PenLine,
  repeat: Repeat,
  route: Route,
  signpost: Signpost,
  sun: Sun,
  sunrise: Sunrise,
  "thumbs-up": ThumbsUp,
  "user-plus": UserPlus,
  users: Users,
} as const;

const glyphFor = (icon: string) => GLYPHS[icon as keyof typeof GLYPHS] ?? Award;

const SIZES = { sm: "h-9 w-9", md: "h-12 w-12", lg: "h-16 w-16" } as const;
const GLYPH_SIZES = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-7 w-7" } as const;

/** The ring colour: the tier's metal, the accent for a moment or a secret. */
const ringColor = (kind: AchievementKind, tier: Tier) =>
  kind === "track" && tier !== "none" ? `hsl(var(--tier-${tier}))` : "hsl(var(--accent))";

/**
 * A symbol on a ring. Earned: the ring in the tier's metal and a tinted face.
 * Not yet: a dashed muted ring and a faded glyph.
 */
export default function Medallion(props: {
  icon: string;
  kind: AchievementKind;
  tier: Tier;
  earned: boolean;
  size?: keyof typeof SIZES;
  label?: string;
}) {
  const size = () => props.size ?? "md";
  return (
    <span
      class={`relative inline-flex shrink-0 items-center justify-center rounded-full border-2 ${SIZES[size()]}`}
      classList={{
        "border-dashed border-border bg-muted text-muted-foreground": !props.earned,
      }}
      style={
        props.earned
          ? {
              "border-color": ringColor(props.kind, props.tier),
              background: `color-mix(in srgb, ${ringColor(props.kind, props.tier)} 14%, hsl(var(--card)))`,
              color: ringColor(props.kind, props.tier),
            }
          : undefined
      }
      role={props.label ? "img" : undefined}
      aria-label={props.label}
      aria-hidden={props.label ? undefined : "true"}
    >
      <Dynamic
        component={glyphFor(props.icon)}
        class={`${GLYPH_SIZES[size()]} ${props.earned ? "" : "opacity-60"}`}
        aria-hidden="true"
      />
    </span>
  );
}
