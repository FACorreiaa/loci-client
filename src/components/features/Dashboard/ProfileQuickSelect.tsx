import { Show, For, createSignal } from "solid-js";
import { User, Check, ChevronDown, Plus } from "lucide-solid";
import {
  useSearchProfiles,
  useDefaultSearchProfile,
  useSetDefaultProfileMutation,
} from "~/lib/api/profiles";
import { useNavigate } from "@solidjs/router";

export default function ProfileQuickSelect() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = createSignal(false);

  const profilesQuery = useSearchProfiles();
  const defaultProfileQuery = useDefaultSearchProfile();
  const setDefaultMutation = useSetDefaultProfileMutation();

  const profiles = () => profilesQuery.data || [];
  const currentProfile = () => defaultProfileQuery.data;
  const isChangingProfile = () => setDefaultMutation.isPending;

  const handleSelectProfile = async (profileId: string) => {
    if (profileId === currentProfile()?.id) {
      setIsOpen(false);
      return;
    }

    try {
      await setDefaultMutation.mutateAsync(profileId);
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to set default profile:", error);
    }
  };

  const getBudgetLabel = (level: number) => {
    if (level === 1) return "€";
    if (level === 2) return "€€";
    if (level === 3) return "€€€";
    if (level === 4) return "€€€€";
    return "Any";
  };

  return (
    <div class="mb-6">
      <div class="flex items-center justify-between mb-3">
        <label class="text-sm font-medium text-gray-700 dark:text-slate-200">Search Profile</label>
        <button
          onClick={() => navigate("/settings/profiles")}
          class="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium flex items-center gap-1 transition-colors"
        >
          <Plus class="w-3 h-3" />
          Manage Profiles
        </button>
      </div>

      <div class="relative">
        <button
          onClick={() => setIsOpen(!isOpen())}
          disabled={profilesQuery.isLoading || isChangingProfile()}
          class="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/90 dark:bg-white/5 border border-gray-300 dark:border-white/10 hover:border-emerald-600 dark:hover:border-emerald-400 shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-lg">
              <User class="w-5 h-5 text-white" />
            </div>
            <Show
              when={!profilesQuery.isLoading}
              fallback={
                <div class="flex-1 text-left">
                  <p class="text-sm text-gray-500 dark:text-slate-400">Loading profiles...</p>
                </div>
              }
            >
              <Show
                when={currentProfile()}
                fallback={
                  <div class="flex-1 text-left">
                    <p class="text-sm font-medium text-gray-900 dark:text-white">
                      No profile selected
                    </p>
                    <p class="text-xs text-gray-500 dark:text-slate-400">
                      Create a profile to get started
                    </p>
                  </div>
                }
              >
                {(profile) => (
                  <div class="flex-1 text-left min-w-0">
                    <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {profile().profile_name}
                    </p>
                    <div class="flex items-center gap-2 mt-0.5">
                      <span class="text-xs text-gray-500 dark:text-slate-400">
                        {getBudgetLabel(profile().budget_level)}
                      </span>
                      <Show when={profile().search_radius_km > 0}>
                        <span class="text-xs text-gray-400 dark:text-slate-500">•</span>
                        <span class="text-xs text-gray-500 dark:text-slate-400">
                          {profile().search_radius_km}km radius
                        </span>
                      </Show>
                    </div>
                  </div>
                )}
              </Show>
            </Show>
          </div>
          <ChevronDown
            class={`w-4 h-4 text-gray-500 dark:text-slate-400 transition-transform ${isOpen() ? "rotate-180" : ""}`}
          />
        </button>

        {/* Dropdown Menu */}
        <Show when={isOpen()}>
          <div class="loci-card absolute top-full left-0 right-0 z-20 mt-2 overflow-hidden">
            <Show
              when={profiles().length > 0}
              fallback={
                <div class="px-4 py-8 text-center">
                  <User class="w-8 h-8 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
                  <p class="text-sm text-gray-500 dark:text-slate-400 mb-3">No profiles yet</p>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      navigate("/settings/profiles");
                    }}
                    class="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium"
                  >
                    Create your first profile
                  </button>
                </div>
              }
            >
              <For each={profiles()}>
                {(profile) => {
                  const isSelected = () => profile.id === currentProfile()?.id;

                  return (
                    <button
                      onClick={() => handleSelectProfile(profile.id)}
                      disabled={isChangingProfile()}
                      class={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors disabled:opacity-50 ${
                        isSelected()
                          ? "bg-emerald-50 dark:bg-emerald-900/20"
                          : "hover:bg-gray-50 dark:hover:bg-white/5"
                      }`}
                    >
                      <div
                        class={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isSelected()
                            ? "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg"
                            : "bg-gray-200 dark:bg-white/10"
                        }`}
                      >
                        <Show
                          when={isSelected()}
                          fallback={<User class="w-4 h-4 text-gray-600 dark:text-slate-400" />}
                        >
                          <Check class="w-4 h-4 text-white" />
                        </Show>
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <p
                            class={`text-sm font-medium truncate ${
                              isSelected()
                                ? "text-emerald-700 dark:text-emerald-300"
                                : "text-gray-900 dark:text-white"
                            }`}
                          >
                            {profile.profile_name}
                          </p>
                          <Show when={profile.is_default}>
                            <span class="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs rounded-full font-medium">
                              Default
                            </span>
                          </Show>
                        </div>
                        <div class="flex items-center gap-2 mt-0.5">
                          <span class="text-xs text-gray-500 dark:text-slate-400">
                            {getBudgetLabel(profile.budget_level)}
                          </span>
                          <Show when={profile.search_radius_km > 0}>
                            <span class="text-xs text-gray-400 dark:text-slate-500">•</span>
                            <span class="text-xs text-gray-500 dark:text-slate-400">
                              {profile.search_radius_km}km
                            </span>
                          </Show>
                        </div>
                      </div>
                    </button>
                  );
                }}
              </For>

              {/* Divider */}
              <div class="border-t border-gray-200 dark:border-white/10 my-2" />

              {/* Create New Profile Button */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate("/settings/profiles");
                }}
                class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                <div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Plus class="w-4 h-4 text-gray-600 dark:text-slate-400" />
                </div>
                <p class="text-sm font-medium text-gray-700 dark:text-slate-200">
                  Create New Profile
                </p>
              </button>
            </Show>
          </div>
        </Show>
      </div>

      {/* Click outside to close */}
      <Show when={isOpen()}>
        <div class="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      </Show>
    </div>
  );
}
