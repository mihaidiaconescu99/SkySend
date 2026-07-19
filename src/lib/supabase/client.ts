import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseClient } from "@/lib/supabase/shared";
import type { Database } from "@/types/database";

type BrowserSupabaseClientOptions = {
  getAccessToken?: () => Promise<string | null>;
};

let browserSupabaseClient: SupabaseClient<Database> | null = null;

export function createBrowserSupabaseClient(
  options: BrowserSupabaseClientOptions = {},
): SupabaseClient<Database> {
  return createSupabaseClient({
    accessToken: options.getAccessToken,
  });
}

export function getBrowserSupabaseClient() {
  if (!browserSupabaseClient) {
    browserSupabaseClient = createBrowserSupabaseClient();
  }

  return browserSupabaseClient;
}
