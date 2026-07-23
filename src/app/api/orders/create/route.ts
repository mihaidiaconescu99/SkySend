import "server-only";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Legacy endpoint kept as an explicit tombstone so an older client cannot
 * create an unpaid order. Paid orders are created only by the idempotent
 * checkout finalizer invoked from the verified Stripe webhook.
 */
export async function POST(_request?: Request) {
  void _request;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  return NextResponse.json(
    {
      error: "integrated_checkout_required",
      redirectTo: "/client/create-delivery?checkout=moved",
    },
    { status: 410 },
  );
}
