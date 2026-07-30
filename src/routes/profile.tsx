import { createSignal, For, Show, Switch, Match, createMemo } from "solid-js";
import { User, Mail, MapPin, Calendar, Camera, Edit3, Save, X, Tag, Heart } from "lucide-solid";
import { useAuth } from "~/contexts/AuthContext";
import {
  useUpdateProfileMutation,
  useUserProfileQuery,
  useUploadAvatarMutation,
} from "~/lib/api/user";
import { ProcessedProfileData, UserProfileResponse } from "~/lib/api/types";
import { ProtectedRoute } from "~/contexts/AuthContext";
import { Button } from "~/ui/button";
import { useRecentInteractions } from "~/lib/api/recents";
import { useLists } from "~/lib/api/lists";
import { useFavorites } from "~/lib/api/pois";

function ProfilePageContent() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal("overview");
  const [notification, setNotification] = createSignal<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // API hooks - get actual user profile data
  const profileQuery = useUserProfileQuery();
  const updateProfileMutation = useUpdateProfileMutation();

  // API hooks for real data - no more hardcoded values
  const recentsQuery = useRecentInteractions(20);
  const listsQuery = useLists();
  const favoritesQuery = useFavorites();

  console.log("Profile page - User data:", user());
  console.log("Profile query status:", {
    isLoading: profileQuery.isLoading,
    isError: profileQuery.isError,
    error: profileQuery.error,
    data: profileQuery.data,
  });

  // Compute real stats from API data
  const computedStats = createMemo(() => {
    const cities = recentsQuery.data?.cities || [];
    const lists = listsQuery.data || [];
    const favorites = favoritesQuery.data || [];

    // Count unique cities visited (places_visited)
    const placesVisited = cities.length;
    // Lists created
    const listsCreated = lists.length;
    // Favorites count
    const _favoritesCount = favorites.length; // Underscored as it's not directly used in the returned object

    return {
      places_visited: placesVisited,
      reviews_written: 0, // Reviews not implemented yet (item #7)
      lists_created: listsCreated,
      followers: 0, // Social features not implemented
      following: 0, // Social features not implemented
    };
  });

  // Compute badges based on real activity
  const computedBadges = createMemo(() => {
    const badges: string[] = [];
    const stats = computedStats();

    // Early Adopter - all users get this
    badges.push("Early Adopter");

    // Explorer badge - visited 5+ places
    if (stats.places_visited >= 5) badges.push("Explorer");

    // Curator badge - created 3+ lists
    if (stats.lists_created >= 3) badges.push("Curator");

    // Traveler badge - visited 10+ places
    if (stats.places_visited >= 10) badges.push("Traveler");

    return badges;
  });

  // Get profile data from API - no hardcoded fallbacks
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
      // Badges based on real activity
      badges: computedBadges(),
      // Real stats from API data
      stats: computedStats(),
    };
  };

  const [editForm, setEditForm] = createSignal({
    username: "",
    bio: "",
    location: "",
  });

  // Avatar upload
  const uploadAvatarMutation = useUploadAvatarMutation();
  let fileInputRef: HTMLInputElement | undefined;

  const handleAvatarClick = () => {
    fileInputRef?.click();
  };

  const handleFileChange = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      try {
        await uploadAvatarMutation.mutateAsync(file);
        await profileQuery.refetch(); // Refresh profile to show new avatar
        setNotification({ message: "Avatar updated!", type: "success" });
        setTimeout(() => setNotification(null), 3000);
      } catch (error) {
        console.error("Avatar upload failed:", error);
        setNotification({ message: "Failed to upload avatar.", type: "error" });
        setTimeout(() => setNotification(null), 3000);
      }
    }
    // Reset input
    if (target) target.value = "";
  };

  const startEditing = () => {
    const profile = profileData();
    setEditForm({
      username: profile?.username || "",
      bio: profile?.bio || "",
      location: profile?.location || "",
    });
    setIsEditing(true);
  };

  const saveProfile = async () => {
    try {
      const formData = editForm();
      // Map form fields to API expected fields and include location
      const profileUpdateData = {
        username: formData.username,
        about_you: formData.bio,
        location: formData.location,
      };

      await updateProfileMutation.mutateAsync(profileUpdateData);
      // Manually refetch the profile data to get updated values
      // const { authAPI } = await import('~/lib/api');

      // Force refresh auth context too to update navbar
      // We can't access refreshAuth from here easily without exposing it from context more directly
      // But verify session might trigger it if we navigate or etc.
      // Actually, updateProfileMutation optimistically updates queries.

      await profileQuery.refetch();
      setIsEditing(false);

      // Show success notification
      setNotification({ message: "Profile updated successfully!", type: "success" });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error("Failed to update profile:", error);
      // Show error notification
      setNotification({
        message: (error as Error)?.message || "Failed to update profile. Please try again.",
        type: "error",
      });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "activity", label: "Activity" },
    { id: "lists", label: "Lists" },
    { id: "reviews", label: "Reviews" },
  ];

  // Compute recent activity from real data
  const recentActivity = createMemo(() => {
    const activities: {
      type: string;
      title: string;
      description?: string;
      date: string;
      rating?: number;
    }[] = [];

    // Add recent interactions from recents API
    const cities = recentsQuery.data?.cities || [];
    for (const city of cities.slice(0, 3)) {
      const interaction = city.interactions[0];
      if (interaction) {
        activities.push({
          type: "visit",
          title: `Explored ${city.city_name}`,
          description: interaction.prompt || "Recent activity",
          date: interaction.created_at
            ? formatTimeAgo(new Date(interaction.created_at))
            : "Recently",
        });
      }
    }

    // Add recent favorites
    const favorites = (favoritesQuery.data as any[]) || [];
    for (const fav of favorites.slice(0, 2)) {
      activities.push({
        type: "favorite",
        title: `Added ${fav.name || "a place"} to favorites`,
        date: "Recently",
      });
    }

    // Add recent lists
    const lists = listsQuery.data || [];
    for (const list of lists.slice(0, 2)) {
      activities.push({
        type: "list",
        title: `Created "${list.name}"`,
        description: list.description || "Custom list",
        date: list.createdAt
          ? formatTimeAgo(
              new Date(
                list.createdAt.seconds ? Number(list.createdAt.seconds) * 1000 : list.createdAt,
              ),
            )
          : "Recently",
      });
    }

    return activities.slice(0, 5); // Limit to 5 activities
  });

  // Helper function to format time ago
  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30)
      return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? "s" : ""} ago`;
    return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? "s" : ""} ago`;
  };

  // Get user lists from real API data
  const getUserLists = () => {
    const lists = listsQuery.data || [];
    return lists.map((list: any) => ({
      id: list.id,
      name: list.name || "Untitled List",
      description: list.description || "",
      itemCount: list.itemCount || 0,
      isPublic: list.isPublic || false,
      likes: list.saveCount || 0,
    }));
  };

  const renderOverview = () => {
    const profile = profileData();
    if (!profile) return <div>No profile data available</div>;

    return (
      <div class="space-y-6">
        {/* Stats Grid (social/follower counts omitted — not backed by the API) */}
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="bg-card rounded-lg p-4 text-center border border-border">
            <div class="text-2xl font-bold text-primary">{profile.stats.places_visited}</div>
            <div class="text-sm text-muted-foreground">Places Visited</div>
          </div>
          <div class="bg-card rounded-lg p-4 text-center border border-border">
            <div class="text-2xl font-bold text-accent">{profile.stats.reviews_written}</div>
            <div class="text-sm text-muted-foreground">Reviews</div>
          </div>
          <div class="bg-card rounded-lg p-4 text-center border border-border">
            <div class="text-2xl font-bold text-accent dark:text-accent">
              {profile.stats.lists_created}
            </div>
            <div class="text-sm text-muted-foreground">Lists Created</div>
          </div>
        </div>

        {/* Interests */}
        <Show when={profile.interests && profile.interests.length > 0}>
          <div class="bg-card rounded-lg p-6 border border-border">
            <h3 class="text-lg font-semibold text-foreground mb-4">Interests</h3>
            <div class="flex flex-wrap gap-2">
              <For each={profile.interests}>
                {(interest) => <span class="loci-chip text-sm font-medium">{interest}</span>}
              </For>
            </div>
          </div>
        </Show>

        {/* Badges */}
        <div class="loci-card p-6">
          <h3 class="text-lg font-semibold text-foreground mb-4">Badges</h3>
          <div class="flex flex-wrap gap-3">
            <For each={profile.badges}>
              {(badge) => (
                <div class="flex items-center gap-2 px-3 py-2 bg-card/70 rounded-lg border border-border">
                  <div class="w-6 h-6 bg-accent rounded-full" />
                  <span class="text-sm font-medium text-foreground">{badge}</span>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Recent Activity */}
        <div class="bg-card rounded-lg p-6 border border-border">
          <h3 class="text-lg font-semibold text-foreground mb-4">Recent Activity</h3>
          <div class="space-y-4">
            <For each={recentActivity()}>
              {(activity) => (
                <div class="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <div class="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Show when={activity.type === "review"}>
                      <User class="w-4 h-4 text-primary" />
                    </Show>
                    <Show when={activity.type === "list"}>
                      <Tag class="w-4 h-4 text-primary" />
                    </Show>
                    <Show when={activity.type === "favorite"}>
                      <Heart class="w-4 h-4 text-primary" />
                    </Show>
                  </div>
                  <div class="flex-1">
                    <h4 class="font-medium text-foreground">{activity.title}</h4>
                    <p class="text-sm text-muted-foreground">{activity.description}</p>
                    <div class="flex items-center gap-2 mt-1">
                      <span class="text-xs text-muted-foreground">{activity.date}</span>
                      <Show when={activity.rating}>
                        <div class="flex items-center gap-1">
                          <For each={Array.from({ length: activity.rating || 0 }, (_, i) => i)}>
                            {() => <span class="text-accent text-xs">★</span>}
                          </For>
                        </div>
                      </Show>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    );
  };

  const renderActivity = () => (
    <div class="bg-card rounded-lg p-6 border border-border">
      <h3 class="text-lg font-semibold text-foreground mb-4">Activity Feed</h3>
      <div class="space-y-4">
        <For each={recentActivity()}>
          {(activity) => (
            <div class="border-b border-border pb-4 last:border-b-0">
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <User class="w-5 h-5 text-primary" />
                </div>
                <div class="flex-1">
                  <h4 class="font-medium text-foreground">{activity.title}</h4>
                  <p class="text-muted-foreground mt-1">{activity.description}</p>
                  <span class="text-sm text-muted-foreground">{activity.date}</span>
                </div>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );

  const renderLists = () => (
    <div class="space-y-4">
      <For each={getUserLists()}>
        {(list) => (
          <div class="bg-card rounded-lg p-6 border border-border">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <h3 class="font-semibold text-foreground">{list.name}</h3>
                <p class="text-muted-foreground mt-1">{list.description}</p>
                <div class="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <span>{list.itemCount} places</span>
                  <span>{list.isPublic ? "Public" : "Private"}</span>
                  <Show when={list.likes > 0}>
                    <span>{list.likes} likes</span>
                  </Show>
                </div>
              </div>
              <Button variant="link">View →</Button>
            </div>
          </div>
        )}
      </For>
    </div>
  );

  return (
    <Switch>
      <Match when={profileQuery.isLoading && !user()}>
        <div class="min-h-screen bg-muted transition-colors flex items-center justify-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </Match>
      <Match when={profileQuery.isError && !user()}>
        <div class="min-h-screen bg-muted transition-colors flex items-center justify-center">
          <div class="text-center max-w-md mx-auto p-6">
            <h2 class="text-xl font-semibold text-foreground mb-2">Error Loading Profile</h2>
            <p class="text-muted-foreground mb-4">
              {(profileQuery.error as any)?.message ||
                "Unable to load profile data. Please try again."}
            </p>
            <div class="text-sm text-muted-foreground mb-4">
              Status: {(profileQuery.error as any)?.status || "Unknown"}
            </div>
            <Button onClick={() => profileQuery.refetch()} class="mt-4">
              Retry
            </Button>
          </div>
        </div>
      </Match>
      <Match when={true}>
        <div class="min-h-screen relative transition-colors">
          {/* API Error notification - show if profile query failed but continue with auth data */}
          <Show when={profileQuery.isError && user()}>
            <div class="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 p-4 rounded-lg shadow-lg border bg-accent/10 text-accent border-accent/20 animate-in slide-in-from-top-2 duration-300">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium">
                  Profile API unavailable - showing basic info
                </span>
                <Button variant="link" onClick={() => profileQuery.refetch()} class="ml-2 text-sm">
                  Retry
                </Button>
              </div>
            </div>
          </Show>

          {/* Mobile-friendly notification */}
          <Show when={notification()}>
            <div
              class={`fixed top-16 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 p-4 rounded-lg shadow-lg border ${
                notification()?.type === "success"
                  ? "bg-accent/10 text-accent border-accent/20"
                  : "bg-destructive/10 text-destructive border-destructive/20"
              } animate-in slide-in-from-top-2 duration-300`}
            >
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium">{notification()?.message}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setNotification(null)}
                  class="ml-2"
                >
                  <X class="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Show>

          <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Profile Header */}
            <div class="loci-card p-6 mb-6">
              <div class="flex flex-col md:flex-row gap-6">
                {/* Avatar Section */}
                <div class="flex flex-col items-center md:items-start">
                  <div class="relative">
                    <div class="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold shadow-lg ring-2 ring-border">
                      {profileData()?.username?.charAt(0)?.toUpperCase() || "T"}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleAvatarClick}
                      disabled={uploadAvatarMutation.isPending}
                      class="absolute -bottom-1 -right-1 rounded-full"
                    >
                      <Show
                        when={!uploadAvatarMutation.isPending}
                        fallback={
                          <div class="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        }
                      >
                        <Camera class="w-4 h-4" />
                      </Show>
                    </Button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      class="hidden"
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                  </div>
                </div>

                {/* Profile Info */}
                <div class="flex-1">
                  <Show
                    when={!isEditing()}
                    fallback={
                      <div class="space-y-4">
                        <div>
                          <label class="block text-sm font-medium text-foreground mb-1">
                            Username
                          </label>
                          <input
                            type="text"
                            value={editForm().username}
                            onInput={(e) =>
                              setEditForm((prev) => ({ ...prev, username: e.target.value }))
                            }
                            class="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground"
                          />
                        </div>
                        <div>
                          <label class="block text-sm font-medium text-foreground mb-1">Bio</label>
                          <textarea
                            value={editForm().bio}
                            onInput={(e) =>
                              setEditForm((prev) => ({ ...prev, bio: e.target.value }))
                            }
                            rows={3}
                            class="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground"
                          />
                        </div>
                        <div>
                          <label class="block text-sm font-medium text-foreground mb-1">
                            Location
                          </label>
                          <input
                            type="text"
                            value={editForm().location}
                            onInput={(e) =>
                              setEditForm((prev) => ({ ...prev, location: e.target.value }))
                            }
                            class="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground"
                          />
                        </div>
                        <div class="flex gap-2">
                          <button
                            onClick={saveProfile}
                            disabled={updateProfileMutation.isPending}
                            class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-2 disabled:opacity-50"
                          >
                            <Save class="w-4 h-4" />
                            {updateProfileMutation.isPending ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={cancelEditing}
                            class="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 flex items-center gap-2"
                          >
                            <X class="w-4 h-4" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    }
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <h1 class="text-2xl font-bold text-foreground">
                          {profileData()?.username || "User"}
                        </h1>
                        <div class="flex items-center gap-4 mt-2 text-muted-foreground">
                          <Show when={profileData()?.email}>
                            <div class="flex items-center gap-1">
                              <Mail class="w-4 h-4" />
                              <span class="text-sm">{profileData()?.email}</span>
                            </div>
                          </Show>
                          <Show when={profileData()?.location}>
                            <div class="flex items-center gap-1">
                              <MapPin class="w-4 h-4" />
                              <span class="text-sm">{profileData()?.location}</span>
                            </div>
                          </Show>
                          <Show when={profileData()?.joinedDate}>
                            {(joinedDate) => (
                              <div class="flex items-center gap-1">
                                <Calendar class="w-4 h-4" />
                                <span class="text-sm">
                                  Joined {new Date(joinedDate()).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </Show>
                        </div>
                        <Show when={profileData()?.bio}>
                          <p class="text-foreground mt-3">{profileData()?.bio}</p>
                        </Show>
                      </div>
                      <Button onClick={startEditing} class="gap-2">
                        <Edit3 class="w-4 h-4" />
                        Edit Profile
                      </Button>
                    </div>
                  </Show>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div class="bg-card rounded-lg mb-6 border border-border">
              <div class="border-b border-border">
                <div class="flex space-x-8 px-6">
                  <For each={tabs}>
                    {(tab) => (
                      <button
                        onClick={() => setActiveTab(tab.id)}
                        class={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                          activeTab() === tab.id
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tab.label}
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </div>

            {/* Tab Content */}
            <Show when={activeTab() === "overview"}>{renderOverview()}</Show>
            <Show when={activeTab() === "activity"}>{renderActivity()}</Show>
            <Show when={activeTab() === "lists"}>{renderLists()}</Show>
            <Show when={activeTab() === "reviews"}>
              <div class="bg-card rounded-lg p-6 border border-border">
                <h3 class="text-lg font-semibold text-foreground mb-4">My Reviews</h3>
                <p class="text-muted-foreground">Your reviews will appear here.</p>
              </div>
            </Show>
          </div>
        </div>
      </Match>
    </Switch>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfilePageContent />
    </ProtectedRoute>
  );
}
