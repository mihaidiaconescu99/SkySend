import "server-only";

import { NextResponse } from "next/server";
import { processDueBillingDocuments } from "@/lib/billing/server";
import { reconcileOperationalMissionHolds } from "@/lib/operational-holds-server";
import { evaluateAndPersistWeather } from "@/lib/weather/server";
import { retryPaidCheckoutFinalizations } from "@/lib/stripe/webhook-server";

const legacyJobs = [
  "/api/cron/expire-mission-actions",
  "/api/cron/reconcile-refunds",
  "/api/cron/process-order-communications",
] as const;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const origin = new URL(request.url).origin;
  const settled = await Promise.allSettled([
    ...legacyJobs.map(async (path) => {
      const response = await fetch(new URL(path, origin), {
        headers: { Authorization: authorization },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`${path}:${response.status}`);
      return response.json();
    }),
    evaluateAndPersistWeather(),
    processDueBillingDocuments(),
    retryPaidCheckoutFinalizations(origin),
  ]);
  const holds = await reconcileOperationalMissionHolds();
  const jobName = (index: number) => index < legacyJobs.length
    ? legacyJobs[index]
    : index === legacyJobs.length
      ? "weather"
      : index === legacyJobs.length + 1
        ? "billing"
        : "checkout-finalization";
  const jobs = settled.map((result, index) => result.status === "fulfilled"
    ? { job: jobName(index), ok: true, result: result.value }
    : { job: jobName(index), ok: false, error: result.reason instanceof Error ? result.reason.message : "failed" });
  return NextResponse.json({ ok: jobs.every((job) => job.ok), jobs, holds });
}
