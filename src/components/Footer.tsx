import { A } from "@solidjs/router";
import { Compass } from "lucide-solid";
import { LociLogo } from "~/components/brand/Logo";
import { capture } from "~/lib/analytics";
import { DISCORD_URL } from "~/lib/links";

const links = [
  { label: "Discover", href: "/discover" },
  { label: "Nearby", href: "/nearme" },
  { label: "Trips", href: "/trips" },
  { label: "Ask Loci", href: "/chat" },
  { label: "Contribute", href: "/contribute" },
  // Was labelled "Privacy" and pointed at /settings, which promised a privacy
  // policy and delivered the settings root. There is no policy page; the page
  // that actually answers the question is the one listing what Loci has
  // learned about you, with export and delete on it.
  { label: "Your data", href: "/settings/memory" },
  { label: "Privacy", href: "/privacy" },
  { label: "Support", href: "/support" },
];

export default function Footer() {
  return (
    <footer class="mt-20 border-t border-border bg-hero text-hero-foreground">
      <div class="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_1fr] lg:px-8">
        <div class="max-w-lg">
          <div class="mb-5">
            <LociLogo class="h-9 w-auto" />
            <p class="font-coord mt-3 text-[10px] uppercase tracking-[0.2em] text-hero-foreground">
              Explore your way
            </p>
          </div>
          <p class="max-w-md text-sm leading-6 text-hero-foreground">
            A personal field guide for finding places that fit your taste, shaping them into
            workable adventures, and learning from what you actually keep.
          </p>
        </div>

        <div>
          {/* The footer is an obsidian band in both appearances, so its text is
              the hero cream at full strength (16:1). Borders keep their alpha -
              they are not text. */}
          <p class="mb-4 font-coord text-[10px] uppercase tracking-[0.18em] text-hero-foreground">
            Pack your route
          </p>
          {/* 44px rows on touch (the links measured 20px tall at 390px); the
              gap collapses on wider screens where the pointer is fine. */}
          <div class="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:gap-y-3">
            {links.map((link) => (
              <A
                href={link.href}
                class="flex min-h-11 items-center text-hero-foreground transition-colors hover:underline hover:underline-offset-4 sm:min-h-0"
              >
                {link.label}
              </A>
            ))}
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => capture("discord_link_clicked", { surface: "footer" })}
              class="flex min-h-11 items-center text-hero-foreground transition-colors hover:underline hover:underline-offset-4 sm:min-h-0"
            >
              Join us on Discord
            </a>
          </div>
          <div class="mt-8 flex items-center gap-2 border-t border-hero-foreground/15 pt-5 text-xs text-hero-foreground">
            <Compass class="h-4 w-4" />
            <span>Built for curious travelers and useful detours.</span>
          </div>
        </div>
      </div>
      <div class="border-t border-hero-foreground/15 px-4 py-4 text-center font-coord text-[9px] uppercase tracking-[0.16em] text-hero-foreground">
        © {new Date().getFullYear()} Loci · Recommendations explain themselves
      </div>
    </footer>
  );
}
