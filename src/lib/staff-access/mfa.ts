import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  createTotpQr,
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  verifyTotp,
} from "@/lib/staff-access/totp";

const lockMinutes = 15;

export async function getAdminMfaStatus(profileId: string) {
  const { data, error } = await createAdminSupabaseClient()
    .from("admin_mfa_credentials")
    .select("confirmed_at, locked_until")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return {
    enrolled: Boolean(data?.confirmed_at),
    lockedUntil: data?.locked_until ?? null,
  };
}

export async function beginAdminMfaEnrollment(profileId: string, email: string) {
  const secret = generateTotpSecret();
  const encrypted = encryptTotpSecret(secret);
  const db = createAdminSupabaseClient();
  const { data, error } = await db
    .from("admin_mfa_credentials")
    .upsert({
      profile_id: profileId,
      encrypted_secret: encrypted.encryptedSecret,
      encryption_iv: encrypted.encryptionIv,
      encryption_tag: encrypted.encryptionTag,
      confirmed_at: null,
      failed_attempts: 0,
      locked_until: null,
      last_used_step: null,
    }, { onConflict: "profile_id" })
    .select("id")
    .single();
  if (error) throw error;
  await db.from("admin_mfa_recovery_codes").delete().eq("credential_id", data.id);
  const qr = await createTotpQr(email, secret);
  return { secret, ...qr };
}

export async function confirmAdminMfaEnrollment(profileId: string, code: string) {
  const db = createAdminSupabaseClient();
  const { data, error } = await db
    .from("admin_mfa_credentials")
    .select("id, encrypted_secret, encryption_iv, encryption_tag")
    .eq("profile_id", profileId)
    .single();
  if (error) throw error;
  const secret = decryptTotpSecret({
    encryptedSecret: data.encrypted_secret,
    encryptionIv: data.encryption_iv,
    encryptionTag: data.encryption_tag,
  });
  const step = verifyTotp(secret, code);
  if (step === null) return { ok: false as const, error: "Codul Authenticator nu este valid." };

  const recoveryCodes = generateRecoveryCodes();
  const { error: recoveryError } = await db.from("admin_mfa_recovery_codes").insert(
    recoveryCodes.map((recoveryCode) => ({
      credential_id: data.id,
      code_hash: hashRecoveryCode(recoveryCode),
    })),
  );
  if (recoveryError) throw recoveryError;
  const { error: updateError } = await db
    .from("admin_mfa_credentials")
    .update({ confirmed_at: new Date().toISOString(), failed_attempts: 0, locked_until: null, last_used_step: step })
    .eq("id", data.id);
  if (updateError) throw updateError;
  return { ok: true as const, recoveryCodes };
}

async function registerFailure(credentialId: string, previousAttempts: number) {
  const attempts = Math.min(previousAttempts + 1, 5);
  const lockedUntil = attempts >= 5
    ? new Date(Date.now() + lockMinutes * 60_000).toISOString()
    : null;
  await createAdminSupabaseClient()
    .from("admin_mfa_credentials")
    .update({ failed_attempts: attempts, locked_until: lockedUntil })
    .eq("id", credentialId);
  return lockedUntil;
}

export async function verifyAdminMfa(profileId: string, code: string) {
  const db = createAdminSupabaseClient();
  const { data, error } = await db
    .from("admin_mfa_credentials")
    .select("id, encrypted_secret, encryption_iv, encryption_tag, confirmed_at, failed_attempts, locked_until, last_used_step")
    .eq("profile_id", profileId)
    .single();
  if (error || !data.confirmed_at) return { ok: false as const, error: "MFA nu este configurat." };

  const lockExpired = data.locked_until && Date.parse(data.locked_until) <= Date.now();
  if (data.locked_until && !lockExpired) {
    return { ok: false as const, error: "MFA este blocat temporar.", lockedUntil: data.locked_until };
  }
  const attempts = lockExpired ? 0 : data.failed_attempts;

  if (code.trim().toUpperCase().startsWith("SKY-")) {
    const hash = hashRecoveryCode(code);
    const { data: recovery } = await db
      .from("admin_mfa_recovery_codes")
      .select("id")
      .eq("credential_id", data.id)
      .eq("code_hash", hash)
      .is("used_at", null)
      .maybeSingle();
    if (recovery) {
      await db.from("admin_mfa_recovery_codes").update({ used_at: new Date().toISOString() }).eq("id", recovery.id);
      await db.from("admin_mfa_credentials").update({ failed_attempts: 0, locked_until: null }).eq("id", data.id);
      return { ok: true as const, usedRecoveryCode: true };
    }
  } else {
    const secret = decryptTotpSecret({
      encryptedSecret: data.encrypted_secret,
      encryptionIv: data.encryption_iv,
      encryptionTag: data.encryption_tag,
    });
    const step = verifyTotp(secret, code);
    if (step !== null && (data.last_used_step === null || step > data.last_used_step)) {
      await db.from("admin_mfa_credentials")
        .update({ failed_attempts: 0, locked_until: null, last_used_step: step })
        .eq("id", data.id);
      return { ok: true as const, usedRecoveryCode: false };
    }
  }

  const lockedUntil = await registerFailure(data.id, attempts);
  return { ok: false as const, error: "Cod MFA invalid sau deja folosit.", lockedUntil };
}

export async function resetAdminMfa(profileId: string) {
  const { error } = await createAdminSupabaseClient()
    .from("admin_mfa_credentials")
    .delete()
    .eq("profile_id", profileId);
  if (error) throw error;
}
