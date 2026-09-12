/**
 * A placeholder column.
 *
 * Comparing takes a few seconds — weather, places and a score per city — and
 * the only sign of that used to be a spinner inside the button, with the whole
 * page below it blank. Matching the real card's shape also stops the layout
 * jumping when the answer lands.
 */
export function ColumnSkeleton() {
  return (
    <article class="loci-card rounded-2xl p-5 flex flex-col gap-4 animate-pulse" aria-hidden="true">
      <header class="flex flex-col gap-2">
        <div class="h-3 w-20 rounded bg-muted" />
        <div class="h-7 w-40 rounded bg-muted" />
        <div class="h-3 w-32 rounded bg-muted" />
      </header>

      <div class="h-20 rounded-xl bg-muted" />
      <div class="h-16 rounded-xl bg-muted" />

      <div class="flex flex-col gap-2">
        <div class="h-3 w-24 rounded bg-muted" />
        <div class="h-3 w-full rounded bg-muted" />
        <div class="h-3 w-5/6 rounded bg-muted" />
        <div class="h-3 w-4/6 rounded bg-muted" />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="h-16 rounded bg-muted" />
        <div class="h-16 rounded bg-muted" />
      </div>

      <div class="h-10 rounded-lg bg-muted mt-auto" />
    </article>
  );
}

export default ColumnSkeleton;
