import { createSignal, For, Show, lazy } from "solid-js";
import { Star, Search, MapPin, Plus, SortAsc, SortDesc } from "lucide-solid";
import ReviewCard from "~/components/ReviewCard";
const ReviewForm = lazy(() => import("~/components/ReviewForm"));
import { Button } from "~/ui/button";
import { TextField, TextFieldRoot } from "~/ui/textfield";
import {
  useUserReviews,
  useRecentReviews,
  useCreateReview,
  useLikeReview,
  type ReviewItem,
} from "~/lib/api/reviews";
import { ErrorView } from "~/components/ErrorView";
import { capture } from "~/lib/analytics";

interface Place {
  id: string;
  name: string;
  location: string;
}

interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  poiId: string;
  poiName: string;
  rating: number;
  title: string;
  content: string;
  date: string;
  visitDate: string;
  helpful: number;
  notHelpful: number;
  verified: boolean;
  photos: string[];
  location: string;
  travelType: string;
  userReaction: "helpful" | "not-helpful" | null;
}

export default function ReviewsPage() {
  const [activeTab, setActiveTab] = createSignal("all"); // 'all', 'my-reviews', 'places'
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedRating, setSelectedRating] = createSignal("all");
  const [selectedTravelType, setSelectedTravelType] = createSignal("all");
  const [sortBy, setSortBy] = createSignal("recent"); // 'recent', 'helpful', 'rating'
  const [sortOrder, setSortOrder] = createSignal("desc");
  const [showReviewForm, setShowReviewForm] = createSignal(false);
  const [selectedPlace, setSelectedPlace] = createSignal<Place | null>(null);

  // Sample reviews data
  const [reviews, setReviews] = createSignal<Review[]>([
    {
      id: "rev-1",
      userId: "user-1",
      userName: "Sarah Chen",

      poiId: "poi-1",
      poiName: "Livraria Lello",
      rating: 5,
      title: "Absolutely magical bookstore!",
      content:
        "This bookstore is a must-visit in Porto. The neo-gothic architecture is breathtaking, and the famous spiral staircase is as beautiful as everyone says. I recommend going early in the morning to avoid crowds and get the best photos. The entrance fee is worth it, and you can use it towards a book purchase. The atmosphere is incredible - you really feel like you're in a fairy tale.",
      date: "2024-01-20",
      visitDate: "2024-01-15",
      helpful: 24,
      notHelpful: 2,
      verified: true,
      photos: ["photo1.jpg", "photo2.jpg"],
      location: "Porto, Portugal",
      travelType: "solo",
      userReaction: null,
    },
    {
      id: "rev-2",
      userId: "user-2",
      userName: "Marco Silva",

      poiId: "poi-2",
      poiName: "Ponte Luís I",
      rating: 4,
      title: "Great views but very crowded",
      content:
        "The bridge offers spectacular views of Porto and Vila Nova de Gaia. The double-deck design is impressive and the walk across is nice. However, it gets very crowded during sunset hours. If you want good photos, come during off-peak times. The upper level has better views but can be windy.",
      date: "2024-01-18",
      visitDate: "2024-01-10",
      helpful: 18,
      notHelpful: 1,
      verified: true,
      photos: ["photo3.jpg"],
      location: "Porto, Portugal",
      travelType: "couple",
      userReaction: "helpful",
    },
    {
      id: "rev-3",
      userId: "user-3",
      userName: "Emma Johnson",

      poiId: "poi-3",
      poiName: "Cais da Ribeira",
      rating: 5,
      title: "Perfect family destination",
      content:
        "We loved exploring this UNESCO World Heritage district with our kids. The colorful buildings are beautiful, and there are plenty of restaurants with outdoor seating. The kids enjoyed watching the boats on the river. Street performers add to the lively atmosphere. Great place for family photos!",
      date: "2024-01-16",
      visitDate: "2024-01-12",
      helpful: 15,
      notHelpful: 0,
      verified: false,
      photos: [],
      location: "Porto, Portugal",
      travelType: "family",
      userReaction: null,
    },
    {
      id: "rev-4",
      userId: "user-4",
      userName: "David Park",

      poiId: "poi-1",
      poiName: "Livraria Lello",
      rating: 3,
      title: "Overhyped but still worth seeing",
      content:
        "It's a beautiful bookstore, but the hype might have set my expectations too high. The entrance fee feels a bit steep for what amounts to a quick photo opportunity. The crowds make it difficult to appreciate the architecture properly. That said, it is genuinely beautiful and historic.",
      date: "2024-01-14",
      visitDate: "2024-01-08",
      helpful: 8,
      notHelpful: 5,
      verified: true,
      photos: [],
      location: "Porto, Portugal",
      travelType: "friends",
      userReaction: null,
    },
  ]);

  // Real "My Reviews" data from the ReviewService.
  const userReviewsQuery = useUserReviews();
  const recentReviewsQuery = useRecentReviews();
  const createReview = useCreateReview();
  const likeReview = useLikeReview();

  const apiToPageReview = (r: ReviewItem): Review => ({
    id: r.id,
    userId: r.userId,
    userName: r.reviewerName || "You",
    userAvatar: r.reviewerAvatar || undefined,
    poiId: r.poiId,
    poiName: r.poiName || "Place",
    rating: r.rating,
    title: r.title,
    content: r.content,
    date: (r.createdAt ?? "").split("T")[0],
    visitDate: (r.visitDate ?? "").split("T")[0],
    helpful: r.helpful,
    notHelpful: 0,
    verified: r.verified,
    photos: r.photos,
    location: "",
    travelType: "",
    userReaction: null,
  });

  const myReviews = (): Review[] => (userReviewsQuery.data ?? []).map(apiToPageReview);

  // Global "All Reviews" feed from GetRecentReviews.
  const allReviews = (): Review[] => (recentReviewsQuery.data ?? []).map(apiToPageReview);

  // Retained sample for the global "All Reviews" feed until GetRecentReviews
  // ships (see deploy/OPS.md known follow-ups).
  const _sampleMyReviews: Review[] = [
    {
      id: "my-rev-1",
      userId: "current-user",
      userName: "You",

      poiId: "poi-4",
      poiName: "Jardins do Palácio de Cristal",
      rating: 4,
      title: "Peaceful gardens with amazing views",
      content:
        "These gardens are a hidden gem in Porto. Perfect for a relaxing walk with stunning views over the Douro River. The peacocks roaming freely add to the charm. Great spot for a picnic or just to escape the city crowds.",
      date: "2024-01-12",
      visitDate: "2024-01-09",
      helpful: 12,
      notHelpful: 1,
      verified: true,
      photos: ["my-photo1.jpg"],
      location: "Porto, Portugal",
      travelType: "solo",
      userReaction: null,
    },
  ];
  void _sampleMyReviews;

  const ratingFilters = () => [
    { value: "all", label: "All Ratings", count: reviews().length },
    { value: "5", label: "5 Stars", count: 2 },
    { value: "4", label: "4 Stars", count: 1 },
    { value: "3", label: "3 Stars", count: 1 },
    { value: "2", label: "2 Stars", count: 0 },
    { value: "1", label: "1 Star", count: 0 },
  ];

  const travelTypeFilters = [
    { value: "all", label: "All Travel Types" },
    { value: "solo", label: "Solo Travel" },
    { value: "couple", label: "Couple" },
    { value: "family", label: "Family" },
    { value: "friends", label: "Friends" },
    { value: "business", label: "Business" },
  ];

  const sortOptions = [
    { value: "recent", label: "Most Recent" },
    { value: "helpful", label: "Most Helpful" },
    { value: "rating", label: "Highest Rating" },
  ];

  const tabs = () => [
    { id: "all", label: "All Reviews", count: allReviews().length },
    { id: "my-reviews", label: "My Reviews", count: myReviews().length },
    { id: "places", label: "Places to Review", count: 3 },
  ];

  // Filter and sort reviews
  const filteredReviews = () => {
    let filtered = [...(activeTab() === "my-reviews" ? myReviews() : allReviews())];

    // Search filter
    if (searchQuery()) {
      const query = searchQuery().toLowerCase();
      filtered = filtered.filter(
        (review) =>
          review.poiName.toLowerCase().includes(query) ||
          review.title.toLowerCase().includes(query) ||
          review.content.toLowerCase().includes(query) ||
          review.userName.toLowerCase().includes(query),
      );
    }

    // Rating filter
    if (selectedRating() !== "all") {
      filtered = filtered.filter((review) => review.rating === parseInt(selectedRating()));
    }

    // Travel type filter
    if (selectedTravelType() !== "all") {
      filtered = filtered.filter((review) => review.travelType === selectedTravelType());
    }

    // Sort
    const currentSortBy = sortBy();
    const currentSortOrder = sortOrder();

    filtered.sort((a, b) => {
      let aVal, bVal;
      switch (currentSortBy) {
        case "helpful":
          aVal = a.helpful;
          bVal = b.helpful;
          break;
        case "rating":
          aVal = a.rating;
          bVal = b.rating;
          break;
        case "recent":
        default:
          aVal = new Date(a.date);
          bVal = new Date(b.date);
          break;
      }

      if (currentSortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  };

  const handleReaction = (reviewId: string, reaction: "helpful" | "not-helpful") => {
    // Persist the helpful/unhelpful vote (best-effort); UI updates optimistically.
    likeReview.mutate({ reviewId, isLike: reaction === "helpful" });
    setReviews((prev) =>
      prev.map((review) => {
        if (review.id === reviewId) {
          const currentReaction = review.userReaction;
          let newHelpful = review.helpful;
          let newNotHelpful = review.notHelpful;

          // Remove previous reaction
          if (currentReaction === "helpful") newHelpful--;
          if (currentReaction === "not-helpful") newNotHelpful--;

          // Add new reaction if different
          let newReaction: "helpful" | "not-helpful" | null = null;
          if (currentReaction !== reaction) {
            newReaction = reaction;
            if (reaction === "helpful") newHelpful++;
            if (reaction === "not-helpful") newNotHelpful++;
          }

          return {
            ...review,
            helpful: newHelpful,
            notHelpful: newNotHelpful,
            userReaction: newReaction,
          };
        }
        return review;
      }),
    );
  };

  const handleSubmitReview = async (reviewData: any) => {
    // Persist via ReviewService; the My Reviews query refetches on success.
    try {
      await createReview.mutateAsync({
        poiId: reviewData.poiId,
        rating: reviewData.rating,
        title: reviewData.title,
        content: reviewData.content,
        photoUrls: reviewData.photos,
      });
      capture("review_submitted", {
        rating: reviewData.rating,
        has_photos: reviewData.photos.length > 0,
        travel_type: reviewData.travelType || undefined,
      });
    } catch (err) {
      console.error("Failed to submit review:", err);
    }

    const newReview = {
      id: `rev-${Date.now()}`,
      userId: "current-user",
      userName: "You",
      //userAvatar: undefined,
      poiId: reviewData.poiId,
      poiName: selectedPlace()?.name || "Unknown Place",
      rating: reviewData.rating,
      title: reviewData.title,
      content: reviewData.content,
      date: new Date().toISOString().split("T")[0],
      visitDate: reviewData.visitDate,
      helpful: 0,
      notHelpful: 0,
      verified: true,
      photos: reviewData.photos || [],
      location: selectedPlace()?.location || "",
      travelType: reviewData.travelType,
      userReaction: null,
    };

    setReviews((prev) => [newReview, ...prev]);
    setShowReviewForm(false);
    setSelectedPlace(null);
  };

  const renderPlacesToReview = () => {
    const places = [
      { id: "poi-5", name: "Palácio da Bolsa", location: "Porto, Portugal" },
      { id: "poi-6", name: "Torre dos Clérigos", location: "Porto, Portugal" },
      { id: "poi-7", name: "Mercado do Bolhão", location: "Porto, Portugal" },
    ];

    return (
      <div class="space-y-4">
        <p class="text-muted-foreground mb-6">
          Help other travelers by reviewing places you've visited
        </p>
        <For each={places}>
          {(place) => (
            <div class="cb-card hover:shadow-md transition-all duration-200">
              <div class="p-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-12 h-12 bg-muted/50 border border-border rounded-lg flex items-center justify-center">
                    🏛️
                  </div>
                  <div>
                    <h3 class="font-semibold text-foreground">{place.name}</h3>
                    <p class="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin class="w-3 h-3" />
                      {place.location}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setSelectedPlace(place);
                    setShowReviewForm(true);
                  }}
                  class="gap-2"
                >
                  <Plus class="w-4 h-4" />
                  Write Review
                </Button>
              </div>
            </div>
          )}
        </For>
      </div>
    );
  };

  return (
    <div class="min-h-screen bg-background relative transition-colors">
      {/* Header */}
      <div class="bg-card border-b border-border">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 class="text-2xl font-bold text-foreground">Reviews</h1>
              <p class="text-muted-foreground mt-1">Read and share travel experiences</p>
            </div>
            <Button onClick={() => setShowReviewForm(true)} class="gap-2">
              <Plus class="w-4 h-4" />
              Write Review
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div class="bg-card border-b border-border">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex space-x-8">
            <For each={tabs()}>
              {(tab) => (
                <button
                  onClick={() => setActiveTab(tab.id)}
                  class={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab() === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              )}
            </For>
          </div>
        </div>
      </div>

      {/* Filters - Only show for all reviews and my reviews */}
      <Show when={activeTab() !== "places"}>
        <div class="bg-card border-b border-border">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div class="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Search */}
              <div class="relative flex-1 max-w-md">
                <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 z-10" />
                <TextFieldRoot class="w-full">
                  <TextField
                    type="text"
                    placeholder="Search reviews..."
                    value={searchQuery()}
                    onInput={(e) => setSearchQuery(e.currentTarget.value)}
                    class="pl-10"
                  />
                </TextFieldRoot>
              </div>

              {/* Rating filter */}
              <select
                value={selectedRating()}
                onChange={(e) => setSelectedRating(e.target.value)}
                class="px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
              >
                <For each={ratingFilters()}>
                  {(filter) => (
                    <option value={filter.value}>
                      {filter.label} {filter.count !== undefined && `(${filter.count})`}
                    </option>
                  )}
                </For>
              </select>

              {/* Travel type filter */}
              <select
                value={selectedTravelType()}
                onChange={(e) => setSelectedTravelType(e.target.value)}
                class="px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
              >
                <For each={travelTypeFilters}>
                  {(filter) => <option value={filter.value}>{filter.label}</option>}
                </For>
              </select>

              {/* Sort */}
              <div class="flex items-center gap-2">
                <select
                  value={sortBy()}
                  onChange={(e) => setSortBy(e.target.value)}
                  class="px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                >
                  <For each={sortOptions}>
                    {(option) => <option value={option.value}>{option.label}</option>}
                  </For>
                </select>
                <button
                  onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                  class="p-2 border border-border rounded-lg bg-card hover:bg-muted text-muted-foreground"
                >
                  {sortOrder() === "asc" ? (
                    <SortAsc class="w-4 h-4" />
                  ) : (
                    <SortDesc class="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Content */}
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Show when={activeTab() === "places"}>{renderPlacesToReview()}</Show>

        <Show when={activeTab() !== "places"}>
          <Show
            when={filteredReviews().length > 0}
            fallback={
              <Show
                when={
                  (activeTab() === "my-reviews" && userReviewsQuery.isError) ||
                  (activeTab() === "all" && recentReviewsQuery.isError)
                }
                fallback={
                  <div class="text-center py-12">
                    <Star class="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                    <h3 class="text-lg font-semibold text-foreground mb-2">No reviews found</h3>
                    <p class="text-muted-foreground mb-4">
                      {activeTab() === "my-reviews"
                        ? "You haven't written any reviews yet"
                        : "No reviews match your current filters"}
                    </p>
                    <Show when={activeTab() === "my-reviews"}>
                      <Button onClick={() => setShowReviewForm(true)}>
                        Write Your First Review
                      </Button>
                    </Show>
                  </div>
                }
              >
                <ErrorView
                  error={activeTab() === "all" ? recentReviewsQuery.error : userReviewsQuery.error}
                  onRetry={() =>
                    activeTab() === "all"
                      ? recentReviewsQuery.refetch()
                      : userReviewsQuery.refetch()
                  }
                  class="my-6"
                />
              </Show>
            }
          >
            <div class="space-y-6">
              <For each={filteredReviews()}>
                {(review) => (
                  <ReviewCard
                    review={review}
                    onReaction={handleReaction}
                    onFlag={(reviewId) => console.log("Flag review:", reviewId)}
                    onReply={(reviewId) => console.log("Reply to review:", reviewId)}
                  />
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>

      {/* Review Form Modal */}
      <ReviewForm
        isOpen={showReviewForm()}
        poiId={selectedPlace()?.id}
        poiName={selectedPlace()?.name}
        onSubmit={handleSubmitReview}
        onCancel={() => {
          setShowReviewForm(false);
          setSelectedPlace(null);
        }}
      />
    </div>
  );
}
