import { fetchPreferenceProfilesRPC } from "~/lib/api/profiles";
import { postSignInTarget, readTripSetupSeen } from "~/lib/trip-setup";

/**
 * Where a sign-in lands: `returnTo` (home when absent), or, for a brand-new
 * account, the trip questionnaire once and then `returnTo`. Existing accounts
 * cost no RPC; for a new one a failed profile read falls back to `returnTo`
 * so sign-in is never blocked.
 */
export async function afterSignInTarget(args: {
  userId: string | undefined;
  isNewUser: boolean;
  returnTo?: string | null;
}): Promise<string> {
  return postSignInTarget({
    isNewUser: args.isNewUser && !!args.userId,
    seen: readTripSetupSeen(args.userId),
    returnTo: args.returnTo,
    loadProfiles: fetchPreferenceProfilesRPC,
  });
}
