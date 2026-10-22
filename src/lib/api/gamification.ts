// The field score — GamificationService. Points are awarded by the server
// where the action is recorded (a save, a walked stop, a finished day); the
// client reports its timezone once a day, marks stops, and reads.
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
  GetFieldBoardRequestSchema,
  GetFieldProfileRequestSchema,
  ListPointsHistoryRequestSchema,
  MarkStopRequestSchema,
  type FieldBoardRow as ProtoRow,
} from "@buf/loci_loci-proto.bufbuild_es/loci/gamification/gamification_pb.js";
import { TripStopStatus } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";
import { mapPublicUser, type PublicUser } from "./social";
import {
  celebrateUnlocks,
  mapAchievement,
  achievementKeys,
  type Achievement,
} from "./achievements";

const client = createClient(GamificationService, transport);

export type Rank = "Scout" | "Walker" | "Guide" | "Local" | "Keeper";
export type BoardScope = "city" | "friends" | "personal";
export type BoardMetric = "overall" | "kept" | "days";
export type StopMark = "open" | "done" | "skipped";

const RANKS: Record<number, Rank> = {
  [FieldRank.SCOUT]: "Scout",
  [FieldRank.WALKER]: "Walker",
  [FieldRank.GUIDE]: "Guide",
  [FieldRank.LOCAL]: "Local",
  [FieldRank.KEEPER]: "Keeper",
};
const rankOf = (r: FieldRank): Rank => RANKS[r] ?? "Scout";

const SCOPES: Record<BoardScope, FieldBoardScope> = {
  city: FieldBoardScope.CITY_WEEK,
  friends: FieldBoardScope.FRIENDS_WEEK,
  personal: FieldBoardScope.PERSONAL,
};
const METRICS: Record<BoardMetric, FieldBoardMetric> = {
  overall: FieldBoardMetric.OVERALL,
  kept: FieldBoardMetric.PLACES_KEPT,
  days: FieldBoardMetric.DAYS_FINISHED,
};
const MARKS: Record<StopMark, TripStopStatus> = {
  open: TripStopStatus.OPEN,
  done: TripStopStatus.DONE,
  skipped: TripStopStatus.SKIPPED,
};

export const stopMarkOf = (s: TripStopStatus | undefined): StopMark =>
  s === TripStopStatus.DONE ? "done" : s === TripStopStatus.SKIPPED ? "skipped" : "open";

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
  /** Highest score first. */
  cities: CityRank[];
  placesKept: number;
  daysFinished: number;
  weekStreak: WeekStreak;
}

/** Weeks in a row with some exploring; this week counts until it ends. */
export interface WeekStreak {
  current: number;
  longest: number;
  exploredThisWeek: boolean;
  /** Monday of this week, YYYY-MM-DD in the traveller's timezone. */
  weekStart: string;
}

export interface BoardRow {
  position: number;
  displayName: string;
  /** Set for the viewer and their friends only. */
  user?: PublicUser;
  value: number;
  isMe: boolean;
  rank: Rank;
}

export interface Board {
  cityId: string;
  cityName: string;
  seasonStart?: Date;
  seasonEnd?: Date;
  top: BoardRow[];
  me?: BoardRow;
  above?: BoardRow;
  scored: number;
  tooFew: boolean;
  friendsAvailable: boolean;
  meHidden: boolean;
  personal?: {
    thisWeek: number;
    lastWeek: number;
    placesKept: number;
    placesKeptLastWeek: number;
    daysFinished: number;
    daysFinishedLastWeek: number;
  };
}

export interface FieldEvent {
  id: string;
  label: string;
  points: number;
  cityName: string;
  createdAt: string;
}

const mapRow = (r?: ProtoRow): BoardRow | undefined =>
  r
    ? {
        position: r.position,
        displayName: r.displayName,
        user: mapPublicUser(r.user),
        value: Number(r.value),
        isMe: r.isMe,
        rank: rankOf(r.rank),
      }
    : undefined;

export const gamificationKeys = {
  all: ["gamification"] as const,
  profile: () => [...gamificationKeys.all, "profile"] as const,
  board: (scope: BoardScope, metric: BoardMetric, cityId: string) =>
    [...gamificationKeys.all, "board", scope, metric, cityId] as const,
  ledger: () => [...gamificationKeys.all, "ledger"] as const,
};

