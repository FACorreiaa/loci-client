import { describe, expect, it } from "vitest";

import {
  SearchPace,
  TransportPreference,
} from "@buf/loci_loci-proto.bufbuild_es/loci/profile/profile_pb.js";

import { labelToSearchPace, labelToTransport } from "./api/profile-enums";
import {
  TRIP_SETUP_INTERESTS,
  interestIdsFor,
  postSignInTarget,
  shouldOfferTripSetup,
  tripSetupProfile,
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
      preferred_transport: "walk",
      prefer_accessible_pois: true,
      interests: ["int-hist"],
    });
  });

  it("offers every curated interest at least once in the catalogue check", () => {
    expect(TRIP_SETUP_INTERESTS.length).toBeGreaterThan(5);
  });
});

describe("first-run offer", () => {
  it("shows once: not when already seen, not when profiles exist", () => {
    expect(shouldOfferTripSetup(null, 0)).toBe(true);
    expect(shouldOfferTripSetup("1", 0)).toBe(false);
    expect(shouldOfferTripSetup(null, 2)).toBe(false);
  });

  it("routes a fresh sign-in to the wizard and everyone else home", async () => {
    expect(await postSignInTarget({ seen: null, countProfiles: async () => 0 })).toBe(
      "/trip-setup",
    );
    expect(await postSignInTarget({ seen: null, countProfiles: async () => 3 })).toBe("/");
    expect(await postSignInTarget({ seen: "1", countProfiles: async () => 0 })).toBe("/");
    // A failed profile read must never block sign-in.
    expect(
      await postSignInTarget({
        seen: null,
        countProfiles: async () => {
          throw new Error("offline");
        },
      }),
    ).toBe("/");
  });
});
