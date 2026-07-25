interface Env {
  CRON_SECRET: string;
  SKYSEND_ORIGIN: string;
}

type SchedulerContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type SchedulerController = {
  cron: string;
};

type SchedulerHandler = {
  scheduled(
    controller: SchedulerController,
    env: Env,
    ctx: SchedulerContext,
  ): Promise<void>;
};

const maintenancePath = "/api/cron/maintenance";
const purgeExpiredAttachmentsPath = "/api/cron/purge-expired-attachments";
const purgeExpiredAttachmentsSchedule = "0 3 * * *";

async function invokeMaintenancePath(origin: string, secret: string, path: string) {
  const response = await fetch(new URL(path, origin), {
    headers: { Authorization: `Bearer ${secret}` },
  });

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
}

export default {
  async scheduled(controller, env, ctx) {
    const origin = env.SKYSEND_ORIGIN?.replace(/\/+$/u, "");
    const secret = env.CRON_SECRET?.trim();

    if (!origin || !secret) {
      console.error("SKYSEND_ORIGIN and CRON_SECRET must be configured.");
      return;
    }

    const path =
      controller.cron === purgeExpiredAttachmentsSchedule
        ? purgeExpiredAttachmentsPath
        : maintenancePath;

    ctx.waitUntil(
      invokeMaintenancePath(origin, secret, path).catch((error) => {
        console.error(`Scheduled request failed for ${path}`, error);
      }),
    );
  },
} satisfies SchedulerHandler;
