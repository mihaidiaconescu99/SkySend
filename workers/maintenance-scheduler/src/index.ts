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

const maintenancePath = "/api/cron/maintenance";

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
      invokeMaintenancePath(origin, secret, maintenancePath).catch((error) => {
        console.error(`Maintenance request failed for ${maintenancePath}`, error);
      }),
    );
  },
} satisfies SchedulerHandler;
