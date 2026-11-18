// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/api", () => ({ chatService: {} }));
vi.mock("~/lib/connect-transport", () => ({ transport: {} }));
const capture = vi.fn();
vi.mock("~/lib/analytics", () => ({ capture: (...a: unknown[]) => capture(...a) }));
import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { ActionProposalSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import { HotelComparisonReportSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/chat/hotel_report_pb.js";
import { TripDraftSchema, TripPace } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import HotelComparisonCard, {
  type HotelComparisonCardProps,
  type TripsSource,
} from "./HotelComparisonCard";
import type { TripActionApi } from "~/lib/api/trip-actions";
import type { Trip } from "~/lib/api/trips";
import type { StayWriter } from "~/lib/hotels/stay-from-report";
import { resetHotelAnalytics } from "~/lib/hotels/analytics";

const flush = () => new Promise((r) => setTimeout(r, 0));
let dispose: (() => void) | undefined;
beforeEach(() => {
  capture.mockReset();
  resetHotelAnalytics();
});
afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

const report = (over: Record<string, unknown> = {}) =>
  create(HotelComparisonReportSchema, {
    id: "r1",
    cityName: "Barcelona",
    verdict: "Verdi 254 is the better base: breakfast is included and the metro is closer.",
    recommendedIndex: 0,
    hotels: [
      {
        sourceUrl: "https://www.booking.com/Share-aaa",
        source: "booking.com",
        identified: true,
        userNote: "385 euros with breakfast",
        stay: {
          cityName: "Barcelona",
          name: "Verdi 254",
          address: "Carrer de Verdi 254",
          priceNote: "385 euros with breakfast",
          latitude: 41.41,
          longitude: 2.15,
          bookingUrl: "https://www.booking.com/hotel/es/verdi-254.html",
        },
        livePrice: {
          nightlyMinor: 12800n,
          totalMinor: 38400n,
          currency: "EUR",
          provider: "liteapi",
          bookingUrl: "https://partner.example/verdi",
        },
        facilities: ["Lift", "Air conditioning"],
        nearbyStops: [{ name: "Lesseps", lines: ["L3"], walkMinutes: 9 }],
        neighbourhood: "Upper Gràcia: quiet streets, a short ride from the centre.",
        pros: ["Breakfast included", "Close to Lesseps"],
        cons: ["A steep walk home"],
      },
      {
        sourceUrl: "https://www.booking.com/Share-bbb",
        source: "booking.com",
        identified: false,
        userNote: "349 without breakfast",
        stay: { cityName: "Barcelona", name: "Barcelona City North" },
        neighbourhood: "",
        pros: [],
        cons: ["Could not be matched, so little is known"],
      },
    ],
    rows: [
      { label: "You said", values: ["385 euros with breakfast", "349 without breakfast"] },
      { label: "Stars", values: ["3", "Not known"] },
      { label: "Nearest stops", values: ["Lesseps (L3), 9 min walk"] },
    ],
    caveats: ["Booking.com could not be read, so prices are yours, not checked."],
    sources: [
      { title: "Gràcia guide", url: "https://guide.example/gracia", publisher: "Example Guides" },
      { title: "Evil", url: "javascript:alert(1)", publisher: "x" },
      { title: "Plain http", url: "http://insecure.example", publisher: "y" },
    ],
    webSearchUsed: true,
    attribution: "Map data © OpenStreetMap contributors",
    ...over,
  });

const proposal = create(ActionProposalSchema, {
  id: "p1",
  tripId: "t1",
  summary: "Pick where to stay in Barcelona.",
  action: { kind: { case: "chooseStay", value: { cityName: "Barcelona", reportId: "r1" } } },
  options: [
    {
      label: "Verdi 254",
      choice: { case: "stay", value: { cityName: "Barcelona", name: "Verdi 254" } },
    },
    {
      label: "Barcelona City North",
      choice: { case: "stay", value: { cityName: "Barcelona", name: "Barcelona City North" } },
    },
  ],
});

const draft = (version: bigint, id = "t1", title = "Barcelona in May") =>
  create(TripDraftSchema, { id, title, version });

const actionApi = (over: Partial<TripActionApi> = {}): TripActionApi => ({
  apply: vi.fn(async () => ({ trip: draft(5n) })),
  dismiss: vi.fn(async () => {}),
  ...over,
});

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: "t1",
  userId: "u",
  cityName: "Barcelona",
  title: "Barcelona in May",
  version: 3n,
  constraints: { pace: TripPace.UNSPECIFIED, interests: [] },
  createdAt: "",
  updatedAt: "",
  days: [{ id: "d1", dayNumber: 1, stops: [] }],
  stays: [],
  flights: [],
  ...over,
});