export const useFieldProfile = (enabled: () => boolean = () => true) =>
  useAppQuery(() => ({
    queryKey: gamificationKeys.profile(),
    enabled: enabled(),
    queryFn: async (): Promise<FieldProfile> => {
      const p = (await client.getFieldProfile(create(GetFieldProfileRequestSchema, {}))).profile;
      return {
        lifetime: Number(p?.lifetimeScore ?? 0n),
        rank: rankOf(p?.overallRank ?? FieldRank.SCOUT),
        nextThreshold: Number(p?.overallNextThreshold ?? 0n),
        week: Number(p?.weekScore ?? 0n),
        lastWeek: Number(p?.lastWeekScore ?? 0n),
        cities: (p?.cities ?? []).map((c) => ({
          cityId: c.cityId,
          cityName: c.cityName,
          rank: rankOf(c.rank),
          score: Number(c.score),
          nextThreshold: Number(c.nextThreshold),
        })),
        placesKept: p?.placesKept ?? 0,
        daysFinished: p?.daysFinished ?? 0,
        weekStreak: {
          current: p?.weekStreak?.current ?? 0,
          longest: p?.weekStreak?.longest ?? 0,
          exploredThisWeek: p?.weekStreak?.exploredThisWeek ?? false,
          weekStart: p?.weekStreak?.weekStart ?? "",
        },
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
    queryKey: gamificationKeys.board(scope(), metric(), cityId()),
    enabled: enabled(),
    queryFn: async (): Promise<Board> => {
      const res = await client.getFieldBoard(
        create(GetFieldBoardRequestSchema, {
          scope: SCOPES[scope()],
          metric: METRICS[metric()],
          cityId: cityId(),
        }),
      );
      const p = res.personal;
      return {
        cityId: res.cityId,
        cityName: res.cityName,
        seasonStart: res.seasonStart ? timestampDate(res.seasonStart) : undefined,
        seasonEnd: res.seasonEnd ? timestampDate(res.seasonEnd) : undefined,
        top: res.top.flatMap((r) => mapRow(r) ?? []),
        me: mapRow(res.me),
        above: mapRow(res.above),
        scored: res.scoredUsers,
        tooFew: res.tooFew,
        friendsAvailable: res.friendsAvailable,
        meHidden: res.meHidden,
        personal: p
          ? {
              thisWeek: Number(p.thisWeek),
              lastWeek: Number(p.lastWeek),
              placesKept: p.placesKept,
              placesKeptLastWeek: p.placesKeptLastWeek,
              daysFinished: p.daysFinished,
              daysFinishedLastWeek: p.daysFinishedLastWeek,
            }
          : undefined,
      };
    },
  }));

/** The caller's own ledger: only rows that count toward the field score. */
export const useFieldLedger = (enabled: () => boolean = () => true) =>
  useAppQuery(() => ({
    queryKey: gamificationKeys.ledger(),
    enabled: enabled(),
    queryFn: async (): Promise<FieldEvent[]> => {
      const res = await client.listPointsHistory(
        create(ListPointsHistoryRequestSchema, { pageSize: 12, fieldOnly: true }),
      );
      return res.events.map((e) => ({
        id: e.id,
        label: e.label,
        points: e.fieldPoints,
        cityName: e.cityName,
        createdAt: e.createdAt ? timestampDate(e.createdAt).toISOString() : "",
      }));
    },
  }));

const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export interface MarkStopResult {
  mark: StopMark;
  points: number;
  dayFinished: boolean;
  tripFinished: boolean;
  /** Achievements (and track tiers) this mark earned. */
  unlocked: Achievement[];
}

/** Marks a stop of the caller's own trip done, skipped or open again. */
export const useMarkStop = () => {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (v: {
      tripId: string;
      dayId: string;
      stopId: string;
      mark: StopMark;
    }): Promise<MarkStopResult> => {
      const res = await client.markStop(
        create(MarkStopRequestSchema, {
          tripId: v.tripId,
          dayId: v.dayId,
          stopId: v.stopId,
          status: MARKS[v.mark],
          timezone: timezone(),
        }),
      );
      return {
        mark: stopMarkOf(res.status),
        points: res.pointsAwarded,
        dayFinished: res.dayFinished,
        tripFinished: res.tripFinished,
        unlocked: res.unlocked.map(mapAchievement),
      };
    },
    onSuccess: (res, v) => {
      celebrateUnlocks(res.unlocked);
      if (res.unlocked.length)
        void queryClient.invalidateQueries({ queryKey: achievementKeys.all });
      void queryClient.invalidateQueries({ queryKey: gamificationKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["trips", "detail", v.tripId] });
    },
  }));
};

const TZ_KEY = "loci_last_check_in_day";

const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Tells the server the browser's timezone once per local day. It awards
 * nothing; it decides which week the traveller's actions count in.
 */
export const useReportTimezone = () =>
  useMutation(() => ({
    mutationFn: async () => {
      await client.dailyCheckIn(create(DailyCheckInRequestSchema, { timezone: timezone() }));
      try {
        localStorage.setItem(TZ_KEY, localDay());
      } catch {
        // Private mode: a round trip a day is the cost.
      }
    },
  }));

export const reportedTimezoneToday = () => {
  try {
    return localStorage.getItem(TZ_KEY) === localDay();
  } catch {
    return false;
  }
};

/** "+18 this week · Guide in Madeira": the one line the profile carries. */
export const fieldLine = (p: FieldProfile) => {
  const top = p.cities[0];
  const where = top ? `${top.rank} in ${top.cityName}` : p.rank;
  return p.week > 0 ? `+${p.week} this week · ${where}` : where;
};

/** "3 weeks in a row", or what keeps it: "Explore this week to keep your 3-week streak". */
export const weekStreakLine = (w: WeekStreak): string => {
  if (w.current <= 0) return "Explore this week to start a streak";
  const weeks = `${w.current} week${w.current === 1 ? "" : "s"} in a row`;
  return w.exploredThisWeek ? weeks : `${weeks} · explore this week to keep it`;
};
