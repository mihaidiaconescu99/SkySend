import { describe, expect, it } from "vitest";

import {
  detectImageContentType,
  imageSignatureMatches,
} from "@/lib/uploads/image-signature";

describe("image magic-byte validation", () => {
  it("recognizes supported signatures", () => {
    expect(
      detectImageContentType(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe("image/png");
    expect(
      detectImageContentType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])),
    ).toBe("image/jpeg");
  });

  it("rejects a declared image whose bytes have another type", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    expect(imageSignatureMatches(jpeg, "image/png")).toBe(false);
    expect(imageSignatureMatches(new TextEncoder().encode("not-an-image"), "image/jpeg")).toBe(false);
  });
});
