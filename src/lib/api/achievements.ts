// Achievements — listed through GamificationService, shown on profiles and in
// the following feed through SocialService. The server judges everything;
// the client lists, marks seen, and celebrates what a call unlocked.
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { timestampDate, type Timestamp } from "@bufbuild/protobuf/wkt";
import {
  GamificationService,
  ListAchievementsRequestSchema,
  MarkAchievementsSeenRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/gamification/gamification_pb.js";
import {
  AchievementKind as ProtoKind,
  AchievementTier as ProtoTier,
  type Achievement as ProtoAchievement,
  type AchievementSummary as ProtoSummary,
} from "@buf/loci_loci-proto.bufbuild_es/loci/achievement/achievement_pb.js";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";
import { showToast, dismissToast } from "../toast-store";

const client = createClient(GamificationService, transport);

export type AchievementKind = "track" | "moment" | "secret";
export type Tier = "none" | "bronze" | "silver" | "gold" | "platinum";

export interface TierStep {
  tier: Tier;
  threshold: number;
  earnedAt?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  /** Semantic key (a lucide name); the medallion maps it to a glyph. */
  icon: string;
  category: string;
  kind: AchievementKind;
  /** Highest tier reached; "none" for moments, secrets and unearned tracks. */
  tier: Tier;
  steps: TierStep[];
  progress: number;
  /** 0 once there is nothing left to earn. */
  nextTarget: number;
  /** Share of explorers holding it, 0–100; undefined while too few to say. */
  rarityPct?: number;
  hidden: boolean;
  earnedAt?: string;
  isNew: boolean;
}

export interface AchievementSummary {
  id: string;
  title: string;
  description: string;
  icon: string;
  kind: AchievementKind;
  tier: Tier;
  earnedAt?: string;
}

export interface AchievementList {
  achievements: Achievement[];
  earned: number;
  total: number;
  /** Earned before achievements existed and not yet revealed. */
  unseenBackfill: number;
}

// ---- mappers (pure, tested) ----

const TIERS: Record<number, Tier> = {
  [ProtoTier.BRONZE]: "bronze",
  [ProtoTier.SILVER]: "silver",
  [ProtoTier.GOLD]: "gold",
  [ProtoTier.PLATINUM]: "platinum",
};
export const tierOf = (t: ProtoTier): Tier => TIERS[t] ?? "none";

export const kindOf = (k: ProtoKind): AchievementKind =>
  k === ProtoKind.TRACK ? "track" : k === ProtoKind.SECRET ? "secret" : "moment";

const iso = (t?: Timestamp) => (t ? timestampDate(t).toISOString() : undefined);

export const mapAchievement = (a: ProtoAchievement): Achievement => ({
  id: a.id,
  title: a.title,
  description: a.description,
  icon: a.icon,
  category: a.category,
  kind: kindOf(a.kind),
  tier: tierOf(a.tier),
  steps: a.steps.map((s) => ({
    tier: tierOf(s.tier),
    threshold: Number(s.threshold),
    earnedAt: iso(s.earnedAt),
  })),
  progress: Number(a.progress),
  nextTarget: Number(a.nextTarget),
  rarityPct: a.rarityPct,
  hidden: a.hidden,
  earnedAt: iso(a.earnedAt),
  isNew: a.isNew,
});

export const mapSummary = (a: ProtoSummary): AchievementSummary => ({
  id: a.id,
  title: a.title,
  description: a.description,
  icon: a.icon,
  kind: kindOf(a.kind),
  tier: tierOf(a.tier),
  earnedAt: iso(a.earnedAt),
});

const TIER_NAMES: Record<Tier, string> = {
  none: "",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

/** "Cartographer · Gold"; a moment or secret is just its title. */
export const achievementLabel = (a: Pick<Achievement, "title" | "kind" | "tier">): string =>
  a.kind === "track" && a.tier !== "none" ? `${a.title} · ${TIER_NAMES[a.tier]}` : a.title;

export const isEarned = (a: Pick<Achievement, "earnedAt">) => !!a.earnedAt;

/** 0–1 toward the next rung (or the moment); 1 when done. */
export const progressShare = (a: Pick<Achievement, "progress" | "nextTarget">): number =>
  a.nextTarget <= 0 ? 1 : Math.min(1, Math.max(0, a.progress / a.nextTarget));

/** "Held by 4% of explorers"; undefined while rarity is unknown. */
export const rarityLine = (pct?: number): string | undefined => {
  if (pct === undefined) return undefined;
  if (pct < 1) return "Held by under 1% of explorers";
  return `Held by ${Math.round(pct)}% of explorers`;
};

// ---- queries ----

export const achievementKeys = {
  all: ["achievements"] as const,
  list: (userId: string) => ["achievements", "list", userId] as const,
};

/** The whole catalogue as it stands for userId (empty: the caller). */
export const useAchievements = (
  userId: () => string = () => "",
  enabled: () => boolean = () => true,
) =>
  useAppQuery(() => ({
    queryKey: achievementKeys.list(userId()),
    enabled: enabled(),
    retry: false,
    queryFn: async (): Promise<AchievementList> => {
      const res = await client.listAchievements(
        create(ListAchievementsRequestSchema, { userId: userId() }),
      );
      return {
        achievements: res.achievements.map(mapAchievement),
        earned: res.earnedCount,
        total: res.total,
        unseenBackfill: res.unseenBackfillCount,
      };
    },
  }));

/** Clears the new mark on the caller's achievements; no ids clears all. */
export const useMarkAchievementsSeen = () => {
  const qc = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (ids: string[] = []) => {
      await client.markAchievementsSeen(create(MarkAchievementsSeenRequestSchema, { ids }));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: achievementKeys.all }),
  }));
};

/**
 * Celebrates what one call unlocked: a toast for the best of them, linking
 * to the achievements page. Called with whatever MarkStop or CompleteTripDay
 * returned; nothing unlocked shows nothing.
 */
export const celebrateUnlocks = (unlocked: Achievement[]) => {
  if (!unlocked.length) return;
  const best = unlocked.reduce((b, a) => (tierRank(a) > tierRank(b) ? a : b));
  const more = unlocked.length > 1 ? ` (+${unlocked.length - 1} more)` : "";
  const id = "achievement-unlocked";
  showToast({
    id,
    title: `Achievement unlocked: ${achievementLabel(best)}${more}`,
    action: { label: "See", href: "/achievements" },
  });
  setTimeout(() => dismissToast(id), 8000);
};

const TIER_ORDER: Tier[] = ["none", "bronze", "silver", "gold", "platinum"];

/** Orders unlocks as the server's push does: a secret, the highest tier, a moment. */
export const tierRank = (a: Pick<Achievement, "kind" | "tier">): number =>
  a.kind === "secret" ? 10 : a.kind === "track" ? 1 + TIER_ORDER.indexOf(a.tier) : 1;
