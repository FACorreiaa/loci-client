import { createEffect, createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import {
  User,
  Tag,
  Heart,
  Users,
  Camera,
  MapPin,
  Calendar,
  Globe,
  Bell,
  ChevronRight,
  X,
  Save,
  Mail,
  Phone,
  Upload,
  KeyRound,
  CreditCard,
  Sparkles,
  ExternalLink,
} from "lucide-solid";
import {
  useUpdateProfileMutation,
  useUploadAvatarMutation,
  useUserProfileQuery,
} from "../../lib/api/user";
import {
  useTags,
  useCreateTagMutation,
  useUpdateTagMutation,
  useDeleteTagMutation,
  useToggleTagActiveMutation,
} from "../../lib/api/tags";
import {
  useInterests,
  useCreateInterestMutation,
  useUpdateInterestMutation,
  useDeleteInterestMutation,
  useToggleInterestActiveMutation,
} from "../../lib/api/interests";
import { ProcessedProfileData, UserProfileResponse } from "~/lib/api/types";
import { useAuth } from "~/contexts/AuthContext";
import TagsComponent from "~/components/features/Settings/Tags";
import InterestsComponent from "~/components/features/Settings/Interests";
import TravelProfiles from "~/components/features/Settings/TravelProfiles";
import AppearanceSettings from "~/components/AppearanceSettings";
import ApiKeys from "~/components/features/Settings/ApiKeys";
import TasteAndPrivacy from "~/components/features/Settings/TasteAndPrivacy";
import AccountData from "~/components/features/Settings/AccountData";
import { Button } from "~/ui/button";

export default function SettingsPage() {
  const { user } = useAuth();
  const [notification, setNotification] = createSignal<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [activeTab, setActiveTab] = createSignal("settings");
  const uploadAvatarMutation = useUploadAvatarMutation();
  const profileQuery = useUserProfileQuery();
  const updateProfileMutation = useUpdateProfileMutation();

  // Tags API hooks
  const tagsQuery = useTags();
  const createTagMutation = useCreateTagMutation();
  const updateTagMutation = useUpdateTagMutation();
  const deleteTagMutation = useDeleteTagMutation();
  const toggleTagActiveMutation = useToggleTagActiveMutation();

  // Interests API hooks
  const interestsQuery = useInterests();
  const createInterestMutation = useCreateInterestMutation();
  const updateInterestMutation = useUpdateInterestMutation();
  const deleteInterestMutation = useDeleteInterestMutation();
  const toggleInterestActiveMutation = useToggleInterestActiveMutation();
  const [userProfile, setUserProfile] = createSignal({
    username: "",
    firstname: "",
    lastname: "",
    email: "",
    phone: "", // Optional: keep if API supports it, omit if not
    city: "",
    country: "",
    bio: "",
    avatar: "",
  });

  const userData = user();

  createEffect(() => {
    const apiData = profileQuery.data;
    if (!apiData && !userData) return null;
    console.log("userData", userData);
    console.log("apiData", apiData);

    if (apiData) {
      setUserProfile({
        username: apiData.username || userData?.username || "",
        firstname: apiData.firstname || userData?.firstname || "",
        lastname: apiData.lastname || userData?.lastname || "",
        email: apiData.email || userData?.email || "",
        phone: apiData.phone || "", // Optional: include if API provides it
        city: apiData.city || userData?.city || "",
        country: apiData.country || userData?.country || "",
        bio: apiData.about_you || userData?.about_you || "",
        avatar: apiData.profile_image_url || userData?.profile_image_url || "",
      });
    }
  });

  const saveProfile = async () => {
    try {
      const profileData = userProfile();
      const profileUpdateData = {
        firstname: profileData.firstname,
        lastname: profileData.lastname,
        email: profileData.email,
        phone: profileData.phone,
        city: profileData.city,
        country: profileData.country,
        about_you: profileData.bio,
        // Note: avatar is handled separately via uploadAvatarMutation
      };

      await updateProfileMutation.mutateAsync(profileUpdateData);
      await profileQuery.refetch(); // Sync UI with backend

      // Show success notification
      setNotification({ message: "Settings saved successfully!", type: "success" });
      setTimeout(() => setNotification(null), 3000);
    } catch (error: any) {
      console.error("Failed to update profile:", error);
      // Show error notification
      setNotification({
        message: error?.message || "Failed to save settings. Please try again.",
        type: "error",
      });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const profileData = (): ProcessedProfileData | null => {
    const apiData: UserProfileResponse | undefined = profileQuery.data;
    const userData = user();

    if (!apiData && !userData) return null;

    return {
      id: apiData?.id || userData?.id,
      username: apiData?.username || userData?.username,
      email: userData?.email || apiData?.email,
      bio: apiData?.about_you || (userData as any)?.about_you,
      location: apiData?.location || (userData as any)?.location,
      joinedDate: apiData?.created_at || userData?.created_at,
      avatar: apiData?.profile_image_url || userData?.profile_image_url,
      interests: apiData?.interests || ["Architecture", "Food & Dining", "Museums", "Photography"],
      // Temporary hardcoded data for UI purposes
      badges: ["Early Adopter", "Review Writer", "Local Guide"],
      stats: {
        places_visited: 47,
        reviews_written: 23,
        lists_created: 8,
        followers: 156,
        following: 89,
      },
    };
  };

  const [photoPreview, setPhotoPreview] = createSignal<string | null>(null);
  const [isUploading, setIsUploading] = createSignal(false);

  const tabs = [
    { id: "settings", label: "Settings", icon: User },
    { id: "tags", label: "Tags", icon: Tag },
    { id: "interests", label: "Interests", icon: Heart },
    { id: "profiles", label: "Travel Profiles", icon: Users },
    // MCP lives inside the API-keys panel (endpoint + setup guide), so name the
    // tab after both rather than duplicating the panel.
    { id: "apikeys", label: "MCP & API Keys", icon: KeyRound },
    { id: "billing", label: "Plan & Billing", icon: CreditCard },
  ];

  // Get tags from API
  const tags = () => tagsQuery.data || [];

  // Get interests from API
  const interests = () => interestsQuery.data || [];

  const updateProfile = (field: any, value: any) => {
    setUserProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setPhotoPreview(e.target?.result as string);
      reader.readAsDataURL(file);
      uploadPhoto(file);
    } else {
      setNotification({ message: "Please select a valid image file", type: "error" });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const uploadPhoto = async (file: File) => {
    setIsUploading(true);
    try {
      const result = (await uploadAvatarMutation.mutateAsync(file)) as { avatar_url: string };
      //updateProfile('avatar', result.avatar_url);
      setUserProfile((prev) => ({ ...prev, avatar: result.avatar_url }));
      await profileQuery.refetch();

      // Show success notification
      setNotification({ message: "Profile photo updated successfully!", type: "success" });
      setTimeout(() => setNotification(null), 3000);
    } catch (error: any) {
      console.error("Photo upload failed:", error);
      setNotification({
        message: error?.message || "Photo upload failed. Please try again.",
        type: "error",
      });
      setTimeout(() => setNotification(null), 5000);
      setPhotoPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileInput = () => {
    const fileInput = document.getElementById("photo-upload") as HTMLInputElement;
    fileInput?.click();
  };

  const renderSettings = () => {
    const profile = profileData();

    return (
      <div class="space-y-6">
        <div class="loci-hero">
          <div class="loci-hero__content p-6 sm:p-8 flex flex-col lg:flex-row gap-6 lg:items-center">
            <div class="flex flex-1 items-start gap-4">
              <div class="relative">
                <div class="absolute -inset-1 hero-glow blur-lg opacity-80" />
                <Show
                  when={photoPreview() || userProfile().avatar}
                  fallback={
                    <div class="loci-hero__icon w-16 h-16 sm:w-20 sm:h-20 rounded-2xl text-xl sm:text-2xl font-bold">
                      {(userProfile().firstname[0] || "") + (userProfile().lastname[0] || "") ||
                        userProfile().username[0] ||
                        ""}
                    </div>
                  }
                >
                  <img
                    src={photoPreview() || userProfile().avatar}
                    alt="Profile"
                    class="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-2 ring-[hsl(var(--hero-foreground)/0.5)] shadow-xl"
                  />
                </Show>
                <button
                  onClick={triggerFileInput}
                  disabled={isUploading()}
                  class="loci-hero__cta absolute -bottom-2 -right-2 text-xs px-3 py-1 rounded-xl shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-60"
                >
                  <Show
                    when={isUploading()}
                    fallback={
                      <span class="flex items-center gap-1">
                        <Upload class="w-3 h-3" />
                        Update
                      </span>
                    }
                  >
                    <span class="flex items-center gap-1">
                      <div class="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Uploading
                    </span>
                  </Show>
                </button>
              </div>
              <div class="space-y-2">
                <div class="flex items-center gap-3">
                  <h1 class="text-2xl sm:text-3xl font-bold leading-tight">
                    {profile?.username || "Traveler"}
                  </h1>
                  <span class="loci-chip uppercase tracking-wide text-[10px] sm:text-xs">
                    Profile
                  </span>
                </div>
                <div class="flex flex-wrap gap-2 text-sm">
                  <Show when={profile?.email}>
                    <span class="loci-chip">
                      <Mail class="w-4 h-4" /> {profile?.email}
                    </span>
                  </Show>
                  <Show when={profile?.location || userProfile().city || userProfile().country}>
                    <span class="loci-chip">
                      <MapPin class="w-4 h-4" />{" "}
                      {profile?.location ||
                        `${userProfile().city}${userProfile().country ? `, ${userProfile().country}` : ""}`}
                    </span>
                  </Show>
                  <Show when={profile?.joinedDate}>
                    <span class="loci-chip">
                      <Calendar class="w-4 h-4" /> Joined{" "}
                      {new Date(profile?.joinedDate || "").toLocaleDateString()}
                    </span>
                  </Show>
                </div>
                <p class="text-sm loci-hero__subtitle max-w-2xl">
                  {profile?.bio ||
                    "Fine‑tune your profile so the AI tailors recommendations to your vibe."}
                </p>
              </div>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:w-auto">
              <div class="loci-hero__stat">
                <div class="loci-hero__stat-label">Tags</div>
                <div class="text-2xl font-bold">{tags().length || 0}</div>
                <div class="loci-hero__stat-detail">Personalized filters</div>
              </div>
              <div class="loci-hero__stat">
                <div class="loci-hero__stat-label">Interests</div>
                <div class="text-2xl font-bold">{interests().length || 0}</div>
                <div class="loci-hero__stat-detail">Signals for the AI</div>
              </div>
              <div class="loci-hero__stat col-span-2 sm:col-span-1">
                <div class="loci-hero__stat-label">Profiles</div>
                <div class="text-2xl font-bold">{profile?.stats?.lists_created ?? 1}</div>
                <div class="loci-hero__stat-detail">Trip styles saved</div>
              </div>
            </div>
          </div>
        </div>

        <div class="mb-6">
          <TasteAndPrivacy />
        </div>

        <div class="mb-6">
          <AccountData />
        </div>

        <div class="grid lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2 space-y-6">
            {/* Personal Information */}
            <div class="loci-card rounded-3xl p-6 sm:p-8">
              <div class="flex items-start justify-between mb-4">
                <div>
                  <h3 class="text-lg sm:text-xl font-semibold text-foreground">
                    Personal Information
                  </h3>
                  <p class="text-sm text-muted-foreground">
                    Keep your profile details sharp so teammates and the AI know who you are.
                  </p>
                </div>
                <Button
                  onClick={saveProfile}
                  disabled={updateProfileMutation.isPending}
                  class="gap-2"
                >
                  <Save class="w-4 h-4" />
                  {updateProfileMutation.isPending ? "Saving..." : "Save changes"}
                </Button>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div class="sm:col-span-2 pb-2">
                  <label class="block text-xs sm:text-sm font-semibold text-foreground mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={userProfile().username}
                    onInput={(e) => updateProfile("username", e.target.value)}
                    class="w-full px-3 sm:px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-ring focus:border-transparent text-sm sm:text-base bg-background text-foreground shadow-inner"
                    placeholder="Your public handle"
                  />
                </div>
                <div class="pb-2">
                  <label class="block text-xs sm:text-sm font-semibold text-foreground mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={userProfile().firstname}
                    onInput={(e) => updateProfile("firstname", e.target.value)}
                    class="w-full px-3 sm:px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-ring focus:border-transparent text-sm sm:text-base bg-background text-foreground shadow-inner"
                    placeholder="Jane"
                  />
                </div>
                <div class="pb-2">
                  <label class="block text-xs sm:text-sm font-semibold text-foreground mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={userProfile().lastname}
                    onInput={(e) => updateProfile("lastname", e.target.value)}
                    class="w-full px-3 sm:px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-ring focus:border-transparent text-sm sm:text-base bg-background text-foreground shadow-inner"
                    placeholder="Doe"
                  />
                </div>
                <div class="pb-2">
                  <label class="block text-xs sm:text-sm font-semibold text-foreground mb-2">
                    Email
                  </label>
                  <div class="relative">
                    <Mail class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <input
                      type="email"
                      value={userProfile().email}
                      onInput={(e) => updateProfile("email", e.target.value)}
                      class="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-ring focus:border-transparent text-sm sm:text-base bg-background text-foreground shadow-inner"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
                <div class="pb-2">
                  <label class="block text-xs sm:text-sm font-semibold text-foreground mb-2">
                    Phone
                  </label>
                  <div class="relative">
                    <Phone class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <input
                      type="tel"
                      value={userProfile().phone}
                      onInput={(e) => updateProfile("phone", e.target.value)}
                      class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-ring focus:border-transparent text-sm sm:text-base bg-background text-foreground shadow-inner"
                      placeholder="+1 555 123 4567"
                    />
                  </div>
                </div>
                <div class="pb-2">
                  <label class="block text-xs sm:text-sm font-semibold text-foreground mb-2">
                    City
                  </label>
                  <div class="relative">
                    <MapPin class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <input
                      type="text"
                      value={userProfile().city}
                      onInput={(e) => updateProfile("city", e.target.value)}
                      class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-ring focus:border-transparent text-sm sm:text-base bg-background text-foreground shadow-inner"
                      placeholder="Barcelona"
                    />
                  </div>
                </div>
                <div class="pb-2">
                  <label class="block text-xs sm:text-sm font-semibold text-foreground mb-2">
                    Country
                  </label>
                  <div class="relative">
                    <Globe class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <input
                      type="text"
                      value={userProfile().country}
                      onInput={(e) => updateProfile("country", e.target.value)}
                      class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-ring focus:border-transparent text-sm sm:text-base bg-background text-foreground shadow-inner"
                      placeholder="Spain"
                    />
                  </div>
                </div>
                <div class="sm:col-span-2 pb-2">
                  <label class="block text-xs sm:text-sm font-semibold text-foreground mb-2">
                    Bio
                  </label>
                  <textarea
                    value={userProfile().bio}
                    onInput={(e) => updateProfile("bio", e.target.value)}
                    rows={3}
                    class="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-ring focus:border-transparent text-sm sm:text-base bg-background text-foreground shadow-inner"
                    placeholder="Tell us about your travel interests..."
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-6">
            <div class="loci-card rounded-3xl p-6 sm:p-8">
              <div class="flex items-center justify-between mb-3">
                <div>
                  <p class="text-xs uppercase tracking-wide text-muted-foreground">
                    Profile strength
                  </p>
                  <h4 class="text-lg font-semibold text-foreground">Completion</h4>
                </div>
                <div class="px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold border border-accent/20">
                  Smart Fill
                </div>
              </div>
              <div class="w-full h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-primary via-primary to-accent"
                  style={{ width: "78%" }}
                />
              </div>
              <p class="text-xs text-muted-foreground mt-2">
                Complete your details and tune interests/tags for sharper recommendations.
              </p>
            </div>

            <div class="loci-card rounded-3xl p-6 sm:p-8">
              <h4 class="text-lg font-semibold text-foreground mb-1">Appearance</h4>
              <p class="text-sm text-muted-foreground mb-4">
                Theme and language sync across your devices when signed in.
              </p>
              <AppearanceSettings />
            </div>

            <div class="loci-card rounded-3xl p-6 sm:p-8 space-y-3">
              <div class="flex items-center gap-2">
                <Bell class="w-5 h-5 text-primary" />
                <h4 class="text-sm font-semibold text-foreground">Quick actions</h4>
              </div>
              <div class="grid grid-cols-1 gap-2">
                <button
                  onClick={triggerFileInput}
                  class="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-background text-foreground border border-border hover:border-accent hover:shadow-sm transition-all"
                >
                  <span class="flex items-center gap-2 text-sm font-medium">
                    <Camera class="w-4 h-4 text-primary" /> Update profile photo
                  </span>
                  <ChevronRight class="w-4 h-4 text-muted-foreground" />
                </button>
                <button
                  onClick={() => setActiveTab("tags")}
                  class="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-background text-foreground border border-border hover:border-accent hover:shadow-sm transition-all"
                >
                  <span class="flex items-center gap-2 text-sm font-medium">
                    <Tag class="w-4 h-4 text-primary" /> Curate tags
                  </span>
                  <ChevronRight class="w-4 h-4 text-muted-foreground" />
                </button>
                <button
                  onClick={() => setActiveTab("interests")}
                  class="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-background text-foreground border border-border hover:border-accent hover:shadow-sm transition-all"
                >
                  <span class="flex items-center gap-2 text-sm font-medium">
                    <Heart class="w-4 h-4 text-primary" /> Update interests
                  </span>
                  <ChevronRight class="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>
        </div>
        <input
          id="photo-upload"
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          class="hidden"
        />
      </div>
    );
  };

  const handleCreateTag = async (data: any) => {
    await createTagMutation.mutateAsync(data);
    setNotification({ message: "Tag created successfully!", type: "success" });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleUpdateTag = async (data: any) => {
    await updateTagMutation.mutateAsync(data);
    setNotification({ message: "Tag updated successfully!", type: "success" });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeleteTag = async (tag: any) => {
    if (tag.source === "global") {
      setNotification({
        message: "Global tags cannot be deleted.",
        type: "error",
      });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    if (confirm(`Are you sure you want to delete the tag "${tag.name}"?`)) {
      await deleteTagMutation.mutateAsync(tag.id);
      setNotification({ message: "Tag deleted successfully!", type: "success" });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleToggleTag = async (tag: any) => {
    const currentActive = tag.active ?? false;
    await toggleTagActiveMutation.mutateAsync({
      id: tag.id,
      active: !currentActive,
    });
    setNotification({
      message: `Tag ${!currentActive ? "activated" : "deactivated"} successfully!`,
      type: "success",
    });
    setTimeout(() => setNotification(null), 3000);
  };

  const renderTags = () => {
    return (
      <TagsComponent
        tags={tags()}
        isLoading={tagsQuery.isLoading}
        isError={tagsQuery.isError}
        onRetry={() => tagsQuery.refetch()}
        onCreateTag={handleCreateTag}
        onUpdateTag={handleUpdateTag}
        onDeleteTag={handleDeleteTag}
        onToggleActive={handleToggleTag}
        isCreating={createTagMutation.isPending}
        isUpdating={updateTagMutation.isPending}
        isDeleting={deleteTagMutation.isPending}
        isToggling={toggleTagActiveMutation.isPending}
      />
    );
  };

  const handleCreateInterest = async (data: any) => {
    await createInterestMutation.mutateAsync(data);
    setNotification({ message: "Interest created successfully!", type: "success" });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleUpdateInterest = async (data: any) => {
    await updateInterestMutation.mutateAsync(data);
    setNotification({ message: "Interest updated successfully!", type: "success" });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeleteInterest = async (interest: any) => {
    if (interest.source === "global") {
      setNotification({
        message: "Global interests cannot be deleted.",
        type: "error",
      });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    if (confirm(`Are you sure you want to delete the interest "${interest.name}"?`)) {
      await deleteInterestMutation.mutateAsync(interest.id);
      setNotification({ message: "Interest deleted successfully!", type: "success" });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleToggleInterest = async (interest: any) => {
    const currentActive = interest.active ?? false;
    await toggleInterestActiveMutation.mutateAsync({
      id: interest.id,
      active: !currentActive,
    });
    setNotification({
      message: `Interest ${!currentActive ? "activated" : "deactivated"} successfully!`,
      type: "success",
    });
    setTimeout(() => setNotification(null), 3000);
  };

  const renderInterests = () => {
    return (
      <InterestsComponent
        interests={interests()}
        isLoading={interestsQuery.isLoading}
        isError={interestsQuery.isError}
        onRetry={() => interestsQuery.refetch()}
        onCreateInterest={handleCreateInterest}
        onUpdateInterest={handleUpdateInterest}
        onDeleteInterest={handleDeleteInterest}
        onToggleActive={handleToggleInterest}
        isCreating={createInterestMutation.isPending}
        isUpdating={updateInterestMutation.isPending}
        isDeleting={deleteInterestMutation.isPending}
        isToggling={toggleInterestActiveMutation.isPending}
      />
    );
  };

  const renderProfiles = () => (
    <TravelProfiles
      onNotification={(notification) => {
        setNotification(notification);
        setTimeout(() => setNotification(null), 3000);
      }}
    />
  );

  // Billing has its own full route; settings just needs to be a findable door to
  // it. Plan and pricing were previously unreachable from here, which is what
  // sent people hunting through the nav.
  const renderBilling = () => (
    <div class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold text-foreground">Plan &amp; billing</h2>
        <p class="text-sm text-muted-foreground mt-1">
          Manage your subscription, payment method and invoices, or compare what each plan includes.
        </p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <A
          href="/billing"
          class="loci-card group flex items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:border-primary/40"
        >
          <CreditCard class="w-5 h-5 mt-0.5 text-primary flex-shrink-0" />
          <span class="min-w-0">
            <span class="flex items-center gap-1.5 font-medium text-foreground">
              Manage subscription
              <ExternalLink class="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </span>
            <span class="block text-sm text-muted-foreground mt-0.5">
              Current plan, payment method, invoices and cancellation.
            </span>
          </span>
        </A>

        <A
          href="/pricing"
          class="loci-card group flex items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:border-primary/40"
        >
          <Sparkles class="w-5 h-5 mt-0.5 text-accent flex-shrink-0" />
          <span class="min-w-0">
            <span class="flex items-center gap-1.5 font-medium text-foreground">
              Compare plans
              <ExternalLink class="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </span>
            <span class="block text-sm text-muted-foreground mt-0.5">
              What Pro adds, including higher daily request limits.
            </span>
          </span>
        </A>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab()) {
      case "settings":
        return renderSettings();
      case "tags":
        return renderTags();
      case "interests":
        return renderInterests();
      case "profiles":
        return renderProfiles();
      case "apikeys":
        return <ApiKeys onNotification={(message, type) => setNotification({ message, type })} />;
      case "billing":
        return renderBilling();
      default:
        return renderSettings();
    }
  };

  return (
    <div class="min-h-screen relative bg-background">
      <div class="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_15%_10%,hsl(var(--accent)/0.07),transparent_40%),radial-gradient(circle_at_85%_0%,hsl(var(--primary)/0.06),transparent_32%)]" />
      {/* Mobile-friendly notification */}
      <Show when={notification()}>
        <div
          class={`fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 p-4 rounded-lg shadow-lg border ${
            notification()?.type === "success"
              ? "bg-accent/10 text-accent border-accent/30"
              : "bg-destructive/10 text-destructive border-destructive/30"
          } animate-in slide-in-from-top-2 duration-300`}
        >
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">{notification()?.message}</span>
            <Button variant="ghost" size="icon" onClick={() => setNotification(null)} class="ml-2">
              <X class="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Show>

      <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div class="flex flex-col lg:flex-row gap-4 lg:gap-8">
          {/* Mobile Tab Navigation */}
          <div class="lg:hidden">
            <div class="loci-card rounded-2xl p-2">
              <div class="flex overflow-x-auto space-x-2">
                <For each={tabs}>
                  {(tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        onClick={() => setActiveTab(tab.id)}
                        class={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 whitespace-nowrap border ${
                          activeTab() === tab.id
                            ? "bg-primary text-primary-foreground shadow-lg border-primary/40"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground border-transparent"
                        }`}
                      >
                        <Icon class="w-4 h-4" />
                        {tab.label}
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>
          </div>

          {/* Desktop Tab Navigation */}
          <div class="hidden lg:block w-64 flex-shrink-0">
            <div class="loci-card rounded-2xl p-3 sticky top-8">
              <nav class="space-y-1.5">
                <For each={tabs}>
                  {(tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        onClick={() => setActiveTab(tab.id)}
                        class={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl transition-all duration-200 font-semibold border ${
                          activeTab() === tab.id
                            ? "bg-primary text-primary-foreground shadow-lg border-primary/40"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground border-transparent"
                        }`}
                      >
                        <Icon class="w-5 h-5" />
                        {tab.label}
                      </button>
                    );
                  }}
                </For>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div class="flex-1">{renderTabContent()}</div>
        </div>
      </div>
    </div>
  );
}
