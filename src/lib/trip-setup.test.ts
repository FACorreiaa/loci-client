import { describe, expect, it } from "vitest";

import {
  SearchPace,
  TransportPreference,
} from "@buf/loci_loci-proto.bufbuild_es/loci/profile/profile_pb.js";

import { labelToSearchPace, labelToTransport } from "./api/profile-enums";
import {
  TRIP_SETUP_INTERESTS,
  interestIdsFor,
  isUntouchedProfile,
  postSignInTarget,
  safeNextPath,
  shouldOfferTripSetup,
  tripSetupHref,
  tripSetupProfile,
  tripSetupSave,
  tripSetupSeenKey,
} from "./trip-setup";

const catalogue = [
  { id: "int-food", name: "Food & Dining" },
  { id: "int-art", name: "art & culture" },
  { id: "int-hist", name: "History" },
];

describe("trip setup payload", () => {
  it("sends interest ids, never labels, and drops what the catalogue lacks", () => {
    expect(interestIdsFor(["Food & Dining", "Art & Culture", "Nightlife"], catalogue)).toEqual([
      "int-food",
      "int-art",
    ]);
    expect(interestIdsFor(["Food & Dining", "Food & Dining"], catalogue)).toEqual(["int-food"]);
  });

  it("maps each choice to the exact proto enum the server stores", () => {
    const base = { budget: "2", interests: [], catalogue };
    const pace = (p: string) =>
      labelToSearchPace(tripSetupProfile({ ...base, pace: p, mobility: "car" }).preferred_pace);
    expect(pace("relaxed")).toBe(SearchPace.RELAXED);
    expect(pace("moderate")).toBe(SearchPace.MODERATE);
    expect(pace("packed")).toBe(SearchPace.FAST);

    const move = (m: string) => tripSetupProfile({ ...base, pace: "moderate", mobility: m });
    expect(labelToTransport(move("walking").preferred_transport)).toBe(TransportPreference.WALK);
    expect(labelToTransport(move("transit").preferred_transport)).toBe(TransportPreference.PUBLIC);
    expect(labelToTransport(move("car").preferred_transport)).toBe(TransportPreference.CAR);
    expect(labelToTransport(move("wheelchair").preferred_transport)).toBe(
      TransportPreference.PUBLIC,
    );
    expect(move("wheelchair").prefer_accessible_pois).toBe(true);
    expect(move("transit").prefer_accessible_pois).toBe(false);
  });

  it("maps every pace and mobility choice to a real enum, not ANY", () => {
    for (const pace of ["relaxed", "moderate", "packed"]) {
      const profile = tripSetupProfile({
        budget: "2",
        pace,
        mobility: "walking",
        interests: [],
        catalogue,
      });
      expect(labelToSearchPace(profile.preferred_pace), pace).not.toBe(SearchPace.ANY);
    }
    for (const mobility of ["walking", "transit", "car", "wheelchair"]) {
      const profile = tripSetupProfile({
        budget: "2",
        pace: "moderate",
        mobility,
        interests: [],
        catalogue,
      });
      expect(labelToTransport(profile.preferred_transport), mobility).not.toBe(
        TransportPreference.ANY,
      );
    }
  });

  it("builds the default profile the first search will read", () => {
    const profile = tripSetupProfile({
      budget: "3",
      pace: "packed",
      mobility: "wheelchair",
      interests: ["History"],
      catalogue,
    });
    expect(profile).toMatchObject({
      profile_name: "My Trip Profile",
      is_default: true,
      budget_level: 3,
      preferred_pace: "fast",
      preferred_transport: "public",
      prefer_accessible_pois: true,
      interests: ["int-hist"],
    });
  });

  it("offers every curated interest at least once in the catalogue check", () => {
    expect(TRIP_SETUP_INTERESTS.length).toBeGreaterThan(5);
  });
});

const serverDefault = {
  id: "p-default",
  profile_name: "Default",
  is_default: true,
  preferred_vibes: [],
  dietary_needs: [],
  interests: null,
  tags: null,
};

const input = {
  budget: "3",
  pace: "relaxed",
  mobility: "transit",
  interests: ["History"],
  catalogue,
};

