import { A } from "@solidjs/router";
import { Compass, MapPin } from "lucide-solid";

const links = [
  { label: "Discover", href: "/discover" },
  { label: "Nearby", href: "/nearme" },
  { label: "Trips", href: "/trips" },
  { label: "Ask Loci", href: "/chat" },
  { label: "Contribute", href: "/contribute" },
  { label: "Privacy", href: "/settings" },
];

export default function Footer() {
  return (
    <footer class="mt-20 border-t border-border bg-primary text-primary-foreground">
      <div class="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_1fr] lg:px-8">
        <div class="max-w-lg">
          <div class="mb-5 flex items-center gap-3">
            <span class="grid h-10 w-10 place-items-center rounded-full border border-primary-foreground/30">
              <MapPin class="h-5 w-5" />
            </span>
            <div>
              <p class="font-serif text-2xl font-semibold">Loci</p>
              <p class="font-coord text-[10px] uppercase tracking-[0.2em] text-primary-foreground">
                Go somewhere worth remembering
              </p>
            </div>
          </div>
          <p class="max-w-md text-sm leading-6 text-primary-foreground">
            A personal field guide for finding places that fit your taste, shaping them into
            workable adventures, and learning from what you actually keep.
          </p>
        </div>

        <div>
          {/* Opacity on primary-foreground is theme-dependent and cannot be
              tuned to satisfy both: in light mode it fades near-white over dark
              green (fine down to ~/70), in dark mode it fades near-black over
              light sage, where even /78 measured 3.4-4.4:1. Solid colour is the
              only value that passes in both, so the footer uses no alpha on
              text. Borders keep their alpha - they are not text. */}
          <p class="mb-4 font-coord text-[10px] uppercase tracking-[0.18em] text-primary-foreground">
            Pack your route
          </p>
          <div class="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {links.map((link) => (
              <A
                href={link.href}
                class="text-primary-foreground transition-colors hover:underline hover:underline-offset-4"
              >
                {link.label}
              </A>
            ))}
          </div>
          <div class="mt-8 flex items-center gap-2 border-t border-primary-foreground/15 pt-5 text-xs text-primary-foreground">
            <Compass class="h-4 w-4" />
            <span>Built for curious travelers and useful detours.</span>
          </div>
        </div>
      </div>
      <div class="border-t border-primary-foreground/15 px-4 py-4 text-center font-coord text-[9px] uppercase tracking-[0.16em] text-primary-foreground">
        © {new Date().getFullYear()} Loci · Recommendations explain themselves
      </div>
    </footer>
  );
}
