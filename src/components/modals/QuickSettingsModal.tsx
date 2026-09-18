import { createSignal, Show, For, createEffect } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { X, User, MapPin, Bell, Settings, Loader2 } from "lucide-solid";
import AppearanceSettings from "~/components/AppearanceSettings";
import { useUserLocation } from "~/contexts/LocationContext";
import {
  useDefaultSearchProfile,
  useSearchProfiles,
  useSetDefaultProfileMutation,
} from "~/lib/api/profiles";
import {
  ensureNotificationPermission,
  getNotificationPermission,
  type BrowserNotificationPermission,
} from "~/lib/notification-prefs";
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
  type NotificationSettings,
} from "~/lib/api/notifications";
import { Button } from "~/ui/button";
import { Label } from "~/ui/label";
import { Checkbox, CheckboxControl } from "~/ui/checkbox";

interface QuickSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const permissionCopy: Record<BrowserNotificationPermission, string> = {
  unsupported: "This browser does not support notifications.",
  default: "Browser permission not requested yet.",
  granted: "Browser notifications allowed.",
  denied: "Browser notifications blocked. Enable them in site settings.",
};

export default function QuickSettingsModal(props: QuickSettingsModalProps) {
  const navigate = useNavigate();
  const { userLocation, requestLocation, error, isLoadingLocation } = useUserLocation();

  const profilesQuery = useSearchProfiles();
  const defaultProfileQuery = useDefaultSearchProfile();
  const setDefaultProfileMutation = useSetDefaultProfileMutation();

  const [locationStatus, setLocationStatus] = createSignal<
    "idle" | "requesting" | "success" | "error"
  >("idle");
  const [selectedProfile, setSelectedProfile] = createSignal<string>("");
  // The switches are the account's, not this browser's. They used to be read
  // from and written to localStorage keyed by user id, so they did not follow
  // anyone to another device and nothing server-side could see them.
  const notificationSettingsQuery = useNotificationSettings();
  const updateNotificationSettings = useUpdateNotificationSettings();
  const notifPrefs = (): NotificationSettings =>
    // isSuccess before .data: reading .data on a pending solid-query suspends
    // the app-wide boundary, and this modal renders over the dashboard.
    notificationSettingsQuery.isSuccess
      ? notificationSettingsQuery.data
      : { recommendations: false, tripReminders: false };
  const [notifPermission, setNotifPermission] = createSignal<BrowserNotificationPermission>(
    getNotificationPermission(),
  );

  const profiles = () => profilesQuery.data ?? [];
  const profilesLoading = () => profilesQuery.isFetching && profilesQuery.data === undefined;

  createEffect(() => {
    if (defaultProfileQuery.data?.id) {
      setSelectedProfile(defaultProfileQuery.data.id);
    }
  });

  createEffect(() => {
    if (!props.isOpen) return;
    setNotifPermission(getNotificationPermission());
  });

  const handleLocationUpdate = async () => {
    setLocationStatus("requesting");

    try {
      await requestLocation();
      setLocationStatus("success");
      setTimeout(() => setLocationStatus("idle"), 2000);
    } catch (_error) {
      setLocationStatus("error");
      setTimeout(() => setLocationStatus("idle"), 3000);
    }
  };

  const handleProfileChange = async (profileId: string) => {
    setSelectedProfile(profileId);
    try {
      await setDefaultProfileMutation.mutateAsync(profileId);
    } catch (err) {
      console.error("Failed to update default profile:", err);
      setSelectedProfile(defaultProfileQuery.data?.id || "");
    }
  };

  // Send only the switch that moved; omitting the other means "leave it as it
  // is", which the server treats differently from turning it off.
  const persistNotifPref = (key: keyof NotificationSettings, value: boolean) => {
    void updateNotificationSettings.mutateAsync({ [key]: value }).catch((err: unknown) => {
      console.error("Failed to save notification preference:", err);
    });
  };

  const handleNotificationToggle = async (key: keyof NotificationSettings, enabled: boolean) => {
    if (!enabled) {
      persistNotifPref(key, false);
      return;
    }

    const permission = await ensureNotificationPermission();
    setNotifPermission(permission);
    if (permission !== "granted") {
      persistNotifPref(key, false);
      return;
    }
    persistNotifPref(key, true);
  };

  const handleOpenFullSettings = () => {
    props.onClose();
    navigate("/settings");
  };

  const locationButtonLabel = () => {
    if (locationStatus() === "requesting" || isLoadingLocation()) return "Requesting...";
    if (locationStatus() === "success") return "Updated!";
    if (locationStatus() === "error") return "Failed";
    return userLocation() ? "Update Location" : "Enable Location";
  };

  return (
    <Show when={props.isOpen}>
      {/* Backdrop */}
      <div
        class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity"
        onClick={props.onClose}
      >
        {/* Modal */}
        <div
          class="fixed inset-x-4 top-1/2 -translate-y-1/2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md bg-card rounded-2xl shadow-2xl border border-border max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div class="flex items-center justify-between p-4 sm:p-6 border-b border-border">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Settings class="w-4 h-4 text-primary" />
              </div>
              <h2 class="text-lg font-semibold text-foreground">Quick Settings</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={props.onClose}>
              <X class="w-5 h-5" />
            </Button>
          </div>

          {/* Content */}
          <div class="p-4 sm:p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
            {/* Active Travel Profile */}
            <div class="space-y-3">
              <div class="flex items-center gap-2">
                <User class="w-4 h-4 text-muted-foreground" />
                <Label>Active Travel Profile</Label>
              </div>
              <Show
                when={!profilesQuery.isError}
                fallback={
                  <div class="space-y-2">
                    <p class="text-sm text-muted-foreground">Could not load travel profiles.</p>
                    <Button
                      variant="secondary"
                      class="w-full"
                      onClick={() => void profilesQuery.refetch()}
                    >
                      Retry
                    </Button>
                  </div>
                }
              >
                <Show
                  when={!profilesLoading()}
                  fallback={
                    <div class="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 class="w-4 h-4 animate-spin" />
                      Loading profiles...
                    </div>
                  }
                >
                  <Show
                    when={profiles().length > 0}
                    fallback={
                      <div class="space-y-2">
                        <p class="text-sm text-muted-foreground">No travel profiles yet.</p>
                        <A
                          href="/profiles"
                          class="text-sm text-primary underline-offset-4 hover:underline"
                          onClick={props.onClose}
                        >
                          Create a profile
                        </A>
                      </div>
                    }
                  >
                    <select
                      value={selectedProfile()}
                      onChange={(e) => handleProfileChange(e.target.value)}
                      disabled={setDefaultProfileMutation.isPending}
                      class="w-full p-3 border border-border rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <For each={profiles()}>
                        {(profile) => <option value={profile.id}>{profile.profile_name}</option>}
                      </For>
                    </select>
                  </Show>
                </Show>
              </Show>
              <Show when={setDefaultProfileMutation.isPending}>
                <div class="flex items-center gap-2 text-sm text-primary">
                  <Loader2 class="w-4 h-4 animate-spin" />
                  Updating...
                </div>
              </Show>
            </div>

            {/* Location Settings */}
            <div class="space-y-3">
              <div class="flex items-center gap-2">
                <MapPin class="w-4 h-4 text-muted-foreground" />
                <Label>Current Location</Label>
              </div>
              <div class="p-3 bg-muted/50 rounded-lg">
                <Show
                  when={userLocation()}
                  fallback={<p class="text-sm text-muted-foreground mb-3">Location not set</p>}
                >
                  {(loc) => (
                    <>
                      <p class="text-sm text-foreground mb-1">
                        {loc().latitude.toFixed(4)}, {loc().longitude.toFixed(4)}
                      </p>
                      <p class="text-xs text-muted-foreground mb-3">
                        Used for nearby recommendations
                      </p>
                    </>
                  )}
                </Show>
                <Button
                  onClick={handleLocationUpdate}
                  disabled={isLoadingLocation() || locationStatus() === "requesting"}
                  class="w-full"
                >
                  <Show
                    when={!(isLoadingLocation() || locationStatus() === "requesting")}
                    fallback={<Loader2 class="w-4 h-4 animate-spin" />}
                  >
                    <MapPin class="w-4 h-4" />
                  </Show>
                  {locationButtonLabel()}
                </Button>
                <Show when={error() && locationStatus() !== "success"}>
                  <p class="text-xs text-destructive mt-2">{error()}</p>
                </Show>
              </div>
            </div>

            <AppearanceSettings compact />

            {/* Notifications */}
            <div class="space-y-3">
              <div class="flex items-center gap-2">
                <Bell class="w-4 h-4 text-muted-foreground" />
                <Label>Notifications</Label>
              </div>
              <p class="text-xs text-muted-foreground">{permissionCopy[notifPermission()]}</p>
              <div class="space-y-2">
                <div class="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span class="text-sm text-foreground">New recommendations</span>
                  <Checkbox
                    checked={notifPrefs().recommendations}
                    onChange={(checked) =>
                      void handleNotificationToggle("recommendations", checked)
                    }
                    disabled={notifPermission() === "unsupported"}
                  >
                    <CheckboxControl />
                  </Checkbox>
                </div>
                <div class="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span class="text-sm text-foreground">Trip reminders</span>
                  <Checkbox
                    checked={notifPrefs().tripReminders}
                    onChange={(checked) => void handleNotificationToggle("tripReminders", checked)}
                    disabled={notifPermission() === "unsupported"}
                  >
                    <CheckboxControl />
                  </Checkbox>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div class="p-4 sm:p-6 border-t border-border space-y-3">
            <Button variant="secondary" onClick={handleOpenFullSettings} class="w-full gap-2">
              <Settings class="w-4 h-4" />
              Open Full Settings
            </Button>
            <div class="text-center">
              <Button variant="ghost" onClick={props.onClose} class="text-sm text-muted-foreground">
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
