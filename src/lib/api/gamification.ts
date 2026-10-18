// Points, streaks, badges and the friends-only leaderboard — GamificationService.
// Points are awarded by the server where the action is recorded; the client
// only checks in once a day and reads.
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import {
  DailyCheckInRequestSchema,
  FieldBoardMetric,
  FieldBoardScope,
  FieldRank,
  GamificationService,
  LeaderboardMetric,
  LeaderboardPeriod,
  GetFieldBoardRequestSchema,
  GetFieldProfileRequestSchema,
  GetLeaderboardRequestSchema,
  GetMyProgressRequestSchema,
  ListPointsHistoryRequestSchema,
  MarkStopRequestSchema,
  type FieldBoardRow as ProtoRow,
  type Progress as ProtoProgress,
} from "@buf/loci_loci-proto.bufbuild_es/loci/gamification/gamification_pb.js";
import { TripStopStatus } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";
import { mapPublicUser, type PublicUser } from "./social";

const client = createClient(GamificationService, transport);

export type Period = "week" | "month" | "all";
export type Metric = "points" | "cities" | "places";
export type Rank = "Scout" | "Walker" | "Guide" | "Local" | "Keeper";
export type BoardScope = "city" | "friends" | "personal";
export type BoardMetric = "overall" | "kept" | "days";
export type StopMark = "open" | "done" | "skipped";

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

const RANKS: Record<number, Rank> = {
  [FieldRank.SCOUT]: "Scout",
  [FieldRank.WALKER]: "Walker",
  [FieldRank.GUIDE]: "Guide",
  [FieldRank.LOCAL]: "Local",
  [FieldRank.KEEPER]: "Keeper",
};
const rankOf = (rank: FieldRank): Rank => RANKS[rank] ?? "Scout";
const SCOPES: Record<BoardScope, FieldBoardScope> = {
  city: FieldBoardScope.CITY_WEEK,
  friends: FieldBoardScope.FRIENDS_WEEK,
  personal: FieldBoardScope.PERSONAL,
};
const FIELD_METRICS: Record<BoardMetric, FieldBoardMetric> = {
  overall: FieldBoardMetric.OVERALL,
  kept: FieldBoardMetric.PLACES_KEPT,
  days: FieldBoardMetric.DAYS_FINISHED,
};
const MARKS: Record<StopMark, TripStopStatus> = {
  open: TripStopStatus.OPEN,
  done: TripStopStatus.DONE,
  skipped: TripStopStatus.SKIPPED,
};

export const stopMarkOf = (status: TripStopStatus | undefined): StopMark =>
  status === TripStopStatus.DONE ? "done" : status === TripStopStatus.SKIPPED ? "skipped" : "open";

export interface CityRank {
  cityId: string;
  cityName: string;
  rank: Rank;
  score: number;
  nextThreshold: number;
}

export interface FieldProfile {
  lifetime: number;
  rank: Rank;
  nextThreshold: number;
  week: number;
  lastWeek: number;
  cities: CityRank[];
  placesKept: number;
  daysFinished: number;
}

export interface BoardRow {
  position: number;
  displayName: string;
  user?: PublicUser;
  value: number;
  isMe: boolean;
  rank: Rank;
}

export interface FieldEvent {
  id: string;
  label: string;
  points: number;
  cityName: string;
  createdAt: string;
}

const mapFieldRow = (row?: ProtoRow): BoardRow | undefined =>
  row
    ? {
        position: row.position,
        displayName: row.displayName,
        user: mapPublicUser(row.user),
        value: Number(row.value),
        isMe: row.isMe,
        rank: rankOf(row.rank),
      }
    : undefined;

