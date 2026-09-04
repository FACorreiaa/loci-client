import { createSignal, Show, For } from "solid-js";
import { Star, Camera, X, Calendar } from "lucide-solid";
import type { PhotoUploadEvent } from "../lib/api/types";
import { Button } from "~/ui/button";
import { TextField, TextFieldRoot } from "~/ui/textfield";
import { TextArea } from "~/ui/textarea";
import { Label } from "~/ui/label";

interface ReviewData {
  rating: number;
  title: string;
  content: string;
  visitDate: string;
  travelType: string;
  photos: File[];
  poiId?: string;
}

interface FormPhoto {
  id: string;
  file: File;
  url: string;
}

interface ReviewFormProps {
  poiId?: string;
  poiName?: string;
  onSubmit: (reviewData: ReviewData) => void;
  onCancel: () => void;
  isOpen: boolean;
}

export default function ReviewForm(props: ReviewFormProps) {
  const [rating, setRating] = createSignal(0);
  const [hoverRating, setHoverRating] = createSignal(0);
  const [title, setTitle] = createSignal("");
  const [content, setContent] = createSignal("");
  const [visitDate, setVisitDate] = createSignal("");
  const [travelType, setTravelType] = createSignal("");
  const [photos, setPhotos] = createSignal<FormPhoto[]>([]);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [errors, setErrors] = createSignal<{ rating?: string; content?: string }>({});

  const travelTypes = [
    { id: "solo", label: "Solo Travel", icon: "🎒" },
    { id: "couple", label: "Couple", icon: "💑" },
    { id: "family", label: "Family", icon: "👨‍👩‍👧‍👦" },
    { id: "friends", label: "Friends", icon: "👥" },
    { id: "business", label: "Business", icon: "💼" },
  ];

  const renderStars = () => {
    return Array.from({ length: 5 }, (_, i) => {
      const starValue = i + 1;
      const filled = starValue <= (hoverRating() || rating());

      return (
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={() => setRating(starValue)}
          onMouseEnter={() => setHoverRating(starValue)}
          onMouseLeave={() => setHoverRating(0)}
          class={filled ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-400"}
        >
          <Star class={`w-8 h-8 ${filled ? "fill-current" : ""}`} />
        </Button>
      );
    });
  };

  const handlePhotoUpload = (event: PhotoUploadEvent) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    const newPhotos: FormPhoto[] = files.map((file, index) => ({
      id: `photo-${Date.now()}-${index}`,
      file,
      url: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...newPhotos]);
  };

  const removePhoto = (photoId: string) => {
    setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
  };

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();

    const validationErrors: { rating?: string; content?: string } = {};
    if (!rating()) {
      validationErrors.rating = "Please select a rating";
    }
    if (!content().trim()) {
      validationErrors.content = "Please write a review";
    } else if (content().trim().length < 10) {
      validationErrors.content = "Review must be at least 10 characters";
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    setIsSubmitting(true);

    try {
      const reviewDataDictionary: ReviewData = {
        poiId: props.poiId,
        rating: rating(),
        title: title().trim(),
        content: content().trim(),
        visitDate: visitDate(),
        travelType: travelType(),
        photos: photos().map((photo) => photo.file),
      };

      await props.onSubmit(reviewDataDictionary);
      resetForm();
    } catch (error) {
      console.error("Error submitting review:", error);
      setErrors({ content: "Failed to submit review. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setRating(0);
    setHoverRating(0);
    setTitle("");
    setContent("");
    setVisitDate("");
    setTravelType("");
    setPhotos([]);
    setErrors({});
  };

  const getRatingLabel = (rating: number): string => {
    const labels: Record<number, string> = {
      1: "Terrible",
      2: "Poor",
      3: "Average",
      4: "Good",
      5: "Excellent",
    };
    return labels[rating] || "";
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div class="bg-popover text-popover-foreground rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-border shadow-lg">
          {/* Header */}
          <div class="p-6 border-b border-border">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-xl font-semibold text-foreground">Write a Review</h2>
                <Show when={props.poiName}>
                  <p class="text-sm text-muted-foreground mt-1">for {props.poiName}</p>
                </Show>
              </div>
              <Button variant="ghost" size="icon" onClick={props.onCancel}>
                <X class="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} class="p-6 space-y-6">
            {/* Rating */}
            <div>
              <Label class="block mb-3">Overall Rating *</Label>
              <div class="flex items-center gap-2">
                <div
                  class={`flex p-1 rounded-lg ${errors().rating ? "ring-2 ring-destructive" : ""}`}
                >
                  {renderStars()}
                </div>
                <Show when={rating() > 0}>
                  <span class="text-lg font-medium text-foreground ml-2">
                    {getRatingLabel(rating())}
                  </span>
                </Show>
              </div>
              <Show when={errors().rating}>
                <p class="mt-1 text-sm text-destructive">{errors().rating}</p>
              </Show>
            </div>

            {/* Title */}
            <TextFieldRoot>
              <Label class="block mb-2">Review Title</Label>
              <TextField
                type="text"
                value={title()}
                onInput={(e) => setTitle(e.currentTarget.value)}
                placeholder="Summarize your experience"
                maxLength={100}
              />
              <p class="text-xs text-muted-foreground mt-1">{title().length}/100 characters</p>
            </TextFieldRoot>

            {/* Content */}
            <TextFieldRoot validationState={errors().content ? "invalid" : "valid"}>
              <Label class="block mb-2">Your Review *</Label>
              <TextArea
                value={content()}
                onInput={(e) => {
                  setContent(e.currentTarget.value);
                  if (errors().content) setErrors({ ...errors(), content: undefined });
                }}
                placeholder="Share your experience, tips, and what made this place special..."
                class={`min-h-[120px] ${errors().content ? "border-destructive focus-visible:ring-destructive" : ""}`}
                maxLength={1000}
              />
              <div class="flex justify-between mt-1">
                <Show when={errors().content} fallback={<span />}>
                  <p class="text-sm text-destructive">{errors().content}</p>
                </Show>
                <p class="text-xs text-muted-foreground">{content().length}/1000 characters</p>
              </div>
            </TextFieldRoot>

            {/* Visit Date */}
            <TextFieldRoot>
              <Label class="block mb-2">When did you visit?</Label>
              <div class="relative">
                <Calendar class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <TextField
                  type="date"
                  value={visitDate()}
                  onInput={(e) => setVisitDate(e.currentTarget.value)}
                  class="pl-10"
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
            </TextFieldRoot>

            {/* Travel Type */}
            <div>
              <Label class="block mb-3">Type of Travel</Label>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <For each={travelTypes}>
                  {(type) => (
                    <label class="relative cursor-pointer">
                      <input
                        type="radio"
                        name="travelType"
                        value={type.id}
                        checked={travelType() === type.id}
                        onChange={() => setTravelType(type.id)}
                        class="sr-only"
                      />
                      <div
                        class={`p-3 border-2 rounded-lg transition-all text-center ${
                          travelType() === type.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-muted-foreground"
                        }`}
                      >
                        <div class="text-xl mb-1">{type.icon}</div>
                        <div class="text-sm font-medium text-foreground">{type.label}</div>
                      </div>
                    </label>
                  )}
                </For>
              </div>
            </div>

            {/* Photos */}
            <div>
              <Label class="block mb-3">Add Photos (Optional)</Label>

              {/* Photo Upload */}
              <div class="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-muted-foreground transition-colors">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  class="hidden"
                  id="photo-upload"
                />
                <label for="photo-upload" class="cursor-pointer">
                  <Camera class="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p class="text-sm text-muted-foreground">
                    <span class="text-primary font-medium">Click to upload</span> or drag and drop
                  </p>
                  <p class="text-xs text-muted-foreground mt-1">PNG, JPG up to 10MB each</p>
                </label>
              </div>

              {/* Photo Preview */}
              <Show when={photos().length > 0}>
                <div class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <For each={photos()}>
                    {(photo) => (
                      <div class="relative group">
                        <img
                          src={photo.url}
                          alt="Review photo"
                          loading="lazy"
                          class="w-full aspect-square object-cover rounded-lg"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          type="button"
                          onClick={() => removePhoto(photo.id)}
                          class="absolute top-2 right-2 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X class="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </form>

          {/* Footer */}
          <div class="p-6 border-t border-border flex items-center justify-between">
            <p class="text-xs text-muted-foreground">
              Your review will be public and help other travelers
            </p>

            <div class="flex items-center gap-3">
              <Button
                variant="secondary"
                type="button"
                onClick={props.onCancel}
                disabled={isSubmitting()}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!rating() || !content().trim() || isSubmitting()}
                onClick={(e) => handleSubmit(e as unknown as SubmitEvent)}
              >
                {isSubmitting() ? (
                  <>
                    <div class="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Review"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
