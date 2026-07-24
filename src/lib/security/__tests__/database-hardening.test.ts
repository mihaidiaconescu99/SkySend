import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260724230000_stage_five_database_hardening.sql",
  ),
  "utf8",
);

describe("stage five database hardening migration", () => {
  it("enables RLS for every public table and removes implicit client grants", () => {
    expect(migration).toContain("SET LOCAL lock_timeout = '5s'");
    expect(migration).toContain("stage_five_schema_mismatch");
    expect(migration).toContain(
      "ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY",
    );
    expect(migration).toContain(
      "REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public",
    );
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("CREATE POLICY direct_access_denied");
    expect(migration).toContain("stage_five_rls_verification_failed");
  });

  it("binds direct ownership to the Clerk JWT subject", () => {
    expect(migration).toContain("auth.jwt() ->> 'sub'");
    expect(migration).toContain("CREATE POLICY addresses_update_own");
    expect(migration).toContain(
      "WITH CHECK (profile_id = (SELECT public.current_user_profile_id()))",
    );
    expect(migration).toContain("CREATE POLICY billing_documents_select_own");
  });

  it("neutralizes legacy staff grants and restricts function execution", () => {
    expect(migration).toContain(
      "REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public",
    );
    expect(migration).toContain(
      "Clerk organization membership remains authoritative",
    );
    const executeGrants = migration
      .split(";")
      .filter((statement) => /\bGRANT\s+EXECUTE\b/iu.test(statement));
    expect(executeGrants).not.toContainEqual(
      expect.stringMatching(/\bTO\s+(?:PUBLIC|anon)\b/iu),
    );
  });

  it("reconciles the production communication table without destructive data changes", () => {
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS public.order_communication_events",
    );
    expect(migration).toContain(
      "CREATE INDEX IF NOT EXISTS idx_order_communication_events_pending",
    );
    expect(migration).not.toMatch(/\bTRUNCATE\b|\bDROP\s+TABLE\b/iu);
  });
});
