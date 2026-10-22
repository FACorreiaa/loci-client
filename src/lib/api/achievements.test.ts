import { describe, expect, it, vi } from "vitest";

vi.mock("../connect-transport", () => ({ transport: {} }));

import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import {
  AchievementKind,
  AchievementSchema,
  AchievementTier,
  TierStepSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/achievement/achievement_pb.js";
import {
  achievementLabel,
  mapAchievement,
  progressShare,
  rarityLine,
  tierRank,
} from "./achievements";

describe("achievement mappers", () => {
  it("maps a track with its rungs, progress and rarity", () => {
    const a = mapAchievement(
      create(AchievementSchema, {
        id: "cartographer",
        title: "Cartographer",
        kind: AchievementKind.TRACK,
        tier: AchievementTier.SILVER,
        steps: [
          create(TierStepSchema, {
            tier: AchievementTier.BRONZE,
            threshold: 5n,
            earnedAt: timestampFromDate(new Date("2026-10-01T00:00:00Z")),
          }),
          create(TierStepSchema, { tier: AchievementTier.GOLD, threshold: 30n }),
        ],
        progress: 18n,
        nextTarget: 30n,
        rarityPct: 4.2,
      }),
    );
    expect(a.kind).toBe("track");
    expect(a.tier).toBe("silver");
    expect(a.steps[0]).toEqual({
      tier: "bronze",
      threshold: 5,
      earnedAt: "2026-10-01T00:00:00.000Z",
    });
    expect(a.steps[1].earnedAt).toBeUndefined();
    expect(a.progress).toBe(18);
    expect(achievementLabel(a)).toBe("Cartographer · Silver");
    expect(progressShare(a)).toBeCloseTo(0.6);
  });

  it("keeps an unearned secret hidden and a moment untiered", () => {
    const s = mapAchievement(
      create(AchievementSchema, { kind: AchievementKind.SECRET, hidden: true }),
    );
    expect(s).toMatchObject({ kind: "secret", hidden: true, tier: "none", earnedAt: undefined });
    const m = mapAchievement(
      create(AchievementSchema, { title: "First Pin", kind: AchievementKind.MOMENT }),
    );
    expect(achievementLabel(m)).toBe("First Pin");
    expect(progressShare({ progress: 0, nextTarget: 0 })).toBe(1);
  });

  it("ranks unlocks as the push does: a secret, the highest tier, a moment", () => {
    expect(tierRank({ kind: "secret", tier: "none" })).toBeGreaterThan(
      tierRank({ kind: "track", tier: "platinum" }),
    );
    expect(tierRank({ kind: "track", tier: "gold" })).toBeGreaterThan(
      tierRank({ kind: "track", tier: "bronze" }),
    );
    expect(tierRank({ kind: "track", tier: "bronze" })).toBeGreaterThan(
      tierRank({ kind: "moment", tier: "none" }),
    );
  });

  it("words rarity, and says nothing while it is unknown", () => {
    expect(rarityLine(undefined)).toBeUndefined();
    expect(rarityLine(0.4)).toBe("Held by under 1% of explorers");
    expect(rarityLine(12.6)).toBe("Held by 13% of explorers");
  });
});
