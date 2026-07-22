interface Env {
  CRON_SECRET: string;
  SKYSEND_ORIGIN: string;
}

type SchedulerContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type SchedulerHandler = {
  scheduled(
    controller: unknown,
    env: Env,
    ctx: SchedulerContext,
  ): Promise<void>;
};

const maintenancePaths = [
  "/api/cron/expire-mission-actions",
  "/api/cron/reconcile-refunds",
  "/api/cron/process-order-communications",
] as const;

async function invokeMaintenancePath(origin: string, secret: string, path: string) {
  const response = await fetch(new URL(path, origin), {
    headers: { Authorization: `Bearer ${secret}` },
  });

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
}

export default {
  async scheduled(_controller, env, ctx) {
    const origin = env.SKYSEND_ORIGIN?.replace(/\/+$/u, "");
    const secret = env.CRON_SECRET?.trim();

    if (!origin || !secret) {
      console.error("SKYSEND_ORIGIN and CRON_SECRET must be configured.");
      return;
    }

    ctx.waitUntil(
      Promise.allSettled(
        maintenancePaths.map((path) => invokeMaintenancePath(origin, secret, path)),
      ).then((results) => {
        results.forEach((result, index) => {
          if (result.status === "rejected") {
            console.error(`Maintenance request failed for ${maintenancePaths[index]}`, result.reason);
          }
        });
      }),
    );
  },
} satisfies SchedulerHandler;
