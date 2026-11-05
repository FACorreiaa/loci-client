import { ContextEntityType } from "@buf/loci_loci-proto.bufbuild_es/loci/assistant/assistant_pb.js";

export interface ScreenContext {
  /** An open vocabulary the server reads as a hint, never as a limit. */
  screen: string;
  entities: { type: ContextEntityType; id: string }[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Routes whose second segment is the id of the thing on screen. */
const DETAIL_ROUTES: Record<string, { screen: string; type: ContextEntityType }> = {
  trips: { screen: "trip_detail", type: ContextEntityType.TRIP },
  lists: { screen: "list_detail", type: ContextEntityType.LIST },
  places: { screen: "place_detail", type: ContextEntityType.POI },
};

/**
 * What the person is looking at, from the path alone.
 *
 * Only a real id becomes an entity: /lists/import is a screen, not a list. The
 * server checks the caller's access to every id before reading it, so getting
 * this wrong costs a hint and nothing else.
 */
export function contextFromPath(pathname: string): ScreenContext {
  const [first = "", second = ""] = pathname.split("/").filter(Boolean);
  if (!first) return { screen: "home", entities: [] };
  const detail = DETAIL_ROUTES[first];
  if (detail && UUID.test(second)) {
    return { screen: detail.screen, entities: [{ type: detail.type, id: second }] };
  }
  return { screen: first.replace(/[^a-z0-9_-]/gi, "_").slice(0, 64), entities: [] };
}
