import "server-only";

import { NextResponse } from "next/server";

function integratedCheckoutResponse() {
  return NextResponse.json({
    error: "integrated_checkout_required",
    redirectTo: "/client/create-delivery?checkout=moved",
  }, { status: 410 });
}

export async function POST() {
  return integratedCheckoutResponse();
}

export async function GET() {
  return integratedCheckoutResponse();
}
