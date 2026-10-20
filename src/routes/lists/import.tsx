import { Title, Meta } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { ChevronLeft, Link2 } from "lucide-solid";
import { ProtectedRoute } from "~/contexts/AuthContext";
import ImportFromLink from "~/components/import/ImportFromLink";

function ImportPage() {
  return (
    <>
      <Title>Import from a link · Loci</Title>
      <Meta name="robots" content="noindex" />
      <main class="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <A
          href="/lists"
          class="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft class="w-4 h-4" />
          My Lists
        </A>
        <header class="mb-8">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Link2 class="w-5 h-5 text-primary" />
            </div>
            <h1 class="text-2xl sm:text-3xl font-bold text-foreground">Import from a link</h1>
          </div>
          <p class="text-muted-foreground text-sm sm:text-base">
            Saw a place on TikTok, Instagram, YouTube or a blog? Paste the link and keep the places
            in a list.
          </p>
        </header>
        <ImportFromLink />
      </main>
    </>
  );
}

export default function ImportFromLinkRoute() {
  return (
    <ProtectedRoute>
      <ImportPage />
    </ProtectedRoute>
  );
}
