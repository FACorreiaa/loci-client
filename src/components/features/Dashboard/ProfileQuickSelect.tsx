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

  const metaLine = (budget: number, radiusKm: number) => {
    const bits = [getBudgetLabel(budget)];
    if (radiusKm > 0) bits.push(`${radiusKm}km`);
    return bits.join(" · ");
  };

  return (
    <div class="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen())}
        disabled={profilesQuery.isLoading || isChangingProfile()}
        aria-haspopup="listbox"
        aria-expanded={isOpen()}
        class="inline-flex max-w-full items-center gap-2 rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-3 py-1.5 text-left text-sm text-primary-foreground transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <User class="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />
        <Show
          when={!profilesQuery.isLoading}
          fallback={<span class="text-primary-foreground/70">Loading profile</span>}
        >
          <Show
            when={currentProfile()}
            fallback={<span class="text-primary-foreground/80">No profile</span>}
          >
            {(profile) => (
              <span class="min-w-0 truncate">
                <span class="font-medium">{profile().profile_name}</span>
                <span class="ml-2 font-coord text-[10px] uppercase tracking-[0.12em] text-primary-foreground/65">
                  {metaLine(profile().budget_level, profile().search_radius_km)}
                </span>
              </span>
            )}
          </Show>
        </Show>
        <ChevronDown
          class={`h-3.5 w-3.5 shrink-0 opacity-70 transition-transform ${isOpen() ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      <Show when={isOpen()}>
        <div class="fixed inset-0 z-40" onClick={() => setIsOpen(false)} aria-hidden="true" />
        <div class="loci-card absolute left-0 top-full z-50 mt-2 min-w-[16rem] overflow-hidden">
          <Show
            when={profiles().length > 0}
            fallback={
              <div class="px-4 py-6 text-center">
                <p class="mb-3 text-sm text-muted-foreground">No profiles yet</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    navigate("/profiles");
                  }}
                  class="text-sm font-medium text-primary hover:text-primary/80"
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
                    type="button"
                    onClick={() => handleSelectProfile(profile.id)}
                    disabled={isChangingProfile()}
                    class={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors disabled:opacity-50 ${
                      isSelected() ? "bg-muted" : "hover:bg-muted/70"
                    }`}
                  >
                    <div
                      class={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        isSelected()
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Show
                        when={isSelected()}
                        fallback={<User class="h-4 w-4" aria-hidden="true" />}
                      >
                        <Check class="h-4 w-4" aria-hidden="true" />
                      </Show>
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <p class="truncate text-sm font-medium text-foreground">
                          {profile.profile_name}
                        </p>
                        <Show when={profile.is_default}>
                          <span class="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                            Default
                          </span>
                        </Show>
                      </div>
                      <p class="mt-0.5 text-xs text-muted-foreground">
                        {metaLine(profile.budget_level, profile.search_radius_km)}
                      </p>
                    </div>
                  </button>
                );
              }}
            </For>

            <div class="my-1 border-t border-border" />

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate("/profiles");
              }}
              class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/70"
            >
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <Plus class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <p class="text-sm font-medium text-foreground">Manage profiles</p>
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
}
