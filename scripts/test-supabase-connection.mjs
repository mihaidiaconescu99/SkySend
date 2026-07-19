#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    "❌ Failed: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing from environment.",
  );
  process.exit(1);
}

const client = createClient(url, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

try {
  const { error } = await client
    .from("skysend_connection_probe_does_not_exist")
    .select("*")
    .limit(1);

  if (!error) {

    console.log("✅ Connected (probe table actually exists — harmless).");
    process.exit(0);
  }

  const reachableSignals = ["42P01", "PGRST205", "PGRST106"];
  const reached =
    reachableSignals.includes(error.code ?? "") ||
    /relation .* does not exist/i.test(error.message ?? "") ||
    /Could not find the table/i.test(error.message ?? "");

  if (reached) {
    console.log(
      `✅ Connected (server responded with expected schema error: ${error.code ?? "?"} ${error.message}).`,
    );
    process.exit(0);
  }

  console.error(
    `❌ Failed: server reachable but returned unexpected error (${error.code ?? "?"}): ${error.message}`,
  );
  process.exit(1);
} catch (caught) {
  const message =
    caught instanceof Error ? `${caught.name}: ${caught.message}` : String(caught);
  console.error(`❌ Failed: ${message}`);
  process.exit(1);
}
