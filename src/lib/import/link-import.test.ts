import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { describe, expect, it, vi } from "vitest";
import {
  ImportPlacesResponseSchema,
  ImportSource,
} from "@buf/loci_loci-proto.bufbuild_es/loci/place/place_intelligence_pb.js";
import {
  defaultListName,
  defaultSelection,
  importErrorMessage,
  retryAfterSave,
  saveImported,
  savedAs,
  toImportView,
} from "./link-import";

const response = () =>
  create(ImportPlacesResponseSchema, {
    source: ImportSource.TIKTOK,
    sourceTitle: "3 bakeries in Lisbon 🥐 #lisbon",
    cityName: "Lisbon",
    places: [
      {
        name: "Manteigaria",
        cityName: "Lisbon",
        note: "best nata",
        poiId: "p1",
        poiName: "Manteigaria - Fábrica de Pastéis de Nata",
        address: "R. do Loreto 2",
      },
      { name: "Ghost Café", cityName: "Lisbon" },
      { name: "Aloma", cityName: "Lisbon", poiId: "p3", poiName: "aloma" },
    ],
  });

describe("toImportView", () => {
  it("keeps every place, marking the ones that cannot be saved", () => {
    const view = toImportView(response());
    expect(view.source).toBe("TikTok");
    expect(view.places.map((p) => [p.name, p.poiId ?? null])).toEqual([
      ["Manteigaria", "p1"],
      ["Ghost Café", null],
      ["Aloma", "p3"],
    ]);
    expect(view.places[0].address).toBe("R. do Loreto 2");
    expect(new Set(view.places.map((p) => p.key)).size).toBe(3);
  });

  it("names the Loci place that will be saved when it is not the link's name", () => {
    const [manteigaria, ghost, aloma] = toImportView(response()).places;
    expect(savedAs(manteigaria)).toBe("Manteigaria - Fábrica de Pastéis de Nata");
    expect(savedAs(ghost)).toBeUndefined();
    expect(savedAs(aloma)).toBeUndefined();
  });

  it("starts with every saveable place picked", () => {
    const view = toImportView(response());
    expect([...defaultSelection(view.places)]).toEqual([view.places[0].key, view.places[2].key]);
  });
});

describe("defaultListName", () => {
  it("uses the title, cut to fit", () => {
    expect(defaultListName(toImportView(response()))).toBe("3 bakeries in Lisbon 🥐 #lisbon");
    const long = create(ImportPlacesResponseSchema, {
      sourceTitle: "x".repeat(200),
      cityName: "Porto",
    });
    expect(defaultListName(toImportView(long))).toHaveLength(60);
  });

  it("falls back to the city, then a plain name", () => {
    expect(
      defaultListName(toImportView(create(ImportPlacesResponseSchema, { cityName: "Porto" }))),
    ).toBe("Places in Porto");
    expect(defaultListName(toImportView(create(ImportPlacesResponseSchema, {})))).toBe(
      "Imported places",
    );
  });
});

describe("saveImported", () => {
  const picked = () => toImportView(response()).places.filter((p) => p.poiId);

  it("creates the list first, then adds each place in order", async () => {
    const calls: string[] = [];
    const deps = {
      createList: vi.fn(async (name: string) => {
        calls.push(`create:${name}`);
        return "L1";
      }),
      addItem: vi.fn(async (listId: string, poiId: string) => {
        calls.push(`add:${listId}:${poiId}`);
      }),
    };
    const out = await saveImported(deps, { newListName: "Bakeries" }, picked());
    expect(calls).toEqual(["create:Bakeries", "add:L1:p1", "add:L1:p3"]);
    expect(out).toEqual({
      listId: "L1",
      created: { id: "L1", name: "Bakeries" },
      added: 2,
      already: 0,
      failed: 0,
      failedKeys: [],
    });
  });

  it("counts a place already in the list as there, and carries on past a failure", async () => {
    const deps = {
      createList: vi.fn(),
      addItem: vi
        .fn()
        .mockRejectedValueOnce(new ConnectError("exists", Code.AlreadyExists))
        .mockRejectedValueOnce(new Error("network")),
    };
    const out = await saveImported(deps, { listId: "L9" }, picked());
    expect(deps.createList).not.toHaveBeenCalled();
    expect(out).toEqual({
      listId: "L9",
      added: 0,
      already: 1,
      failed: 1,
      failedKeys: [picked()[1].key],
    });
  });

  it("retries only the failed places, into the list the first try created", async () => {
    const deps = {
      createList: vi.fn(async () => "L1"),
      addItem: vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("network")),
    };
    const places = picked();
    const out = await saveImported(deps, { newListName: "Bakeries" }, places);
    const next = retryAfterSave(out);
    expect(next.listChoice).toBe("L1");
    expect([...next.picked]).toEqual([places[1].key]);
  });

  it("never sends a place without a Loci id", async () => {
    const deps = { createList: vi.fn(), addItem: vi.fn(async () => {}) };
    const all = toImportView(response()).places;
    const out = await saveImported(deps, { listId: "L9" }, all);
    expect(deps.addItem).toHaveBeenCalledTimes(2);
    expect(out.added).toBe(2);
  });
});

describe("importErrorMessage", () => {
  it("says what went wrong in words", () => {
    expect(
      importErrorMessage(new ConnectError("not a link Loci can open", Code.InvalidArgument)),
    ).toMatch(/public link/);
    expect(
      importErrorMessage(new ConnectError("no places found on that page", Code.FailedPrecondition)),
    ).toBe("No places found on that page.");
    expect(importErrorMessage(new ConnectError("x", Code.Unavailable))).toMatch(/Try again/);
    expect(importErrorMessage(new Error("boom"))).toMatch(/Couldn't import/);
  });
});