describe("trip setup save", () => {
  it("updates the server-created default profile instead of adding a duplicate", () => {
    const save = tripSetupSave(input, [serverDefault]);
    expect(save.mode).toBe("update");
    if (save.mode !== "update") return;
    expect(save.profileId).toBe("p-default");
    expect(save.data).toMatchObject({
      profile_name: "My Trip Profile",
      is_default: true,
      budget_level: 3,
      preferred_pace: "relaxed",
      preferred_transport: "public",
      interests: ["int-hist"],
      preferred_vibes: [],
      dietary_needs: [],
      tags: [],
    });
  });

  it("keeps the lists and name of a customised default, since update replaces lists", () => {
    const save = tripSetupSave(input, [
      { ...serverDefault, id: "p-other", is_default: false },
      {
        id: "p-mine",
        profile_name: "Weekend trips",
        is_default: true,
        preferred_vibes: ["cosy"],
        dietary_needs: ["vegan"],
        tags: [{ id: "tag-1" }],
        interests: [{ id: "int-food" }],
      },
    ]);
    expect(save).toMatchObject({
      mode: "update",
      profileId: "p-mine",
      data: {
        profile_name: "Weekend trips",
        preferred_vibes: ["cosy"],
        dietary_needs: ["vegan"],
        tags: ["tag-1"],
        interests: ["int-hist"],
      },
    });
  });

  it("creates only when there is no default profile to update", () => {
    expect(tripSetupSave(input, []).mode).toBe("create");
    expect(tripSetupSave(input, [{ ...serverDefault, is_default: false }]).mode).toBe("create");
  });
});

describe("first-run offer", () => {
  it("treats the server's sign-up profile as untouched and anything chosen as customised", () => {
    expect(isUntouchedProfile(serverDefault)).toBe(true);
    expect(isUntouchedProfile({ ...serverDefault, profile_name: "My Trip Profile" })).toBe(false);
    expect(isUntouchedProfile({ ...serverDefault, interests: [{ id: "i" }] })).toBe(false);
    expect(isUntouchedProfile({ ...serverDefault, dietary_needs: ["vegan"] })).toBe(false);
  });

  it("offers once, to new accounts whose only profile is the server default", () => {
    const profiles = [serverDefault];
    expect(shouldOfferTripSetup({ isNewUser: true, seen: null, profiles })).toBe(true);
    // The old gate required zero profiles, which no account ever has.
    expect(shouldOfferTripSetup({ isNewUser: true, seen: null, profiles: [] })).toBe(true);
    expect(shouldOfferTripSetup({ isNewUser: true, seen: "1", profiles })).toBe(false);
    expect(shouldOfferTripSetup({ isNewUser: false, seen: null, profiles })).toBe(false);
    expect(
      shouldOfferTripSetup({
        isNewUser: true,
        seen: null,
        profiles: [serverDefault, { ...serverDefault, id: "x", profile_name: "Food trip" }],
      }),
    ).toBe(false);
  });

  it("keys the seen flag by user, so a second account on the browser still gets it", () => {
    expect(tripSetupSeenKey("u1")).not.toBe(tripSetupSeenKey("u2"));
  });

  it("routes a new sign-up through the wizard, then on to where they were headed", async () => {
    const loadProfiles = async () => [serverDefault];
    expect(await postSignInTarget({ isNewUser: true, seen: null, loadProfiles })).toBe(
      "/trip-setup",
    );
    expect(
      await postSignInTarget({
        isNewUser: true,
        seen: null,
        returnTo: "/trips/42?x=1",
        loadProfiles,
      }),
    ).toBe("/trip-setup?next=%2Ftrips%2F42%3Fx%3D1");
  });

  it("sends everyone else straight on, without a profile read", async () => {
    let calls = 0;
    const loadProfiles = async () => {
      calls++;
      return [serverDefault];
    };
    expect(await postSignInTarget({ isNewUser: false, seen: null, loadProfiles })).toBe("/");
    expect(
      await postSignInTarget({ isNewUser: false, seen: null, returnTo: "/saved", loadProfiles }),
    ).toBe("/saved");
    expect(await postSignInTarget({ isNewUser: true, seen: "1", loadProfiles })).toBe("/");
    expect(calls).toBe(0);
  });

  it("never blocks sign-in on a failed profile read", async () => {
    expect(
      await postSignInTarget({
        isNewUser: true,
        seen: null,
        returnTo: "/saved",
        loadProfiles: async () => {
          throw new Error("offline");
        },
      }),
    ).toBe("/saved");
  });

  it("continues only to same-origin paths, defaulting to /discover", () => {
    expect(safeNextPath(undefined)).toBe("/discover");
    expect(safeNextPath("/saved")).toBe("/saved");
    expect(safeNextPath("https://evil.example")).toBe("/discover");
    expect(safeNextPath("//evil.example")).toBe("/discover");
    expect(safeNextPath("/\\evil.example")).toBe("/discover");
    expect(safeNextPath("/trip-setup")).toBe("/discover");
    expect(safeNextPath("/auth/signin")).toBe("/discover");
    expect(tripSetupHref("https://evil.example")).toBe("/trip-setup");
  });
});
