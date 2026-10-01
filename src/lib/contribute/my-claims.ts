import type { ClaimStatus, PlaceFactField } from "~/lib/api/place-intelligence";
import { factValueLabel, fieldLabel } from "~/lib/place-facts/vocabulary";

/** What the row says when the place behind a report has since been removed. */
export const REMOVED_PLACE_NAME = "A place since removed";

/** ListMyClaims page size. The server defaults to 20 too; sent explicitly. */
export const MY_CLAIMS_PAGE_SIZE = 20;

/** One of the scout's own reports as ListMyClaims returns it, before wording. */
export interface MyClaimWire {
  claimId: string;
  poiId: string;
  poiName: string;
  field: PlaceFactField;
  value: string;
  status: ClaimStatus;
  createdAt?: Date;
}

/** The row "My reports" draws. */
export interface MyClaim {
  id: string;
  poiId: string;
  placeName: string;
  /** False when the place has since been removed, so there is nothing to link to. */
  placeExists: boolean;
  field: PlaceFactField;
  fieldLabel: string;
  /** The value as sent, kept for anything that needs the token. */
  value: string;
  /** The value in the picker's words: opening hours as a week, tokens as labels. */
  valueText: string;
  status: ClaimStatus;
  statusText: string;
  createdAt?: Date;
}

/**
 * The words ClaimResult uses for the same outcome, so a report reads the same
 * on the form that filed it and in the list afterwards. A pending report is
 * "Recorded" there too: it is half a fact, waiting on a second scout.
 */
export const claimStatusText = (status: ClaimStatus): string => {
  switch (status) {
    case "ACCEPTED":
      return "Verified";
    case "CONTRADICTED":
      return "Noted — reports differ";
    case "EXPIRED":
      return "Expired";
    default:
      return "Recorded";
  }
};

export const toMyClaim = (wire: MyClaimWire): MyClaim => {
  const removed = wire.poiName.trim() === "";
  return {
    id: wire.claimId,
    poiId: wire.poiId,
    placeName: removed ? REMOVED_PLACE_NAME : wire.poiName,
    placeExists: !removed && wire.poiId !== "",
    field: wire.field,
    fieldLabel: fieldLabel(wire.field),
    value: wire.value,
    valueText: factValueLabel(wire.field, wire.value),
    status: wire.status,
    statusText: claimStatusText(wire.status),
    createdAt: wire.createdAt,
  };
};

/** One ListMyClaims page, already mapped. */
export interface MyClaimsPage {
  page: number;
  claims: MyClaim[];
  total: number;
}

/**
 * The page "Load more" asks for next, or undefined when there is none.
 *
 * `total` is the server's count of all the scout's claims; the newest page's
 * figure wins, since a report filed between loads moves it. A short or empty
 * page also ends the list, so a total that disagrees with the rows can never
 * leave the button asking for pages that will not come.
 */
export const nextMyClaimsPage = (
  pages: MyClaimsPage[],
  pageSize = MY_CLAIMS_PAGE_SIZE,
): number | undefined => {
  const last = pages.at(-1);
  if (!last) return 1;
  if (last.claims.length < pageSize) return undefined;
  const loaded = pages.reduce((sum, page) => sum + page.claims.length, 0);
  return loaded < last.total ? last.page + 1 : undefined;
};

/**
 * Every loaded row, in order. A claim filed while the scout was paging shifts
 * the offsets by one, which would show the boundary row twice; the first
 * sighting wins.
 */
export const flattenMyClaims = (pages: MyClaimsPage[]): MyClaim[] => {
  const seen = new Set<string>();
  const rows: MyClaim[] = [];
  for (const page of pages) {
    for (const claim of page.claims) {
      if (seen.has(claim.id)) continue;
      seen.add(claim.id);
      rows.push(claim);
    }
  }
  return rows;
};
