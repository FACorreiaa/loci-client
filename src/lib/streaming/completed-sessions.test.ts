import { beforeEach, describe, expect, it } from "vitest";
import { loadCompletedSession, saveCompletedSession } from "./completed-sessions";

describe("completed sessions", () => {
  beforeEach(() => sessionStorage.clear());

  it("keeps several finished sessions side by side", () => {
    saveCompletedSession("a", { session_id: "a", hotels: [1] });
    saveCompletedSession("b", { session_id: "b", activities: [2] });
    expect(loadCompletedSession("a")).toEqual({ session_id: "a", hotels: [1] });
    expect(loadCompletedSession("b")).toEqual({ session_id: "b", activities: [2] });
  });

  it("drops the oldest beyond five", () => {
    for (const id of ["1", "2", "3", "4", "5", "6"]) saveCompletedSession(id, { session_id: id });
    expect(loadCompletedSession("1")).toBeNull();
    expect(loadCompletedSession("6")).toEqual({ session_id: "6" });
  });

  it("survives garbage in storage", () => {
    sessionStorage.setItem("loci.completedSessions", "{not json");
    expect(loadCompletedSession("a")).toBeNull();
  });
});
