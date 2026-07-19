import "server-only";

import { auth } from "@clerk/nextjs/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseClient } from "@/lib/supabase/shared";
import type { Database } from "@/types/database";

export async function getSupabaseServerContext() {
  const { userId, getToken } = await auth();
  const token = await getToken();

  return {
    clerkUserId: userId ?? null,
    accessToken: token ?? null,
  };
}

export async function createServerSupabaseClient(): Promise<
  SupabaseClient<Database>
> {
  const { getToken } = await auth();

  return createSupabaseClient({
    accessToken: async () => (await getToken()) ?? null,
  });
}
