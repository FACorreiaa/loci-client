import { Show } from "solid-js";
import { A } from "@solidjs/router";
import { Checkbox, CheckboxControl } from "~/ui/checkbox";
import { Label } from "~/ui/label";
import { useSetAccountPrivacy, useSocialSettings } from "~/lib/api/social";

/**
 * Public by default: anyone can follow you. Private: people ask, and only the
 * ones you approve see your trips, achievements and follow lists. Going public
 * again approves everyone waiting.
 */
export default function PrivacySetting() {
  const settingsQuery = useSocialSettings();
  const setPrivacy = useSetAccountPrivacy();
  const settings = () => (settingsQuery.isSuccess ? settingsQuery.data : undefined);
  return (
    <section class="loci-card mb-6 p-5" aria-labelledby="privacy-title">
      <p id="privacy-title" class="kicker mb-3">
        Who can follow you
      </p>
      <div class="flex items-start gap-3">
        <Checkbox
          checked={settings()?.isPrivate ?? false}
          onChange={(value: boolean) => setPrivacy.mutate(value)}
          disabled={!settings() || setPrivacy.isPending}
        >
          <CheckboxControl />
        </Checkbox>
        <div class="min-w-0">
          <Label class="font-medium text-foreground">Private account</Label>
          <p class="text-sm text-muted-foreground">
            People ask to follow you, and only those you approve see your trips, achievements and
            who you follow. Your name and photo stay visible. Turning this off approves everyone
            waiting.
          </p>
          <Show when={settings()?.pendingRequests}>
            {(n) => (
              <A
                href="/friends?tab=requests"
                class="mt-1 inline-block text-sm text-primary underline-offset-4 hover:underline"
              >
                {n()} waiting for you
              </A>
            )}
          </Show>
        </div>
      </div>
    </section>
  );
}
