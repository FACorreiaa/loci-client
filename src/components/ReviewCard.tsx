import { createSignal, Show, For } from "solid-js";
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Reply,
  MoreHorizontal,
  MapPin,
  Calendar,
  Camera,
} from "lucide-solid";

interface ReviewProps {
  review: {
    id: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    rating: number;
    title: string;
    content: string;
    date: string;
    helpful: number;
    notHelpful: number;
    verified: boolean;
    photos?: string[];
    location?: string;
    visitDate?: string;
    travelType?: string;
    userReaction?: "helpful" | "not-helpful" | null;
  };
  onReaction?: (reviewId: string, reaction: "helpful" | "not-helpful") => void;
  onFlag?: (reviewId: string) => void;
  onReply?: (reviewId: string) => void;
  isCompact?: boolean;
}

export default function ReviewCard(props: ReviewProps) {
  const [showFullContent, setShowFullContent] = createSignal(false);
  const [_showPhotos, setShowPhotos] = createSignal(false);

  const review = () => props.review;
  const isCompact = () => props.isCompact || false;

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star class={`w-4 h-4 ${i < rating ? "text-yellow-500 fill-current" : "text-gray-300"}`} />
    ));
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return "text-green-600 bg-green-50";
    if (rating >= 3) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const getTravelTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      solo: "🎒",
      couple: "💑",
      family: "👨‍👩‍👧‍👦",
      friends: "👥",
      business: "💼",
    };
    return icons[type] || "✈️";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleReaction = (reaction: "helpful" | "not-helpful") => {
    if (props.onReaction) {
      props.onReaction(review().id, reaction);
    }
  };

  const truncateContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + "...";
  };

  return (
    <div class="cb-card">
      <div class={`p-${isCompact() ? "4" : "6"}`}>
        {/* Header */}
        <div class="flex items-start gap-3 mb-4">
          {/* User Avatar */}
          <div class="w-10 h-10 rounded-full bg-[#0c7df2] flex items-center justify-center text-white font-semibold flex-shrink-0 shadow-md ring-2 ring-white/60 dark:ring-slate-800">
            {review().userAvatar ? (
              <img
                src={review().userAvatar}
                alt={review().userName}
                loading="lazy"
                class="w-full h-full rounded-full object-cover"
              />
            ) : (
              review().userName.charAt(0).toUpperCase()
            )}
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <h4 class="font-semibold text-gray-900 dark:text-white truncate">
                {review().userName}
              </h4>
              {review().verified && (
                <span class="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-xs font-medium">
                  Verified
                </span>
              )}
            </div>

            {/* Rating and Date */}
            <div class="flex items-center gap-3 mb-2">
              <div class="flex items-center gap-1">
                {renderStars(review().rating)}
                <span
                  class={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${getRatingColor(review().rating)}`}
                >
                  {review().rating}/5
                </span>
              </div>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                {formatDate(review().date)}
              </span>
            </div>

            {/* Travel Info */}
            <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              {review().visitDate && (
                <div class="flex items-center gap-1">
                  <Calendar class="w-3 h-3" />
                  <span>Visited {formatDate(review().visitDate!)}</span>
                </div>
              )}
              {review().travelType && (
                <div class="flex items-center gap-1">
                  <span>{getTravelTypeIcon(review().travelType!)}</span>
                  <span class="capitalize">{review().travelType} travel</span>
                </div>
              )}
              {review().location && (
                <div class="flex items-center gap-1">
                  <MapPin class="w-3 h-3" />
                  <span>{review().location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions Menu */}
          <button class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <MoreHorizontal class="w-4 h-4" />
          </button>
        </div>

        {/* Review Title */}
        <Show when={review().title}>
          <h3 class="font-semibold text-gray-900 dark:text-white mb-3">{review().title}</h3>
        </Show>

        {/* Review Content */}
        <div class="mb-4">
          <p class="text-gray-700 dark:text-gray-300 leading-relaxed">
            {showFullContent() || review().content.length <= 200
              ? review().content
              : truncateContent(review().content)}
          </p>

          <Show when={review().content.length > 200 && !showFullContent()}>
            <button
              onClick={() => setShowFullContent(true)}
              class="mt-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium"
            >
              Read more
            </button>
          </Show>
        </div>

        {/* Photos */}
        <Show when={review()?.photos && (review()?.photos?.length ?? 0) > 0}>
          <div class="mb-4">
            <div class="flex items-center gap-2 mb-2">
              <Camera class="w-4 h-4 text-gray-500" />
              <span class="text-sm text-gray-600 dark:text-gray-300">
                {review()?.photos?.length} photo{(review()?.photos?.length ?? 0) > 1 ? "s" : ""}
              </span>
            </div>

            <div class="grid grid-cols-3 gap-2">
              <For each={review()?.photos?.slice(0, 3)}>
                {(_photo: string, index) => (
                  <button
                    onClick={() => setShowPhotos(true)}
                    class="relative aspect-square bg-white/70 dark:bg-slate-900/60 border border-white/60 dark:border-slate-800/70 rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                  >
                    <div class="absolute inset-0 flex items-center justify-center">
                      <Camera class="w-6 h-6 text-gray-400 dark:text-gray-500" />
                    </div>
                    {index() === 2 && (review()?.photos?.length ?? 0) > 3 && (
                      <div class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <span class="text-white font-medium text-sm">
                          +{(review()?.photos?.length ?? 0) - 3}
                        </span>
                      </div>
                    )}
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Actions */}
        <div class="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
          <div class="flex items-center gap-4">
            {/* Helpful/Not Helpful */}
            <div class="flex items-center gap-2">
              <button
                onClick={() => handleReaction("helpful")}
                class={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm transition-colors ${
                  review().userReaction === "helpful"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <ThumbsUp class="w-4 h-4" />
                <span>Helpful</span>
                <Show when={review().helpful > 0}>
                  <span class="text-xs">({review().helpful})</span>
                </Show>
              </button>

              <button
                onClick={() => handleReaction("not-helpful")}
                class={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm transition-colors ${
                  review().userReaction === "not-helpful"
                    ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <ThumbsDown class="w-4 h-4" />
                <Show when={review().notHelpful > 0}>
                  <span class="text-xs">({review().notHelpful})</span>
                </Show>
              </button>
            </div>

            {/* Reply */}
            <Show when={props.onReply}>
              <button
                onClick={() => props.onReply!(review().id)}
                class="flex items-center gap-1 px-3 py-1 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm transition-colors"
              >
                <Reply class="w-4 h-4" />
                <span>Reply</span>
              </button>
            </Show>
          </div>

          {/* Report */}
          <button
            onClick={() => props.onFlag && props.onFlag(review().id)}
            class="flex items-center gap-1 px-3 py-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm transition-colors"
          >
            <Flag class="w-4 h-4" />
            <span>Report</span>
          </button>
        </div>
      </div>
    </div>
  );
}
