// SkeletonHotelCard.tsx
import { Component, For } from "solid-js";

export const SkeletonHotelCard: Component = () => {
  return (
    <div class="bg-card rounded-lg border border-border p-4 animate-pulse">
      {/* Header with icon and title */}
      <div class="flex items-start gap-3 mb-4">
        {/* Icon skeleton */}
        <div class="w-12 h-12 rounded-full bg-muted flex-shrink-0" />

        <div class="flex-1 min-w-0">
          {/* Title skeleton */}
          <div class="h-5 bg-muted rounded w-3/4 mb-3" />

          {/* Tags skeleton */}
          <div class="flex flex-wrap gap-2 mb-2">
            <div class="h-6 w-20 bg-muted rounded-full" />
            <div class="h-6 w-24 bg-muted rounded-full" />
            <div class="h-6 w-16 bg-muted rounded-full" />
          </div>
        </div>

        {/* Rating skeleton */}
        <div class="h-6 w-16 bg-muted rounded-full flex-shrink-0" />
      </div>

      {/* Description skeleton */}
      <div class="space-y-2 mb-4">
        <div class="h-4 bg-muted rounded w-full" />
        <div class="h-4 bg-muted rounded w-5/6" />
      </div>

      {/* Footer skeleton */}
      <div class="flex items-center justify-between">
        <div class="h-6 w-24 bg-muted rounded" />
        <div class="flex gap-2">
          <div class="h-6 w-16 bg-muted rounded-md" />
          <div class="h-6 w-16 bg-muted rounded-md" />
          <div class="h-6 w-16 bg-muted rounded-md" />
        </div>
      </div>
    </div>
  );
};

export const SkeletonHotelGrid: Component<{ count?: number }> = (props) => {
  const count = () => props.count || 6;
  return (
    <div class="space-y-4">
      <For each={Array.from({ length: count() })}>{() => <SkeletonHotelCard />}</For>
    </div>
  );
};