export const gamificationKeys = {
  all: ["gamification"] as const,
  progress: () => [...gamificationKeys.all, "progress"] as const,
  board: (period: Period, metric: Metric) =>
    [...gamificationKeys.all, "board", period, metric] as const,
  history: () => [...gamificationKeys.all, "history"] as const,
  profile: () => [...gamificationKeys.all, "profile"] as const,
  fieldBoard: (scope: BoardScope, metric: BoardMetric, cityId: string) =>
    [...gamificationKeys.all, "field-board", scope, metric, cityId] as const,
  ledger: () => [...gamificationKeys.all, "ledger"] as const,
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

export const useFieldProfile = (enabled: () => boolean = () => true) =>
  useAppQuery(() => ({
    queryKey: gamificationKeys.profile(),
    enabled: enabled(),
    queryFn: async (): Promise<FieldProfile> => {
      const profile = (await client.getFieldProfile(create(GetFieldProfileRequestSchema, {})))
        .profile;
      return {
        lifetime: Number(profile?.lifetimeScore ?? 0n),
        rank: rankOf(profile?.overallRank ?? FieldRank.SCOUT),
        nextThreshold: Number(profile?.overallNextThreshold ?? 0n),
        week: Number(profile?.weekScore ?? 0n),
        lastWeek: Number(profile?.lastWeekScore ?? 0n),
        cities: (profile?.cities ?? []).map((city) => ({
          cityId: city.cityId,
          cityName: city.cityName,
          rank: rankOf(city.rank),
          score: Number(city.score),
          nextThreshold: Number(city.nextThreshold),
        })),
        placesKept: profile?.placesKept ?? 0,
        daysFinished: profile?.daysFinished ?? 0,
      };
    },
  }));

export const useFieldBoard = (
  scope: () => BoardScope,
  metric: () => BoardMetric,
  cityId: () => string = () => "",
  enabled: () => boolean = () => true,
) =>
  useAppQuery(() => ({
    queryKey: gamificationKeys.fieldBoard(scope(), metric(), cityId()),
    enabled: enabled(),
    queryFn: async () => {
      const response = await client.getFieldBoard(
        create(GetFieldBoardRequestSchema, {
          scope: SCOPES[scope()],
          metric: FIELD_METRICS[metric()],
          cityId: cityId(),
        }),
      );
      const personal = response.personal;
      return {
        cityId: response.cityId,
        cityName: response.cityName,
        seasonStart: response.seasonStart ? timestampDate(response.seasonStart) : undefined,
        seasonEnd: response.seasonEnd ? timestampDate(response.seasonEnd) : undefined,
        top: response.top.flatMap((row) => mapFieldRow(row) ?? []),
        me: mapFieldRow(response.me),
        above: mapFieldRow(response.above),
        scored: response.scoredUsers,
        tooFew: response.tooFew,
        friendsAvailable: response.friendsAvailable,
        meHidden: response.meHidden,
        personal: personal
          ? {
              thisWeek: Number(personal.thisWeek),
              lastWeek: Number(personal.lastWeek),
              placesKept: personal.placesKept,
              placesKeptLastWeek: personal.placesKeptLastWeek,
              daysFinished: personal.daysFinished,
              daysFinishedLastWeek: personal.daysFinishedLastWeek,
            }
          : undefined,
      };
    },
  }));

export const useFieldLedger = (enabled: () => boolean = () => true) =>
  useAppQuery(() => ({
    queryKey: gamificationKeys.ledger(),
    enabled: enabled(),
    queryFn: async (): Promise<FieldEvent[]> => {
      const response = await client.listPointsHistory(
        create(ListPointsHistoryRequestSchema, { pageSize: 12, fieldOnly: true }),
      );
      return response.events.map((event) => ({
        id: event.id,
        label: event.label,
        points: event.fieldPoints,
        cityName: event.cityName,
        createdAt: event.createdAt ? timestampDate(event.createdAt).toISOString() : "",
      }));
    },
  }));

export interface MarkStopResult {
  mark: StopMark;
  points: number;
  dayFinished: boolean;
  tripFinished: boolean;
}

export const useMarkStop = () => {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (value: {
      tripId: string;
      dayId: string;
      stopId: string;
      mark: StopMark;
    }): Promise<MarkStopResult> => {
      const response = await client.markStop(
        create(MarkStopRequestSchema, {
          tripId: value.tripId,
          dayId: value.dayId,
          stopId: value.stopId,
          status: MARKS[value.mark],
          timezone: fieldTimezone(),
        }),
      );
      return {
        mark: stopMarkOf(response.status),
        points: response.pointsAwarded,
        dayFinished: response.dayFinished,
        tripFinished: response.tripFinished,
      };
    },
    onSuccess: (_response, value) => {
      void queryClient.invalidateQueries({ queryKey: gamificationKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["trips", "detail", value.tripId] });
    },
  }));
};

const fieldTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export const useReportTimezone = () =>
  useMutation(() => ({
    mutationFn: async () => {
      await client.dailyCheckIn(create(DailyCheckInRequestSchema, { timezone: fieldTimezone() }));
      try {
        localStorage.setItem(CHECK_IN_KEY, localDay());
      } catch {
        // Private mode: the server remains the source of truth.
      }
    },
  }));

export const reportedTimezoneToday = () => checkedInToday();

export const fieldLine = (profile: FieldProfile) => {
  const top = profile.cities[0];
  const where = top ? `${top.rank} in ${top.cityName}` : profile.rank;
  return profile.week > 0 ? `+${profile.week} this week · ${where}` : where;
};
