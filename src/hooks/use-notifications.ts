"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";

import { NotificationsRepository } from "@/lib/repositories/notifications-repository";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useCurrentProfile } from "@/lib/profile-context/profile-context";
import type { Notification } from "@/types/notification";
import type {
  SkySendNotification,
  SkySendNotificationInput,
} from "@/types/notifications";

function notificationToSkySend(n: Notification): SkySendNotification {
  return {
    id: n.id,
    userId: n.profileId,
    title: n.title,
    message: n.message,
    type: n.type,
    read: n.read,
    actionUrl: n.actionUrl ?? null,
    createdAt: n.createdAt,
  };
}

export function useNotificări(): {
  notifications: SkySendNotification[];
  unreadCount: number;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificăriAsRead: () => Promise<void>;
  deleteAllNotificari: () => Promise<void>;
  createNotification: (
    input: SkySendNotificationInput,
  ) => Promise<SkySendNotification | null>;
} {
  const { getToken } = useAuth();
  const { state } = useCurrentProfile();
  const profileId = state.status === "authenticated" ? state.profile.id : null;
  const repo = useMemo<NotificationsRepository | null>(() => {
    if (!profileId) return null;
    const supabase = createBrowserSupabaseClient({
      getAccessToken: () => getToken(),
    });
    return new NotificationsRepository(supabase);
  }, [profileId, getToken]);
  const [notifications, setNotifications] = useState<SkySendNotification[]>([]);

  const refresh = useCallback(async () => {
    if (!repo || !profileId) {
      setNotifications([]);
      return;
    }

    const result = await repo.listByProfileId(profileId, { limit: 50 });

    if (!result.ok) {
      console.warn("[useNotifications] Supabase read failed:", result.error.message);
      setNotifications([]);
      return;
    }

    setNotifications(result.data.map(notificationToSkySend));
  }, [repo, profileId]);

  useEffect(() => {
    void Promise.resolve().then(() => refresh());
  }, [refresh]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const markNotificationAsRead = useCallback(
    async (id: string) => {
      if (!repo) return;
      const result = await repo.markAsRead(id);
      if (!result.ok) {
        console.warn("[useNotifications] markAsRead failed:", result.error.message);
      }
      await refresh();
    },
    [repo, refresh],
  );

  const markAllNotificăriAsRead = useCallback(async () => {
    if (!repo || !profileId) return;
    const result = await repo.markAllReadForProfile(profileId);
    if (!result.ok) {
      console.warn("[useNotifications] markAllRead failed:", result.error.message);
    }
    await refresh();
  }, [repo, profileId, refresh]);

  const deleteAllNotificari = useCallback(async () => {
    if (!repo) return;
    const results = await Promise.allSettled(
      notifications.map((n) => repo.deleteById(n.id)),
    );
    const anyFailed = results.some(
      (result) =>
        result.status === "rejected" ||
        (result.status === "fulfilled" && !result.value.ok),
    );
    if (anyFailed) {
      console.warn("[useNotifications] deleteAll failed for one or more rows.");
    }
    await refresh();
  }, [repo, notifications, refresh]);

  const createNotification = useCallback(
    async (
      input: SkySendNotificationInput,
    ): Promise<SkySendNotification | null> => {
      if (!repo || !profileId) return null;

      const result = await repo.create({
        profileId,
        type: input.type,
        title: input.title,
        message: input.message,
        actionUrl: input.actionUrl ?? undefined,
      });

      if (!result.ok) {
        console.warn("[useNotifications] create failed:", result.error.message);
        return null;
      }

      await refresh();
      return notificationToSkySend(result.data);
    },
    [repo, profileId, refresh],
  );

  return {
    notifications,
    unreadCount,
    markNotificationAsRead,
    markAllNotificăriAsRead,
    deleteAllNotificari,
    createNotification,
  };
}