const stayApi = (over: Partial<StayWriter> = {}): StayWriter => ({
  fetchTrip: vi.fn(async (id: string) => trip({ id, version: 7n })),
  setStay: vi.fn(async (id: string) => draft(8n, id)),
  ...over,
});

const trips = (list: Trip[]) => (): TripsSource => ({
  isPending: false,
  isError: false,
  data: list,
});

const mount = (props: Partial<HotelComparisonCardProps> = {}) => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(
    () => createComponent(HotelComparisonCard, { report: report(), source: "chat", ...props }),
    host,
  );
  return host;
};
const byId = (host: HTMLElement, id: string) =>
  host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const allById = (host: HTMLElement, id: string) =>
  [...host.querySelectorAll(`[data-testid="${id}"]`)] as HTMLElement[];

describe("HotelComparisonCard: the report", () => {
  it("names the hotels and the city, gives the verdict and marks Loci's pick", () => {
    const host = mount();
    expect(byId(host, "hotel-report-title")?.textContent).toBe(
      "Verdi 254 vs Barcelona City North · Barcelona",
    );
    expect(byId(host, "hotel-report-verdict")?.textContent).toContain("Verdi 254 is the better");
    const picks = allById(host, "hotel-report-pick");
    expect(picks).toHaveLength(1);
    expect(picks[0].closest("th")?.textContent).toContain("Verdi 254");
  });

  it("draws the server's rows as given, one value per hotel, with gaps said plainly", () => {
    const host = mount();
    const rows = [...host.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.children].map((c) => c.textContent),
    );
    expect(rows).toEqual([
      ["You said", "385 euros with breakfast", "349 without breakfast"],
      ["Stars", "3", "Not known"],
      // A row short of a value does not shift the table.
      ["Nearest stops", "Lesseps (L3), 9 min walk", "Not known"],
    ]);
  });

  it("writes nothing the rows already say a second time", () => {
    const host = mount();
    const text = host.textContent ?? "";
    // Each appears exactly once: in its row, not again under the hotel.
    expect(text.split("385 euros with breakfast")).toHaveLength(2);
    expect(text.split("Lesseps")).toHaveLength(3); // the row, and a "Good" point that names it
    expect(text).not.toContain("Air conditioning");
    expect(text).not.toContain("128");
  });

  it("under each hotel: area, good and watch out", () => {
    const host = mount();
    const [first, second] = allById(host, "hotel-report-hotel");
    expect(first.textContent).toContain("Area");
    expect(first.textContent).toContain("Upper Gràcia");
    expect(first.textContent).toContain("Good");
    expect(first.textContent).toContain("Breakfast included");
    expect(first.textContent).toContain("Watch out");
    expect(second.textContent).not.toContain("Area");
    expect(second.textContent).not.toContain("Good");
    expect(second.textContent).toContain("Could not be matched");
  });

  it("an unmatched hotel is still shown, with a quiet label", () => {
    const host = mount();
    const labels = allById(host, "hotel-report-unmatched");
    expect(labels).toHaveLength(1);
    expect(labels[0].textContent).toBe("Not matched to a known hotel");
    expect(labels[0].closest("th")?.textContent).toContain("Barcelona City North");
    expect(allById(host, "hotel-report-add")).toHaveLength(2);
  });

  it("no verdict: rows and caveats only, and nobody is the pick", () => {
    const host = mount({ report: report({ verdict: "", recommendedIndex: undefined }) });
    expect(byId(host, "hotel-report-verdict")).toBeNull();
    expect(byId(host, "hotel-report-pick")).toBeNull();
    expect(host.querySelectorAll("tbody tr")).toHaveLength(3);
    expect(byId(host, "hotel-report-caveats")?.textContent).toContain("could not be read");
  });

  it("sources are listed only when present, and only https ones are links", () => {
    const host = mount();
    const links = [...byId(host, "hotel-report-sources")!.querySelectorAll("a")];
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["https://guide.example/gracia"]);
    expect(links[0].getAttribute("target")).toBe("_blank");
    expect(links[0].getAttribute("rel")).toBe("noopener noreferrer");
    expect(byId(host, "hotel-report-sources")?.textContent).toContain(
      "Gràcia guide — Example Guides",
    );
    expect(host.textContent).not.toContain("Evil");
    dispose?.();
    const bare = mount({ report: report({ sources: [] }) });
    expect(byId(bare, "hotel-report-sources")).toBeNull();
    expect(bare.textContent).not.toContain("Sources");
  });

  it("the only other links are the booking ones, https and marked", () => {
    const host = mount();
    const hrefs = [...host.querySelectorAll("a")].map((a) => [
      a.getAttribute("href"),
      a.getAttribute("rel"),
      a.getAttribute("target"),
    ]);
    expect(hrefs).toEqual([
      ["https://partner.example/verdi", "sponsored noopener noreferrer", "_blank"],
      ["https://www.booking.com/hotel/es/verdi-254.html", "noopener noreferrer", "_blank"],
      ["https://guide.example/gracia", "noopener noreferrer", "_blank"],
    ]);
    // The pasted link itself is never made clickable.
    expect(host.innerHTML).not.toContain("Share-aaa");
  });

  it("a booking link that is not https is not a link", () => {
    const r = report();
    r.hotels[0].livePrice!.bookingUrl = "javascript:alert(1)";
    r.hotels[0].stay!.bookingUrl = "http://booking.example";
    const host = mount({ report: r });
    expect(allById(host, "hotel-report-hotel")[0].querySelector("a")).toBeNull();
  });

  it("report text is text: no HTML, no markdown, no links made from it", () => {
    const html = '<img src=x onerror="window.lociPwned = 1"><script>window.lociPwned = 1</script>';
    const md = "[x](javascript:alert(1)) **bold** https://evil.example";
    const r = report({
      verdict: `${html} ${md}`,
      caveats: [html, md],
      rows: [{ label: html, values: [md, html] }],
      attribution: html,
      cityName: "<b>Barcelona</b>",
    });
    r.hotels[0].neighbourhood = md;
    r.hotels[0].pros = [html];
    r.hotels[0].cons = [md];
    r.hotels[0].stay!.name = "<i>Verdi</i>";
    r.hotels[0].livePrice = undefined;
    r.hotels[0].stay!.bookingUrl = "";
    const host = mount({ report: r, proposal });

    expect(host.querySelector("img, script, b, i, strong, em")).toBeNull();
    expect((window as unknown as { lociPwned?: number }).lociPwned).toBeUndefined();
    // The markup is on screen as the characters it was sent as.
    expect(byId(host, "hotel-report-verdict")?.textContent).toBe(`${html} ${md}`);
    expect(byId(host, "hotel-report-title")?.textContent).toContain("<i>Verdi</i>");
    expect(host.textContent).toContain("**bold**");
    // Nothing in the text became a link: the one left is a real source.
    const hrefs = [...host.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["https://guide.example/gracia"]);
    expect(allById(host, "hotel-report-add")[0].textContent).toBe("Add <i>Verdi</i> to trip");
  });

  it("a hotel whose city Loci doesn't know gets no Add button, and says why", () => {
    const r = report();
    r.hotels[1].stay!.cityName = "";
    const host = mount({ report: r });
    expect(allById(host, "hotel-report-add").map((b) => b.textContent)).toEqual([
      "Add Verdi 254 to trip",
    ]);
    expect(byId(host, "hotel-report-no-city")?.textContent).toContain(
      "doesn't know which city Barcelona City North is in",
    );
  });

  it("counts the report once, with counts and booleans only", () => {
    mount({ proposal });
    dispose?.();
    mount({ proposal });
    const shown = capture.mock.calls.filter((c) => c[0] === "hotel_report_shown");
    expect(shown).toHaveLength(1);
    expect(shown[0][1]).toEqual({
      source: "chat",
      hotels: 2,
      identified: 1,
      has_verdict: true,
      has_pick: true,
      has_proposal: true,
      web_search_used: true,
      sources: 3,
    });
  });
});

