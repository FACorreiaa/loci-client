// Access needs are health data the server stores only with consent, and the
// notes and walks built from them are claims a traveller may rely on to get
// through a door. These tests pin what goes on the wire, when, and how sure
// each claim is allowed to look.
import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import { timestampNow } from "@bufbuild/protobuf/wkt";
import {
  AccessibilityNeedsSchema,
  MaxIncline,
  MobilityLevel,
} from "@buf/loci_loci-proto.bufbuild_es/loci/profile/profile_pb.js";
import {
  AccessibilityNoteSchema,
  AccessibilityNoteSeverity,
  AccessibilityNoteSource,
} from "@buf/loci_loci-proto.bufbuild_es/loci/poi/poi_pb.js";
import { AccessibleRoutePayloadSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import {
  accessibilityCreateFields,
  accessibilityFormFor,
  accessibilityUpdateFields,
  accessibleRouteFromProto,
  bySeverity,
  canEditNeeds,
  deleteNeeds,
  emptyNeeds,
  legBetween,
  needsActive,
  needsFromProto,
  needsStepFree,
  needsToProto,
  noteFromProto,
  routeRef,
  sourceLabel,
  withAccessibleRoute,
  type AccessibilityNeeds,
  type AccessibleRoute,
} from "./accessibility";

const wheelchair = (): AccessibilityNeeds => ({
  ...emptyNeeds(),
  mobility: "manual_wheelchair",
  max_walk_minutes_per_leg: 15,
  max_incline: "pct_6",
  needs_accessible_toilet: true,
  notes: "I can manage one small step",
});

describe("needs on the wire", () => {
  it("round-trips through the proto", () => {
    const sent = needsToProto(wheelchair());
    expect(sent.mobility).toBe(MobilityLevel.MANUAL_WHEELCHAIR);
    expect(sent.maxIncline).toBe(MaxIncline.PCT_6);
    expect(sent.consentAt).toBeUndefined();
    const back = needsFromProto({ ...sent, consentAt: timestampNow() });
    expect(back).toEqual(wheelchair());
  });

  it("reads needs without a consent timestamp as none", () => {
    expect(needsFromProto(needsToProto(wheelchair()))).toBeNull();
    expect(needsFromProto(undefined)).toBeNull();
  });

  it("reads unspecified enums as no constraint", () => {
    const p = create(AccessibilityNeedsSchema, { consentAt: timestampNow() });
    expect(needsFromProto(p)).toEqual(emptyNeeds());
  });

  it("trims and caps the note", () => {
    const sent = needsToProto({ ...emptyNeeds(), notes: `  ${"x".repeat(600)}  ` });
    expect(sent.notes).toHaveLength(500);
  });

  it("treats an untouched form as no needs, like the server", () => {
    expect(needsActive(emptyNeeds())).toBe(false);
    expect(needsActive({ ...emptyNeeds(), notes: "   " })).toBe(false);
    expect(needsActive({ ...emptyNeeds(), blind: true })).toBe(true);
  });

  it("wants step-free routes for wheels and strollers", () => {
    expect(needsStepFree(wheelchair())).toBe(true);
    expect(needsStepFree({ ...emptyNeeds(), stroller: true })).toBe(true);
    expect(needsStepFree({ ...emptyNeeds(), mobility: "walking_aid" })).toBe(false);
  });
});

describe("consent", () => {
  it("locks the fields until consent is given", () => {
    const s = accessibilityFormFor(null);
    expect(canEditNeeds(s)).toBe(false);
    expect(canEditNeeds({ ...s, consentGiven: true })).toBe(true);
  });

  it("opens consented needs unlocked", () => {
    expect(canEditNeeds(accessibilityFormFor(wheelchair()))).toBe(true);
  });

  it("sends nothing on create without consent, even when needs are filled", () => {
    const s = { ...accessibilityFormFor(null), needs: wheelchair() };
    expect(accessibilityCreateFields(s)).toEqual({});
  });

  it("sends needs with the consent flag on create", () => {
    const s = { ...accessibilityFormFor(null), needs: wheelchair(), consentGiven: true };
    const f = accessibilityCreateFields(s);
    expect(f.accessibilityConsentGiven).toBe(true);
    expect(f.accessibilityNeeds?.mobility).toBe(MobilityLevel.MANUAL_WHEELCHAIR);
  });

  it("sends nothing on create for consent with empty needs", () => {
    expect(
      accessibilityCreateFields({ ...accessibilityFormFor(null), consentGiven: true }),
    ).toEqual({});
  });
});

describe("update", () => {
  it("does not re-send unchanged needs", () => {
    expect(accessibilityUpdateFields(accessibilityFormFor(wheelchair()))).toEqual({});
  });

  it("sends changed needs without asking for consent again", () => {
    const s = accessibilityFormFor(wheelchair());
    const f = accessibilityUpdateFields({ ...s, needs: { ...s.needs, blind: true } });
    expect(f.accessibilityNeeds?.blind).toBe(true);
    expect(f.accessibilityConsentGiven).toBeUndefined();
    expect(f.clearAccessibilityNeeds).toBeUndefined();
  });

  it("deletes, and deleting withdraws consent", () => {
    const deleted = deleteNeeds(accessibilityFormFor(wheelchair()));
    expect(deleted.clear).toBe(true);
    expect(deleted.needs).toEqual(emptyNeeds());
    expect(canEditNeeds(deleted)).toBe(false);
    expect(accessibilityUpdateFields(deleted)).toEqual({ clearAccessibilityNeeds: true });
  });

  it("treats emptying every field as a delete", () => {
    const s = { ...accessibilityFormFor(wheelchair()), needs: emptyNeeds() };
    expect(accessibilityUpdateFields(s)).toEqual({ clearAccessibilityNeeds: true });
  });

  it("lets a traveller delete and re-consent in one sitting", () => {
    const again = {
      ...deleteNeeds(accessibilityFormFor(wheelchair())),
      consentGiven: true,
      needs: { ...emptyNeeds(), blind: true },
    };
    const f = accessibilityUpdateFields(again);
    expect(f.clearAccessibilityNeeds).toBeUndefined();
    expect(f.accessibilityConsentGiven).toBe(true);
    expect(f.accessibilityNeeds?.blind).toBe(true);
  });

  it("does nothing for a profile that never had needs", () => {
    expect(accessibilityUpdateFields(accessibilityFormFor(null))).toEqual({});
    expect(accessibilityUpdateFields(deleteNeeds(accessibilityFormFor(null)))).toEqual({});
  });
});

describe("notes", () => {
  it("never shows an unknown source or severity as surer than an AI estimate", () => {
    const n = noteFromProto(create(AccessibilityNoteSchema, { text: "Ramp at side door" }));
    expect(n.source).toBe("ai_estimate");
    expect(n.severity).toBe("caution");
    expect(sourceLabel(n)).toBe("AI estimate · check ahead");
  });

  it("labels open data with its licence", () => {
    const n = noteFromProto(
      create(AccessibilityNoteSchema, {
        text: "Step-free entrance",
        severity: AccessibilityNoteSeverity.INFO,
        source: AccessibilityNoteSource.OPEN_DATA,
        sourceLicence: "ODbL",
      }),
    );
    expect(sourceLabel(n)).toBe("Open data · ODbL");
  });

  it("puts barriers first and keeps order within a level", () => {
    const sorted = bySeverity([
      { text: "a", severity: "info", source: "routed" },
      { text: "b", severity: "barrier", source: "routed" },
      { text: "c", severity: "caution", source: "routed" },
      { text: "d", severity: "barrier", source: "routed" },
    ]);
    expect(sorted.map((n) => n.text)).toEqual(["b", "d", "c", "a"]);
  });
});

describe("walking legs", () => {
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";

  const route = (day: number): AccessibleRoute =>
    accessibleRouteFromProto(
      create(AccessibleRoutePayloadSchema, {
        day,
        totalWalkMinutes: 12,
        legs: [
          {
            fromPoiId: A,
            toPoiId: B,
            distanceM: 800,
            durationMin: 12,
            routed: true,
            suggestMode: "helicopter",
          },
        ],
      }),
    );

  it("drops a suggested mode it does not know", () => {
    expect(route(1).legs[0].suggest_mode).toBeUndefined();
  });

  it("names a stop by id, or by name when the server had no id", () => {
    expect(routeRef({ id: A, name: "Castle" })).toBe(A);
    expect(routeRef({ id: "castle-lisbon", name: "Castle" })).toBe("Castle");
    expect(routeRef({ id: "00000000-0000-0000-0000-000000000000", name: "Castle" })).toBe("Castle");
  });

  it("draws a leg only between the two stops it connects", () => {
    expect(legBetween(route(1), A, B)?.duration_min).toBe(12);
    // Same destination, different previous card: the client ordered the day
    // differently from the server, and the walk is not this one.
    expect(legBetween(route(1), "Elsewhere", B)).toBeUndefined();
    expect(legBetween(route(1), undefined, A)).toBeUndefined();
  });

  it("replaces a day's route and keeps the rest in order", () => {
    let routes = withAccessibleRoute(undefined, route(2));
    routes = withAccessibleRoute(routes, route(1));
    routes = withAccessibleRoute(routes, { ...route(2), total_walk_minutes: 40 });
    expect(routes.map((r) => [r.day, r.total_walk_minutes])).toEqual([
      [1, 12],
      [2, 40],
    ]);
  });
});
