import { createSignal, createMemo, For, Show } from "solid-js";
import { User, Plus, Edit3, Trash2, Copy, X } from "lucide-solid";
import { Button } from "~/ui/button";
import {
  useSearchProfiles,
  useCreateSearchProfileMutation,
  useUpdateSearchProfileMutation,
  useDeleteSearchProfileMutation,
  useSetDefaultProfileMutation,
} from "~/lib/api/profiles";
import { useInterests } from "~/lib/api/interests";
import { useTags } from "~/lib/api/tags";
import { ProtectedRoute } from "~/contexts/AuthContext";
import type {
  SearchProfile,
  TravelProfileFormData,
  ProfileInterest,
  ProfileTag,
} from "~/lib/api/types";

interface ProfileStats {
  placesVisited: number;
  itinerariesCreated: number;
  avgRating: number;
}

interface Profile {
  id: string;
  name: string;
  description: string;
  interests: ProfileInterest[];
  tags: ProfileTag[];
  budget: string;
  travelStyle: string;
  accessibility: string[];
  isDefault: boolean;
  isPublic: boolean;
  createdAt: string;
  usageCount: number;
  lastUsed: string | null;
  stats: ProfileStats;
}

// The form holds catalogue ids; the cards display names. The two used to be the
// same string, which is how display labels ended up in interest_ids.
interface ProfileForm {
  name: string;
  description: string;
  interests: string[];
  tags: string[];
  budget: string;
  travelStyle: string;
  accessibility: string[];
  isDefault: boolean;
  isPublic: boolean;
}

