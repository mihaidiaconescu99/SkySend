"use client";

import Link from "next/link";
import { Bell, CheckCheck, MailOpen, Trash2 } from "lucide-react";
import { AppButton } from "@/components/shared/app-button";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useNotificări } from "@/hooks/use-notifications";
import type { SkySendNotificationType } from "@/types/notifications";

const typeLabels: Record<SkySendNotificationType, string> = {
  order: "Comandă",
  mission: "Livrare",
  payment: "Plată",
  system: "Sistem",
};

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function NotificăriView() {
  const {
    notifications,
    unreadCount,
    markNotificationAsRead,
    markAllNotificăriAsRead,
    deleteAllNotificari,
  } = useNotificări();

  return (
    <SectionCard
      eyebrow="Inbox"
      title={notifications.length ? "Centru notificări" : "Nu ai notificări"}
      description={
        notifications.length
          ? `${unreadCount} actualizări necitite`
          : "Actualizările importante despre livrare vor apărea aici."
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge
          label={`${unreadCount} necitite`}
          tone={unreadCount > 0 ? "info" : "neutral"}
        />
        <div className="flex flex-wrap gap-2">
          <AppButton
            type="button"
            variant="outline"
            size="sm"
            disabled={unreadCount === 0}
            onClick={markAllNotificăriAsRead}
          >
            <CheckCheck className="size-4" />
            Marchează toate ca citite
          </AppButton>
          <AppButton
            type="button"
            variant="outline"
            size="sm"
            disabled={notifications.length === 0}
            onClick={deleteAllNotificari}
          >
            <Trash2 className="size-4" />
            Șterge toate notificările
          </AppButton>
        </div>
      </div>

      {notifications.length ? (
        <div className="grid gap-3">
          {notifications.map((notification) => (
            <article
              key={notification.id}
              className="grid gap-4 rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-secondary/35 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Bell className="size-4 text-primary" />
                  <p className="font-medium text-foreground">
                    {notification.title}
                  </p>
                  <StatusBadge
                    label={typeLabels[notification.type]}
                    tone={notification.read ? "neutral" : "info"}
                  />
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {notification.message}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {formatNotificationDate(notification.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {notification.actionUrl ? (
                  <AppButton asChild variant="outline" size="sm">
                    <Link
                      href={notification.actionUrl}
                      onClick={() => markNotificationAsRead(notification.id)}
                    >
                      Deschide
                    </Link>
                  </AppButton>
                ) : null}
                <AppButton
                  type="button"
                  variant={notification.read ? "ghost" : "outline"}
                  size="sm"
                  onClick={() => markNotificationAsRead(notification.id)}
                  disabled={notification.read}
                >
                  <MailOpen className="size-4" />
                  {notification.read ? "Citită" : "Marchează citită"}
                </AppButton>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[calc(var(--radius)+0.375rem)] border border-dashed border-border/80 bg-secondary/30 p-5">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 size-4 text-foreground" />
            <p className="text-sm leading-6 text-muted-foreground">
              Ești la zi. Alertele livrărilor active rămân vizibile în spațiul
              de tracking.
            </p>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
