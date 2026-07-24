import "server-only";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/api/request-security";

export async function POST(request: Request) {
  const originFailure = requireSameOrigin(request);
  if (originFailure) return originFailure;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  return NextResponse.json(
    { error: "server_managed_order_status" },
    { status: 410 },
  );
}
