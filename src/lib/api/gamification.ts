// Points, streaks, badges and the friends-only leaderboard — GamificationService.
// Points are awarded by the server where the action is recorded; the client
// only checks in once a day and reads.
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import {
  GamificationService,
  LeaderboardMetric,
  LeaderboardPeriod,
  DailyCheckInRequestSchema,
  GetLeaderboardRequestSchema,
  GetMyProgressRequestSchema,
  ListPointsHistoryRequestSchema,
  type Progress as ProtoProgress,
} from "@buf/loci_loci-proto.bufbuild_es/loci/gamification/gamification_pb.js";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";
import { mapPublicUser, type PublicUser } from "./social";

const client = createClient(GamificationService, transport);

export type Period = "week" | "month" | "all";
export type Metric = "points" | "cities" | "places";

export interface Badge {
  id: string;
  title: string;
  description: string;
  awardedAt?: string;
}

export interface Progress {
  totalPoints: number;
  level: number;
  pointsToNextLevel: number;
  /** 0…1 into the current level. */
  levelFraction: number;
  currentStreak: number;
  longestStreak: number;
  badges: Badge[];
  today: { checkedIn: boolean; searched: boolean; placesVisited: number };
}

export interface LeaderboardEntry {
  user: PublicUser;
  rank: number;
  value: number;
  level: number;
  currentStreak: number;
  isMe: boolean;
}

export interface PointsEvent {
  id: string;
  label: string;
  points: number;
  createdAt: string;
}

/** Level L starts at 50·L·(L−1) points (server: gamification.LevelFor). */
const threshold = (level: number) => 50 * level * (level - 1);

const mapProgress = (p?: ProtoProgress): Progress => {
  const level = p?.level || 1;
  const toNext = Number(p?.pointsToNextLevel ?? 0n);
  const span = threshold(level + 1) - threshold(level);
  return {
    totalPoints: Number(p?.totalPoints ?? 0n),
    level,
    pointsToNextLevel: toNext,
    levelFraction: span > 0 ? Math.min(Math.max(1 - toNext / span, 0), 1) : 0,
    currentStreak: p?.currentStreak ?? 0,
    longestStreak: p?.longestStreak ?? 0,
    badges: (p?.badges ?? []).map((b) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      awardedAt: b.awardedAt ? timestampDate(b.awardedAt).toISOString() : undefined,
    })),
    today: {
      checkedIn: p?.today?.checkedIn ?? false,
      searched: p?.today?.searched ?? false,
      placesVisited: p?.today?.placesVisited ?? 0,
    },
  };
};

const PERIODS: Record<Period, LeaderboardPeriod> = {
  week: LeaderboardPeriod.WEEK,
  month: LeaderboardPeriod.MONTH,
  all: LeaderboardPeriod.ALL_TIME,
};
const METRICS: Record<Metric, LeaderboardMetric> = {
  points: LeaderboardMetric.POINTS,
  cities: LeaderboardMetric.CITIES,
  places: LeaderboardMetric.PLACES,
};

export const gamificationKeys = {
  all: ["gamification"] as const,
  progress: () => [...gamificationKeys.all, "progress"] as const,
  board: (period: Period, metric: Metric) =>
    [...gamificationKeys.all, "board", period, metric] as const,
  history: () => [...gamificationKeys.all, "history"] as const,
};

export const useProgress = (enabled: () => boolean = () => true) =>
  useAppQuery(() => ({
    queryKey: gamificationKeys.progress(),
    enabled: enabled(),
    queryFn: async (): Promise<Progress> =>
      mapProgress((await client.getMyProgress(create(GetMyProgressRequestSchema, {}))).progress),
  }));

export const useLeaderboard = (
  period: () => Period,
  metric: () => Metric,
  enabled: () => boolean = () => true,
) =>
  useAppQuery(() => ({
    queryKey: gamificationKeys.board(period(), metric()),
    enabled: enabled(),
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      const res = await client.getLeaderboard(
        create(GetLeaderboardRequestSchema, {
          period: PERIODS[period()],
          metric: METRICS[metric()],
        }),
      );
      return res.entries.flatMap((e) => {
        const user = mapPublicUser(e.user);
        if (!user) return [];
        return [
          {
            user,
            rank: e.rank,
            value: Number(e.value),
            level: e.level || 1,
            currentStreak: e.currentStreak,
            isMe: e.isMe,
          },
        ];
      });
    },
  }));

export const usePointsHistory = (enabled: () => boolean = () => true) =>
  useAppQuery(() => ({
    queryKey: gamificationKeys.history(),
    enabled: enabled(),
    queryFn: async (): Promise<PointsEvent[]> => {
      const res = await client.listPointsHistory(
        create(ListPointsHistoryRequestSchema, { pageSize: 30 }),
      );
      return res.events.map((e) => ({
        id: e.id,
        label: e.label,
        points: e.points,
        createdAt: e.createdAt ? timestampDate(e.createdAt).toISOString() : "",
      }));
    },
  }));

const CHECK_IN_KEY = "loci_last_check_in_day";

const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * The day's check-in, once per local day per browser. The server is idempotent
 * per local date as well, so a second tab only costs a round trip.
 */
export const useDailyCheckIn = () => {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async () => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const res = await client.dailyCheckIn(create(DailyCheckInRequestSchema, { timezone }));
      try {
        localStorage.setItem(CHECK_IN_KEY, localDay());
      } catch {
        // Private mode: the server stays the source of truth.
      }
      return res.pointsAwarded;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gamificationKeys.all }),
  }));
};

export const checkedInToday = () => {
  try {
    return localStorage.getItem(CHECK_IN_KEY) === localDay();
  } catch {
    return false;
  }
};

export const formatMetric = (metric: Metric, value: number) => {
  if (metric === "cities") return value === 1 ? "1 city" : `${value} cities`;
  if (metric === "places") return value === 1 ? "1 place" : `${value} places`;
  return `${value.toLocaleString()} pts`;
};
