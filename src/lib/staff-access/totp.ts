import "server-only";

import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import { getStaffAccessConfig } from "@/lib/staff-access/config";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encodeBase32(input: Uint8Array) {
  let bits = "";
  for (const byte of input) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let index = 0; index < bits.length; index += 5) {
    output += alphabet[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  }
  return output;
}

function decodeBase32(value: string) {
  const clean = value.toUpperCase().replace(/[^A-Z2-7]/gu, "");
  let bits = "";
  for (const character of clean) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("Invalid base32 secret.");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function encryptionKey() {
  const raw = getStaffAccessConfig().totpEncryptionKey;
  if (!raw) throw new Error("ACCESS_TOTP_ENCRYPTION_KEY is not configured.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("ACCESS_TOTP_ENCRYPTION_KEY must be 32 bytes encoded as base64.");
  return key;
}

export function generateTotpSecret() {
  return encodeBase32(randomBytes(20));
}

export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return {
    encryptedSecret: encrypted.toString("base64"),
    encryptionIv: iv.toString("base64"),
    encryptionTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptTotpSecret(input: {
  encryptedSecret: string;
  encryptionIv: string;
  encryptionTag: string;
}) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(input.encryptionIv, "base64"));
  decipher.setAuthTag(Buffer.from(input.encryptionTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(input.encryptedSecret, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function totpAtStep(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return value.toString().padStart(6, "0");
}

export function verifyTotp(secret: string, code: string, now = Date.now()) {
  const normalized = code.replace(/\s/gu, "");
  if (!/^\d{6}$/u.test(normalized)) return null;
  const currentStep = Math.floor(now / 30_000);
  for (const delta of [-1, 0, 1]) {
    const step = currentStep + delta;
    const expected = Buffer.from(totpAtStep(secret, step));
    const received = Buffer.from(normalized);
    if (expected.length === received.length && timingSafeEqual(expected, received)) return step;
  }
  return null;
}

export function generateRecoveryCodes() {
  return Array.from({ length: 10 }, () => {
    const value = randomBytes(8).toString("hex").toUpperCase();
    return `SKY-${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}`;
  });
}

export function hashRecoveryCode(code: string) {
  const pepper = getStaffAccessConfig().recoveryCodePepper;
  if (!pepper) throw new Error("ACCESS_RECOVERY_CODE_PEPPER is not configured.");
  return createHmac("sha256", pepper).update(code.trim().toUpperCase()).digest("hex");
}

export async function createTotpQr(email: string, secret: string) {
  const label = encodeURIComponent(`SkySend:${email}`);
  const issuer = encodeURIComponent("SkySend");
  const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  return { uri, qrDataUrl: await QRCode.toDataURL(uri, { width: 260, margin: 1 }) };
}
