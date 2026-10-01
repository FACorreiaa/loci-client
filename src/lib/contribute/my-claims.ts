import type { ClaimStatus, PlaceFactField } from "~/lib/api/place-intelligence";
import { fieldLabel } from "~/lib/place-facts/vocabulary";

/** What the row says when the place behind a report has since been removed. */
export const REMOVED_PLACE_NAME = "A place since removed";

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

/** The row "Your reports" draws. */
export interface MyClaim {
  id: string;
  poiId: string;
  placeName: string;
  field: PlaceFactField;
  fieldLabel: string;
  value: string;
  status: ClaimStatus;
  statusText: string;
  createdAt?: Date;
}

/** The claim form's own words for an outcome (ClaimResult.tsx), one per status. */
export const claimStatusText = (status: ClaimStatus): string => {
  switch (status) {
    case "PENDING":
      return "Waiting on a second scout";
    case "ACCEPTED":
      return "Verified";
    case "CONTRADICTED":
      return "Reports differ";
    case "EXPIRED":
      return "Expired";
    default:
      return "Recorded";
  }
};

export const toMyClaim = (wire: MyClaimWire): MyClaim => ({
  id: wire.claimId,
  poiId: wire.poiId,
  placeName: wire.poiName.trim() === "" ? REMOVED_PLACE_NAME : wire.poiName,
  field: wire.field,
  fieldLabel: fieldLabel(wire.field),
  value: wire.value,
  status: wire.status,
  statusText: claimStatusText(wire.status),
  createdAt: wire.createdAt,
});
