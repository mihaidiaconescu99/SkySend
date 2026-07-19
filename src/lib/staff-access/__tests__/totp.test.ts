import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  decryptTotpSecret,
  encryptTotpSecret,
  hashRecoveryCode,
  totpAtStep,
  verifyTotp,
} from "@/lib/staff-access/totp";

describe("staff access TOTP", () => {
  beforeEach(() => {
    process.env.ACCESS_TOTP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    process.env.ACCESS_RECOVERY_CODE_PEPPER = "test-recovery-pepper";
  });

  it("matches the RFC 6238 SHA-1 vector reduced to six digits", () => {
    expect(totpAtStep("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 1)).toBe("287082");
  });

  it("accepts the current TOTP step and rejects malformed codes", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(verifyTotp(secret, "287082", 59_000)).toBe(1);
    expect(verifyTotp(secret, "12345", 59_000)).toBeNull();
  });

  it("round-trips a TOTP secret with AES-256-GCM", () => {
    const encrypted = encryptTotpSecret("JBSWY3DPEHPK3PXP");
    expect(encrypted.encryptedSecret).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptTotpSecret(encrypted)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("hashes normalized recovery codes with the server pepper", () => {
    expect(hashRecoveryCode("sky-abcd-1234-efab-5678")).toBe(
      hashRecoveryCode(" SKY-ABCD-1234-EFAB-5678 "),
    );
  });
});
