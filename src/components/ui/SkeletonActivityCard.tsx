// SkeletonActivityCard.tsx
import { Component, For } from "solid-js";

export const SkeletonActivityCard: Component = () => {
  return (
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm animate-pulse">
      {/* Image skeleton */}
      <div class="w-full h-48 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4" />

      {/* Title skeleton */}
      <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />

      {/* Category/Rating skeleton */}
      <div class="flex items-center gap-2 mb-3">
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
      </div>

      {/* Description skeleton */}
      <div class="space-y-2 mb-4">
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
      </div>

      {/* Tags skeleton */}
      <div class="flex flex-wrap gap-2">
        <div class="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
        <div class="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
        <div class="h-6 w-14 bg-gray-200 dark:bg-gray-700 rounded-full" />
      </div>
    </div>
  );
};

export const SkeletonActivityGrid: Component<{ count?: number }> = (props) => {
  const count = () => props.count || 6;
  return <For each={Array.from({ length: count() })}>{() => <SkeletonActivityCard />}</For>;
};