describe("HotelComparisonCard: add through the stay proposal", () => {
  it("applies the tapped hotel's option against the trip's version, then confirms", async () => {
    const a = actionApi();
    const onAdded = vi.fn();
    const host = mount({ proposal, tripVersion: 3n, actionApi: a, onAdded });
    allById(host, "hotel-report-add")[1].click();
    await flush();
    expect(a.apply).toHaveBeenCalledWith("p1", 1, 3n);
    expect(onAdded).toHaveBeenCalledTimes(1);
    expect(onAdded.mock.calls[0][0]).toEqual({
      tripId: "t1",
      tripTitle: "Barcelona in May",
      hotelName: "Barcelona City North",
    });
    expect(onAdded.mock.calls[0][1].version).toBe(5n);
    const added = byId(host, "hotel-report-added")!;
    expect(added.textContent).toContain("Barcelona City North is now the stay on Barcelona in May");
    expect(added.querySelector("a")?.getAttribute("href")).toBe("/trips/t1");
    // The report's buttons are done.
    expect(allById(host, "hotel-report-add")).toHaveLength(0);
    expect(capture).toHaveBeenCalledWith("hotel_report_add_tapped", {
      source: "chat",
      via: "proposal",
      is_pick: false,
    });
    expect(capture).toHaveBeenCalledWith("stay_set_from_report", {
      source: "chat",
      via: "proposal",
      is_pick: false,
      identified: false,
    });
  });

  it("reads the trip for its version when the surface doesn't hold it", async () => {
    const a = actionApi();
    const s = stayApi();
    const host = mount({ proposal, actionApi: a, stayApi: s });
    allById(host, "hotel-report-add")[0].click();
    await flush();
    expect(s.fetchTrip).toHaveBeenCalledWith("t1");
    expect(a.apply).toHaveBeenCalledWith("p1", 0, 7n);
  });

  it("a stale trip it read itself is read again and applied once more", async () => {
    const apply = vi
      .fn()
      .mockRejectedValueOnce(new ConnectError("trip version conflict", Code.FailedPrecondition))
      .mockResolvedValueOnce({ trip: draft(9n) });
    const fetchTrip = vi
      .fn()
      .mockResolvedValueOnce(trip({ version: 7n }))
      .mockResolvedValueOnce(trip({ version: 8n }));
    const host = mount({
      proposal,
      actionApi: actionApi({ apply }),
      stayApi: stayApi({ fetchTrip }),
    });
    allById(host, "hotel-report-add")[0].click();
    await flush();
    expect(apply.mock.calls.map((c) => c[2])).toEqual([7n, 8n]);
    expect(byId(host, "hotel-report-added")).not.toBeNull();
    expect(byId(host, "hotel-report-error")).toBeNull();
  });

  it("a stale trip the surface holds keeps the card, says why and asks for a refetch", async () => {
    const a = actionApi({
      apply: vi.fn(async () => {
        throw new ConnectError("trip version conflict", Code.FailedPrecondition);
      }),
    });
    const onConflict = vi.fn();
    const onAdded = vi.fn();
    const host = mount({ proposal, tripVersion: 3n, actionApi: a, onConflict, onAdded });
    allById(host, "hotel-report-add")[0].click();
    await flush();
    expect(a.apply).toHaveBeenCalledTimes(1);
    expect(onAdded).not.toHaveBeenCalled();
    expect(onConflict).toHaveBeenCalledWith("t1");
    expect(byId(host, "hotel-report-error")?.textContent).toContain("changed");
    // Still there to tap again once the trip is fresh.
    const buttons = allById(host, "hotel-report-add") as HTMLButtonElement[];
    expect(buttons).toHaveLength(2);
    expect(buttons[0].disabled).toBe(false);
  });

  it("a used or expired proposal says so without asking for a refetch", async () => {
    const a = actionApi({
      apply: vi.fn(async () => {
        throw new ConnectError("proposal already applied", Code.FailedPrecondition);
      }),
    });
    const onConflict = vi.fn();
    const host = mount({ proposal, tripVersion: 3n, actionApi: a, onConflict });
    allById(host, "hotel-report-add")[0].click();
    await flush();
    expect(onConflict).not.toHaveBeenCalled();
    expect(byId(host, "hotel-report-error")?.textContent).toContain("already used");
  });

  it("a report already added shows the confirmation and no buttons", () => {
    const host = mount({
      proposal,
      added: { tripId: "t9", tripTitle: "Spring", hotelName: "Verdi 254" },
    });
    expect(allById(host, "hotel-report-add")).toHaveLength(0);
    expect(byId(host, "hotel-report-added")?.querySelector("a")?.getAttribute("href")).toBe(
      "/trips/t9",
    );
  });
});