function ProfilesPageContent() {
  const [selectedProfile, setSelectedProfile] = createSignal<Profile | null>(null);
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [showEditModal, setShowEditModal] = createSignal(false);

  // Profile form state
  const [profileForm, setProfileForm] = createSignal<ProfileForm>({
    name: "",
    description: "",
    interests: [],
    tags: [],
    budget: "medium",
    travelStyle: "balanced",
    accessibility: [],
    isDefault: false,
    isPublic: false,
  });

  // Real profiles from the API (was mock local data).
  const searchProfilesQuery = useSearchProfiles();
  const interestsQuery = useInterests();
  const tagsQuery = useTags();
  const createMut = useCreateSearchProfileMutation();
  const updateMut = useUpdateSearchProfileMutation();
  const deleteMut = useDeleteSearchProfileMutation();
  const setDefaultMut = useSetDefaultProfileMutation();

  const levelToBudget = (n: number) =>
    n <= 1 ? "low" : n === 2 ? "medium" : n === 3 ? "high" : "luxury";
  const budgetToLevel = (b: string) =>
    b === "low" ? 1 : b === "medium" ? 2 : b === "high" ? 3 : b === "luxury" ? 4 : 2;

  // Description, group size, public, usage counts and per-profile stats have no
  // backing on the server. They are not rendered as if they were live data --
  // see the card below, which omits them rather than showing invented zeroes.
  const mapToDisplay = (p: SearchProfile): Profile => ({
    id: p.id,
    name: p.profile_name,
    description: "",
    interests: p.interests ?? [],
    tags: p.tags ?? [],
    budget: levelToBudget(p.budget_level),
    // formToApi writes the travel style into preferred_vibes, so read it back
    // from there. Reading preferred_pace meant the label lookup never matched
    // and the card rendered undefined.
    travelStyle: p.preferred_vibes?.[0] || "balanced",
    accessibility: [
      ...(p.prefer_accessible_pois ? ["Wheelchair Accessible"] : []),
      ...(p.prefer_dog_friendly ? ["Dog Friendly"] : []),
    ],
    isDefault: p.is_default,
    isPublic: false,
    createdAt: p.created_at,
    usageCount: 0,
    lastUsed: null,
    stats: { placesVisited: 0, itinerariesCreated: 0, avgRating: 0 },
  });

  const profiles = createMemo<Profile[]>(() => (searchProfilesQuery.data ?? []).map(mapToDisplay));

  // Map the editor form to the API's create/update input. interests and tags are
  // catalogue ids: the request fields are interest_ids/tag_ids and the server
  // parses them as UUIDs, so sending display names failed the whole call.
  const formToApi = (f: ProfileForm): Partial<TravelProfileFormData> => ({
    profile_name: f.name,
    is_default: f.isDefault,
    budget_level: budgetToLevel(f.budget),
    prefer_accessible_pois: f.accessibility.includes("Wheelchair Accessible"),
    prefer_dog_friendly: f.accessibility.includes("Dog Friendly"),
    preferred_vibes: f.travelStyle ? [f.travelStyle] : [],
    interests: f.interests,
    tags: f.tags,
  });

  // Real catalogues, not hard-coded labels.
  //
  // Only part of each catalogue can be attached to a profile, and the halves are
  // inverted: user_profile_interests references the global `interests` table, so
  // custom interests cannot be linked; user_personal_tags is the only table with
  // a profile_id, so global tags cannot be. Offering the rest would mean the
  // save failing or silently dropping the selection.
  const interestOptions = createMemo(() =>
    (interestsQuery.data ?? [])
      .filter((i) => i.source === "global" && i.active !== false)
      .map((i) => ({ id: i.id, name: i.name })),
  );

  const tagOptions = createMemo(() =>
    (tagsQuery.data ?? [])
      .filter((t) => t.source === "personal" && t.active !== false)
      .map((t) => ({ id: t.id, name: t.name })),
  );

  const budgetOptions = [
    { id: "low", label: "Budget Conscious", description: "Free and low-cost activities" },
    { id: "medium", label: "Moderate Spending", description: "Mix of free and paid experiences" },
    { id: "high", label: "Premium Experience", description: "High-end activities and dining" },
  ];

  const travelStyleOptions = [
    { id: "cultural", label: "Cultural", description: "Museums, history, arts" },
    { id: "culinary", label: "Culinary", description: "Food, restaurants, markets" },
    { id: "adventure", label: "Adventure", description: "Outdoor activities, sports" },
    { id: "relaxed", label: "Relaxed", description: "Peaceful, slow-paced" },
    { id: "family", label: "Family", description: "Family-friendly activities" },
    { id: "balanced", label: "Balanced", description: "Mix of different activities" },
  ];

  const accessibilityOptions = [
    "Wheelchair Accessible",
    "Family Friendly",
    "Dog Friendly",
    "Public Transport",
    "Senior Friendly",
    "Language Support",
  ];

  const createProfile = () => {
    createMut.mutate(formToApi(profileForm()), {
      onSuccess: () => {
        setShowCreateModal(false);
        resetForm();
      },
    });
  };

  const updateProfile = () => {
    const current = selectedProfile();
    if (!current) return;
    updateMut.mutate(
      { profileId: current.id, data: formToApi(profileForm()) },
      {
        onSuccess: () => {
          setShowEditModal(false);
          resetForm();
        },
      },
    );
  };

  const deleteProfile = (profileId: string) => {
    if (confirm("Are you sure you want to delete this profile?")) {
      deleteMut.mutate(profileId);
    }
  };

  const duplicateProfile = (profile: Profile) => {
    createMut.mutate(
      formToApi({
        name: `${profile.name} (Copy)`,
        description: profile.description,
        interests: profile.interests.map((i) => i.id),
        tags: profile.tags.map((t) => t.id),
        budget: profile.budget,
        travelStyle: profile.travelStyle,
        accessibility: profile.accessibility,
        isDefault: false,
        isPublic: profile.isPublic,
      }),
    );
  };

  const setAsDefault = (profileId: string) => {
    setDefaultMut.mutate(profileId);
  };

  const resetForm = () => {
    setProfileForm({
      name: "",
      description: "",
      interests: [],
      tags: [],
      budget: "medium",
      travelStyle: "balanced",
      accessibility: [],
      isDefault: false,
      isPublic: false,
    });
  };

  const openEditModal = (profile: Profile) => {
    setSelectedProfile(profile);
    setProfileForm({
      name: profile.name,
      description: profile.description,
      interests: profile.interests.map((i) => i.id),
      tags: profile.tags.map((t) => t.id),
      budget: profile.budget,
      travelStyle: profile.travelStyle,
      accessibility: [...profile.accessibility],
      isDefault: profile.isDefault,
      isPublic: profile.isPublic,
    });
    setShowEditModal(true);
  };

  const toggleArrayItem = (array: string[], item: string, setter: (newValue: string[]) => void) => {
    if (array.includes(item)) {
      setter(array.filter((i) => i !== item));
    } else {
      setter([...array, item]);
    }
  };

  const getBudgetIcon = (budget: string) => {
    const icons: Record<string, string> = {
      low: "💰",
      medium: "💰💰",
      high: "💰💰💰",
    };
    return icons[budget] || "💰";
  };

  const getTravelStyleIcon = (style: string) => {
    const icons: Record<string, string> = {
      cultural: "🎨",
      culinary: "🍽️",
      adventure: "🏔️",
      relaxed: "🧘",
      family: "👨‍👩‍👧‍👦",
      balanced: "⚖️",
    };
    return icons[style] || "⚖️";
  };

  const renderProfileCard = (profile: Profile) => (
    <div
      class={`cb-card hover:shadow-lg transition-all duration-300 ${profile.isDefault ? "ring-2 ring-primary" : ""}`}
    >
      <div class="p-6">
        {/* Header */}
        <div class="flex items-start justify-between mb-4">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <h3 class="text-lg font-semibold text-foreground">{profile.name}</h3>
              {profile.isDefault && (
                <span class="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                  Default
                </span>
              )}
              {profile.isPublic && (
                <span class="px-2 py-1 bg-accent/10 text-accent rounded-full text-xs font-medium">
                  Public
                </span>
              )}
            </div>
            <p class="text-sm text-muted-foreground">{profile.description}</p>
          </div>

          {/* Actions dropdown */}
          <div class="flex items-center gap-1 ml-4">
            <button
              onClick={() => openEditModal(profile)}
              class="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
              title="Edit profile"
            >
              <Edit3 class="w-4 h-4" />
            </button>
            <button
              onClick={() => duplicateProfile(profile)}
              class="p-2 text-muted-foreground hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
              title="Duplicate profile"
            >
              <Copy class="w-4 h-4" />
            </button>
            <button
              onClick={() => deleteProfile(profile.id)}
              class="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
              title="Delete profile"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Profile details */}
        <div class="space-y-3 mb-4">
          <div class="flex items-center gap-2 text-sm">
            <span class="text-2xl">{getTravelStyleIcon(profile.travelStyle)}</span>
            <span class="font-medium text-muted-foreground">
              {travelStyleOptions.find((s) => s.id === profile.travelStyle)?.label}
            </span>
            <span class="text-muted-foreground">•</span>
            <span class="text-2xl">{getBudgetIcon(profile.budget)}</span>
            <span class="text-muted-foreground">
              {budgetOptions.find((b) => b.id === profile.budget)?.label}
            </span>
          </div>

          <Show when={profile.tags.length > 0}>
            <div class="flex flex-wrap items-center gap-1 text-sm">
              <span class="text-muted-foreground mr-1">Avoids</span>
              <For each={profile.tags.slice(0, 3)}>
                {(tag) => (
                  <span class="px-2 py-1 bg-muted text-muted-foreground rounded-full text-xs">
                    {tag.name}
                  </span>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Interests preview */}
        <div class="mb-4">
          <div class="flex flex-wrap gap-1 mb-2">
            <For each={profile.interests.slice(0, 3)}>
              {(interest) => (
                <span class="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs">
                  {interest.name}
                </span>
              )}
            </For>
            {profile.interests.length > 3 && (
              <span class="px-2 py-1 bg-muted text-muted-foreground rounded-full text-xs">
                +{profile.interests.length - 3} more
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div class="flex items-center justify-between pt-4 border-t border-border">
          <div class="text-xs text-muted-foreground">
            {profile.createdAt ? `Created ${new Date(profile.createdAt).toLocaleDateString()}` : ""}
          </div>
          <div class="flex items-center gap-2">
            {!profile.isDefault && (
              <button
                onClick={() => setAsDefault(profile.id)}
                class="text-xs text-primary hover:text-primary/80 font-medium"
              >
                Set as Default
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderProfileForm = () => (
    <div class="space-y-6">
      {/* Basic Info */}
      <div>
        <label class="block text-sm font-medium text-muted-foreground mb-2">Profile Name</label>
        <input
          type="text"
          value={profileForm().name}
          onInput={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
          class="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
          placeholder="e.g., Solo Explorer, Family Fun"
        />
      </div>

      {/* Travel Style */}
      <div>
        <label class="block text-sm font-medium text-muted-foreground mb-3">Travel Style</label>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <For each={travelStyleOptions}>
            {(style) => (
              <label class="relative cursor-pointer">
                <input
                  type="radio"
                  name="travelStyle"
                  value={style.id}
                  checked={profileForm().travelStyle === style.id}
                  onChange={() => setProfileForm((prev) => ({ ...prev, travelStyle: style.id }))}
                  class="sr-only"
                />
                <div
                  class={`p-3 rounded-lg border-2 transition-all ${
                    profileForm().travelStyle === style.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-border"
                  }`}
                >
                  <div class="text-center">
                    <div class="text-2xl mb-1">{getTravelStyleIcon(style.id)}</div>
                    <div class="text-sm font-medium text-foreground">{style.label}</div>
                    <div class="text-xs text-muted-foreground">{style.description}</div>
                  </div>
                </div>
              </label>
            )}
          </For>
        </div>
      </div>

      {/* Budget */}
      <div>
        <label class="block text-sm font-medium text-muted-foreground mb-3">
          Budget Preference
        </label>
        <div class="space-y-2">
          <For each={budgetOptions}>
            {(budget) => (
              <label class="flex items-center p-3 border border-border rounded-lg cursor-pointer hover:bg-muted">
                <input
                  type="radio"
                  name="budget"
                  value={budget.id}
                  checked={profileForm().budget === budget.id}
                  onChange={() => setProfileForm((prev) => ({ ...prev, budget: budget.id }))}
                  class="text-primary focus:ring-ring"
                />
                <div class="ml-3 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-lg">{getBudgetIcon(budget.id)}</span>
                    <span class="font-medium text-foreground">{budget.label}</span>
                  </div>
                  <p class="text-sm text-muted-foreground">{budget.description}</p>
                </div>
              </label>
            )}
          </For>
        </div>
      </div>

      {/* Interests */}
      <div>
        <label class="block text-sm font-medium text-muted-foreground mb-3">Interests</label>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <For each={interestOptions()}>
            {(interest) => (
              <label class="flex items-center p-2 rounded-lg cursor-pointer hover:bg-muted">
                <input
                  type="checkbox"
                  checked={profileForm().interests.includes(interest.id)}
                  onChange={() =>
                    toggleArrayItem(profileForm().interests, interest.id, (newInterests) =>
                      setProfileForm((prev) => ({ ...prev, interests: newInterests })),
                    )
                  }
                  class="text-primary rounded focus:ring-ring"
                />
                <span class="ml-2 text-sm text-muted-foreground">{interest.name}</span>
              </label>
            )}
          </For>
        </div>
      </div>

      {/* Tags */}
      <div>
        <label class="block text-sm font-medium text-muted-foreground mb-3">Preferred Tags</label>
        <div class="flex flex-wrap gap-2">
          <For each={tagOptions()}>
            {(tag) => (
              <button
                type="button"
                onClick={() =>
                  toggleArrayItem(profileForm().tags, tag.id, (newTags) =>
                    setProfileForm((prev) => ({ ...prev, tags: newTags })),
                  )
                }
                class={`px-3 py-1 rounded-full border transition-all text-sm ${
                  profileForm().tags.includes(tag.id)
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-card text-muted-foreground border-border hover:border-primary/30"
                }`}
              >
                {tag.name}
              </button>
            )}
          </For>
          <Show when={tagOptions().length === 0}>
            <p class="text-sm text-muted-foreground">
              No personal tags yet. Create them in Settings — only personal tags can be attached to
              a profile.
            </p>
          </Show>
        </div>
      </div>

      {/* Accessibility */}
      <div>
        <label class="block text-sm font-medium text-muted-foreground mb-3">
          Accessibility Needs
        </label>
        <div class="space-y-2">
          <For each={accessibilityOptions}>
            {(option) => (
              <label class="flex items-center">
                <input
                  type="checkbox"
                  checked={profileForm().accessibility.includes(option)}
                  onChange={() =>
                    toggleArrayItem(profileForm().accessibility, option, (newOptions) =>
                      setProfileForm((prev) => ({ ...prev, accessibility: newOptions })),
                    )
                  }
                  class="text-primary rounded focus:ring-ring"
                />
                <span class="ml-2 text-sm text-muted-foreground">{option}</span>
              </label>
            )}
          </For>
        </div>
      </div>

      {/* Settings */}
      <div class="space-y-3">
        <label class="flex items-center">
          <input
            type="checkbox"
            checked={profileForm().isDefault}
            onChange={(e) => setProfileForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
            class="text-primary rounded focus:ring-ring"
          />
          <span class="ml-2 text-sm text-muted-foreground">Set as default profile</span>
        </label>
      </div>
    </div>
  );

  return (
    <div class="min-h-screen bg-background relative transition-colors">
      {/* Header */}
      <div class="bg-card border-b border-border">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 class="text-2xl font-bold text-foreground">Travel Profiles</h1>
              <p class="text-muted-foreground mt-1">Manage your personalized travel preferences</p>
            </div>
            <Button onClick={() => setShowCreateModal(true)} class="gap-2">
              <Plus class="w-4 h-4" />
              Create Profile
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Show
          when={profiles().length > 0}
          fallback={
            <div class="text-center py-12">
              <User class="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 class="text-lg font-semibold text-foreground mb-2">No profiles yet</h3>
              <p class="text-muted-foreground mb-4">
                Create your first travel profile to get personalized recommendations
              </p>
              <Button onClick={() => setShowCreateModal(true)}>Create Your First Profile</Button>
            </div>
          }
        >
          <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <For each={profiles()}>{(profile) => renderProfileCard(profile)}</For>
          </div>
        </Show>
      </div>

      {/* Create Profile Modal */}
      <Show when={showCreateModal()}>
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div class="bg-card border border-border rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div class="p-6 border-b border-border">
              <div class="flex items-center justify-between">
                <h2 class="text-xl font-semibold text-foreground">Create New Profile</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  class="p-2 hover:bg-muted rounded-lg"
                >
                  <X class="w-5 h-5" />
                </button>
              </div>
            </div>
            <div class="p-6">{renderProfileForm()}</div>
            <div class="p-6 border-t border-border flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button onClick={createProfile} disabled={!profileForm().name.trim()}>
                Create Profile
              </Button>
            </div>
          </div>
        </div>
      </Show>

      {/* Edit Profile Modal */}
      <Show when={showEditModal()}>
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div class="bg-card border border-border rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div class="p-6 border-b border-border">
              <div class="flex items-center justify-between">
                <h2 class="text-xl font-semibold text-foreground">Edit Profile</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  class="p-2 hover:bg-muted rounded-lg"
                >
                  <X class="w-5 h-5" />
                </button>
              </div>
            </div>
            <div class="p-6">{renderProfileForm()}</div>
            <div class="p-6 border-t border-border flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button onClick={updateProfile} disabled={!profileForm().name.trim()}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

// Everything on this page is the signed-in user's own. Unguarded, it rendered
// the whole shell to a logged-out visitor and fired the authed RPCs behind it.
export default function ProfilesPage() {
  return (
    <ProtectedRoute>
      <ProfilesPageContent />
    </ProtectedRoute>
  );
}
