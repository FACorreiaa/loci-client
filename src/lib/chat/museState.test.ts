import { describe, expect, it } from "vitest";
import {
  MUSE_CELEBRATE_MS,
  MUSE_FAILED_MS,
  MUSE_STATUS,
  initialMuseState,
  museIsWorking,
  museSettleDelay,
  nextMuseState,
  progressStatus,
  type MuseInput,
  type MuseState,
} from "./museState";

const run = (inputs: MuseInput[], from: MuseState = initialMuseState): MuseState =>
  inputs.reduce(nextMuseState, from);

describe("museState — stream events", () => {
  it("starts idle and Ready, without a ring", () => {
    expect(initialMuseState.phase).toBe("idle");
    expect(initialMuseState.status).toBe("Ready");
    expect(museIsWorking(initialMuseState)).toBe(false);
  });

  it("start → is thinking, with the working ring", () => {
    const s = run([{ kind: "start" }]);
    expect(s).toMatchObject({ phase: "working", status: "is thinking" });
    expect(museIsWorking(s)).toBe(true);
  });

  it("sending shows thinking before the server answers", () => {
    expect(run([{ kind: "send" }])).toMatchObject({
      phase: "working",
      status: "is thinking",
    });
  });

  it.each(["token", "partial"] as const)("%s → is writing", (kind) => {
    expect(run([{ kind: "start" }, { kind }])).toMatchObject({
      phase: "working",
      status: "is writing",
    });
  });

  it("progress → is {stage}", () => {
    expect(run([{ kind: "start" }, { kind: "progress", stage: "checking hotels" }])).toMatchObject({
      phase: "working",
      status: "is checking hotels",
    });
  });

  it.each([
    "itinerary",
    "hotels",
    "restaurants",
    "activities",
    "general_pois",
    "city_data",
  ] as const)("%s → found places", (kind) => {
    expect(run([{ kind: "start" }, { kind }])).toMatchObject({
      phase: "working",
      status: "found places",
    });
  });

  it("tokens after results go back to writing", () => {
    expect(run([{ kind: "start" }, { kind: "hotels" }, { kind: "token" }]).status).toBe(
      "is writing",
    );
  });

  it("complete → celebrating for 1.2s, then idle Ready", () => {
    const done = run([{ kind: "start" }, { kind: "token" }, { kind: "complete" }]);
    expect(done).toMatchObject({ phase: "celebrating", status: "is done" });
    expect(museIsWorking(done)).toBe(false);
    expect(museSettleDelay(done.phase)).toBe(MUSE_CELEBRATE_MS);
    expect(MUSE_CELEBRATE_MS).toBe(1200);
    expect(nextMuseState(done, { kind: "settle" })).toMatchObject({
      phase: "idle",
      status: "Ready",
    });
  });

  it("a second complete does not restart the celebration", () => {
    const done = run([{ kind: "start" }, { kind: "complete" }]);
    expect(nextMuseState(done, { kind: "complete" })).toBe(done);
  });

  it("error → hit a snag, then idle", () => {
    const failed = run([{ kind: "start" }, { kind: "error" }]);
    expect(failed).toMatchObject({ phase: "failed", status: "hit a snag" });
    expect(museIsWorking(failed)).toBe(false);
    expect(museSettleDelay(failed.phase)).toBe(MUSE_FAILED_MS);
    expect(nextMuseState(failed, { kind: "settle" })).toMatchObject({
      phase: "idle",
      status: "Ready",
    });
  });

  it("a complete after an error does not celebrate", () => {
    const failed = run([{ kind: "start" }, { kind: "error" }]);
    expect(nextMuseState(failed, { kind: "complete" })).toBe(failed);
  });

  it("repeated identical events keep the same state object (no re-announce)", () => {
    const writing = run([{ kind: "start" }, { kind: "token" }]);
    expect(nextMuseState(writing, { kind: "token" })).toBe(writing);
  });
});

describe("museState — composer", () => {
  it("focus while idle → is listening; blur → Ready", () => {
    const listening = run([{ kind: "focus" }]);
    expect(listening).toMatchObject({
      phase: "listening",
      status: "is listening",
    });
    expect(museIsWorking(listening)).toBe(false);
    expect(nextMuseState(listening, { kind: "blur" })).toMatchObject({
      phase: "idle",
      status: "Ready",
    });
  });

  it("focus does not interrupt a working stream", () => {
    const s = run([{ kind: "start" }, { kind: "token" }, { kind: "focus" }]);
    expect(s).toMatchObject({ phase: "working", status: "is writing" });
  });

  it("settling lands on listening when the composer was re-focused", () => {
    const s = run([{ kind: "send" }, { kind: "complete" }, { kind: "focus" }, { kind: "settle" }]);
    expect(s).toMatchObject({ phase: "listening", status: "is listening" });
  });

  it("send forgets focus, since the composer is disabled while streaming", () => {
    const s = run([{ kind: "focus" }, { kind: "send" }, { kind: "complete" }, { kind: "settle" }]);
    expect(s).toMatchObject({ phase: "idle", status: "Ready" });
  });

  it("settle outside celebrating/failed changes nothing", () => {
    const working = run([{ kind: "start" }]);
    expect(nextMuseState(working, { kind: "settle" })).toBe(working);
    expect(museSettleDelay("working")).toBeNull();
    expect(museSettleDelay("idle")).toBeNull();
  });
});

describe("progressStatus", () => {
  it.each([
    ["searching places", "is searching places"],
    ["planning your day", "is planning your day"],
    ["Checking hotels", "is checking hotels"],
    ["looking up that place...", "is looking up that place"],
  ])("%s → %s", (stage, want) => {
    expect(progressStatus(stage)).toBe(want);
  });

  it.each<[string | undefined, string]>([
    ["", "empty"],
    [undefined, "missing"],
    ["progress", "the chatStream placeholder"],
    ["semantic_context_ready", "a raw status code from an older server"],
    ["Processing: Adding Point of Interest with semantic enhancement...", "a long sentence"],
  ])("%s (%s) → is working on it", (stage) => {
    expect(progressStatus(stage)).toBe(MUSE_STATUS.working);
  });

  it("every status fits the header", () => {
    for (const s of Object.values(MUSE_STATUS)) expect(s.length).toBeLessThanOrEqual(35);
  });
});