describe("HotelComparisonCard: add through the trip picker", () => {
  const mine = trip({ id: "t1", title: "Barcelona in May" });
  const viaDay = trip({
    id: "t2",
    title: "Spain by train",
    cityName: "Madrid",
    days: [
      { id: "d1", dayNumber: 1, stops: [] },
      { id: "d2", dayNumber: 2, stops: [], cityName: "barcelona " },
    ],
  });
  const viaCities = trip({
    id: "t3",
    title: "Iberia",
    cityName: "Lisbon",
    cities: [{ cityName: "Lisbon" }, { cityName: "BARCELONA" }] as never,
  });
  const elsewhere = trip({ id: "t4", title: "Lisbon weekend", cityName: "Lisbon" });
  const someoneElses = trip({
    id: "t5",
    title: "Ana's Barcelona",
    owner: { id: "u2", displayName: "Ana" } as never,
    viewerRole: "co_planner",
  });

  it("with no proposal, Add opens the picker: trips with the city can be picked, others say why not", async () => {
    const host = mount({
      tripsSource: trips([elsewhere, someoneElses, mine, viaDay, viaCities]),
      stayApi: stayApi(),
    });
    expect(byId(host, "hotel-report-picker")).toBeNull();
    allById(host, "hotel-report-add")[0].click();
    await flush();
    const rows = allById(host, "hotel-report-trip") as HTMLButtonElement[];
    expect(rows.map((b) => [b.textContent, b.disabled])).toEqual([
      ["Barcelona in May", false],
      ["Spain by train", false],
      ["Iberia", false],
      ["Lisbon weekendBarcelona isn't on this trip", true],
      ["Ana's BarcelonaOnly the trip's planner can set the stay", true],
    ]);
    expect(byId(host, "hotel-report-plan")).toBeNull();
    expect(capture).toHaveBeenCalledWith("hotel_report_add_tapped", {
      source: "chat",
      via: "picker",
      is_pick: true,
    });
  });

  it("picking rereads the trip and saves the hotel's stay under the trip's spelling of the city", async () => {
    const s = stayApi({
      fetchTrip: vi.fn(async () => ({ ...viaDay, version: 12n })),
      setStay: vi.fn(async () => draft(13n, "t2", "Spain by train")),
    });
    const onAdded = vi.fn();
    const host = mount({ tripsSource: trips([mine, viaDay]), stayApi: s, onAdded });
    allById(host, "hotel-report-add")[0].click();
    await flush();
    allById(host, "hotel-report-trip")[1].click();
    await flush();
    expect(s.fetchTrip).toHaveBeenCalledWith("t2");
    expect(s.setStay).toHaveBeenCalledTimes(1);
    const [tripId, stay, version] = (s.setStay as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(tripId).toBe("t2");
    expect(version).toBe(12n);
    expect(stay).toMatchObject({
      cityName: "barcelona ",
      name: "Verdi 254",
      address: "Carrer de Verdi 254",
      priceNote: "385 euros with breakfast",
      latitude: 41.41,
      longitude: 2.15,
      bookingUrl: "https://www.booking.com/hotel/es/verdi-254.html",
    });
    expect(onAdded.mock.calls[0][0]).toEqual({
      tripId: "t2",
      tripTitle: "Spain by train",
      hotelName: "Verdi 254",
    });
    expect(byId(host, "hotel-report-added")?.querySelector("a")?.getAttribute("href")).toBe(
      "/trips/t2",
    );
    expect(byId(host, "hotel-report-picker")).toBeNull();
    expect(capture).toHaveBeenCalledWith("stay_set_from_report", {
      source: "chat",
      via: "picker",
      is_pick: true,
      identified: true,
    });
  });

  it("a version conflict is retried once against the trip as it now is", async () => {
    const setStay = vi
      .fn()
      .mockRejectedValueOnce(new ConnectError("trip version conflict", Code.FailedPrecondition))
      .mockResolvedValueOnce(draft(15n));
    const fetchTrip = vi
      .fn()
      .mockResolvedValueOnce({ ...mine, version: 12n })
      .mockResolvedValueOnce({ ...mine, version: 14n });
    const host = mount({ tripsSource: trips([mine]), stayApi: { fetchTrip, setStay } });
    allById(host, "hotel-report-add")[0].click();
    await flush();
    allById(host, "hotel-report-trip")[0].click();
    await flush();
    expect(setStay.mock.calls.map((c) => c[2])).toEqual([12n, 14n]);
    expect(byId(host, "hotel-report-added")).not.toBeNull();
  });

  it("a second conflict is an error, and the picker stays", async () => {
    const setStay = vi.fn(async () => {
      throw new ConnectError("trip version conflict", Code.FailedPrecondition);
    });
    const host = mount({ tripsSource: trips([mine]), stayApi: stayApi({ setStay }) });
    allById(host, "hotel-report-add")[0].click();
    await flush();
    allById(host, "hotel-report-trip")[0].click();
    await flush();
    expect(setStay).toHaveBeenCalledTimes(2);
    expect(byId(host, "hotel-report-error")?.textContent).toContain("Couldn't add Verdi 254");
    expect(byId(host, "hotel-report-picker")).not.toBeNull();
    expect(byId(host, "hotel-report-added")).toBeNull();
  });

  it("with no trip that can take it, offers to plan one", async () => {
    const onPlanTrip = vi.fn();
    const host = mount({ tripsSource: trips([elsewhere]), stayApi: stayApi(), onPlanTrip });
    allById(host, "hotel-report-add")[0].click();
    await flush();
    expect(byId(host, "hotel-report-no-trip")?.textContent).toContain("Barcelona");
    const plan = byId(host, "hotel-report-plan")!;
    expect(plan.textContent).toBe("Plan a Barcelona trip");
    plan.click();
    expect(onPlanTrip).toHaveBeenCalledWith("Plan a trip to Barcelona", "Barcelona");
  });

  it("no trips at all is the same offer; a list still loading offers nothing yet", async () => {
    const onPlanTrip = vi.fn();
    const host = mount({ tripsSource: trips([]), stayApi: stayApi(), onPlanTrip });
    allById(host, "hotel-report-add")[1].click();
    await flush();
    expect(byId(host, "hotel-report-plan")).not.toBeNull();
    dispose?.();
    const loading = mount({
      tripsSource: () => ({ isPending: true, isError: false }),
      stayApi: stayApi(),
      onPlanTrip,
    });
    allById(loading, "hotel-report-add")[0].click();
    await flush();
    expect(byId(loading, "hotel-report-picker")?.textContent).toContain("Loading your trips");
    expect(byId(loading, "hotel-report-plan")).toBeNull();
  });
});
