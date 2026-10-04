import { describe, expect, it, vi } from "vitest";

vi.mock("../connect-transport", () => ({ transport: {} }));
// Pulls in the router, which reads window at import.
vi.mock("../auth/useAuthGate", () => ({ useAuthGate: () => ({}) }));

import { create } from "@bufbuild/protobuf";
import { BundleDetailSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/bundle/v1/bundle_pb.js";
import { toDetail } from "./bundles";

const detail = () =>
  create(BundleDetailSchema, {
    days: [
      {
        dayNumber: 1,
        title: "Alfama",
        stops: [
          {
            id: "s1",
            name: "Sé de Lisboa",
            image: {
              url: "https://upload.wikimedia.org/se.jpg",
              source: "wikimedia",
              licence: "CC BY-SA 4.0",
              attribution: "Jane Doe",
              sourcePageUrl: "https://commons.wikimedia.org/wiki/File:Se.jpg",
            },
          },
          { id: "s2", name: "Miradouro de Santa Luzia" },
        ],
      },
    ],
  });

describe("toDetail stop images", () => {
  it("carries a pack stop's picture and its licence credit onto the card", () => {
    const [withImage] = toDetail(detail()).days[0].stops;
    expect(withImage.imageUrl).toBe("https://upload.wikimedia.org/se.jpg");
    expect(withImage.imageCredit).toEqual({
      url: "https://upload.wikimedia.org/se.jpg",
      source: "wikimedia",
      licence: "CC BY-SA 4.0",
      attribution: "Jane Doe",
      source_page_url: "https://commons.wikimedia.org/wiki/File:Se.jpg",
    });
  });

  it("leaves a stop without a picture to the gradient placeholder", () => {
    const [, without] = toDetail(detail()).days[0].stops;
    expect(without.imageUrl).toBeUndefined();
    expect(without.imageCredit).toBeUndefined();
  });
});
