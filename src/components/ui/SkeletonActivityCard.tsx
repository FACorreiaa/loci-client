// SkeletonActivityCard.tsx
import { Component, For } from "solid-js";

export const SkeletonActivityCard: Component = () => {
  return (
    <div class="bg-card rounded-lg border border-border p-4 shadow-sm animate-pulse">
      {/* Image skeleton */}
      <div class="w-full h-48 bg-muted rounded-lg mb-4" />

      {/* Title skeleton */}
      <div class="h-6 bg-muted rounded w-3/4 mb-2" />

      {/* Category/Rating skeleton */}
      <div class="flex items-center gap-2 mb-3">
        <div class="h-4 bg-muted rounded w-24" />
        <div class="h-4 bg-muted rounded w-16" />
      </div>

      {/* Description skeleton */}
      <div class="space-y-2 mb-4">
        <div class="h-4 bg-muted rounded w-full" />
        <div class="h-4 bg-muted rounded w-5/6" />
      </div>

      {/* Tags skeleton */}
      <div class="flex flex-wrap gap-2">
        <div class="h-6 w-16 bg-muted rounded-full" />
        <div class="h-6 w-20 bg-muted rounded-full" />
        <div class="h-6 w-14 bg-muted rounded-full" />
      </div>
    </div>
  );
};

export const SkeletonActivityGrid: Component<{ count?: number }> = (props) => {
  const count = () => props.count || 6;
  return <For each={Array.from({ length: count() })}>{() => <SkeletonActivityCard />}</For>;
};
