import { fetchPreferenceProfilesRPC } from "~/lib/api/profiles";
import { postSignInTarget, readTripSetupSeen } from "~/lib/trip-setup";

/**
 * Where a sign-in lands when nothing asked to return somewhere: home, or the
 * trip questionnaire once for an account that has no profile yet. One RPC,
 * and a failure of it falls back to home so sign-in is never blocked.
 */
export async function afterSignInTarget(): Promise<string> {
  return postSignInTarget({
    seen: readTripSetupSeen(),
    countProfiles: async () => (await fetchPreferenceProfilesRPC()).length,
  });
}
