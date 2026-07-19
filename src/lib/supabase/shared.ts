import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

type AccessTokenProvider = () => Promise<string | null>;

type SupabaseClientFactoryOptions = {
  accessToken?: AccessTokenProvider;
};

export function createSupabaseClient(
  options: SupabaseClientFactoryOptions = {},
): SupabaseClient<Database> {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      accessToken: options.accessToken,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
