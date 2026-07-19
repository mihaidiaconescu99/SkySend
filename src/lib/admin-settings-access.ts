import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

const cookieName = "skysend_admin_settings_access";
const lifetimeSeconds = 180;

function configuredCode() {
  const code = process.env.ADMIN_SETTINGS_ACCESS_CODE?.trim();
  return code && /^\d{6}$/u.test(code) ? code : null;
}

function signature(userId: string, issuedAt: number) {
  const code = configuredCode();
  if (!code) return null;
  return createHmac("sha256", code).update(`${userId}:${issuedAt}`).digest("base64url");
}

function matches(left: string, right: string) {
  const leftBuffer = Buffer.from(left); const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function isAdminSettingsCodeConfigured() { return Boolean(configuredCode()); }

export async function grantAdminSettingsAccess(input: string) {
  const { userId } = await auth(); const expected = configuredCode();
  if (!userId || !expected || !/^\d{6}$/u.test(input) || !matches(input, expected)) return false;
  const issuedAt = Math.floor(Date.now() / 1000); const token = signature(userId, issuedAt);
  if (!token) return false;
  const store = await cookies();
  store.set(cookieName, `${issuedAt}.${token}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: lifetimeSeconds, path: "/admin/settings" });
  return true;
}

export async function hasAdminSettingsAccess() {
  const { userId } = await auth(); if (!userId) return false;
  const value = (await cookies()).get(cookieName)?.value; if (!value) return false;
  const [issuedAtValue, token] = value.split("."); const issuedAt = Number(issuedAtValue);
  if (!Number.isInteger(issuedAt) || !token || Date.now() / 1000 - issuedAt > lifetimeSeconds) return false;
  const expected = signature(userId, issuedAt);
  return Boolean(expected && matches(token, expected));
}
