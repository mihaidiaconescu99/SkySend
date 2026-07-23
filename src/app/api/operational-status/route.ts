import { NextResponse } from "next/server";
import { getOperationalStatusSnapshot } from "@/lib/operational-status-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getOperationalStatusSnapshot();
  return NextResponse.json({
    ...snapshot,
    weather: { ...snapshot.weather, lastError: snapshot.weather.checkStatus === "failed" ? "weather_check_failed" : null },
  }, { headers: { "Cache-Control": "no-store" } });
}

