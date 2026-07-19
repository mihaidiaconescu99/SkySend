import type { SkySendToast, SkySendToastInput } from "@/types/notifications";
import { arePopupNotificăriEnabled } from "@/lib/notification-preferences";

type ToastListener = (toasts: SkySendToast[]) => void;

const maxVisibleToasts = 3;
const defaultToastDurationMs = 2000;
const listeners = new Set<ToastListener>();
let toasts: SkySendToast[] = [];
let dismissalTimer: number | null = null;

function createToastId() {
  const entropy =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

  return `toast_${Date.now().toString(36)}_${entropy}`;
}

function notifyListeners() {
  listeners.forEach((listener) => listener(toasts));
}

function scheduleNextDismissal() {
  if (dismissalTimer || toasts.length === 0 || typeof window === "undefined") {
    return;
  }

  const oldestToast = toasts.at(-1);
  if (!oldestToast) {
    return;
  }

  dismissalTimer = window.setTimeout(() => {
    dismissalTimer = null;
    dismissToast(oldestToast.id);
  }, oldestToast.durationMs);
}

export function subscribeToasts(listener: ToastListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getToastsSnapshot() {
  return toasts;
}

export function dismissToast(toastId: string) {
  toasts = toasts.filter((toast) => toast.id !== toastId);
  notifyListeners();
  scheduleNextDismissal();
}

export function showToast(input: SkySendToastInput) {
  const isCritical =
    input.importance === "critical" || input.tone === "destructive";

  if (!isCritical && !arePopupNotificăriEnabled()) {
    return null;
  }

  const toast: SkySendToast = {
    id: createToastId(),
    title: input.title,
    message: input.message,
    tone: input.tone ?? "info",
    durationMs: input.durationMs ?? defaultToastDurationMs,
    createdAt: Date.now(),
  };

  toasts = [toast, ...toasts].slice(0, maxVisibleToasts);
  notifyListeners();
  scheduleNextDismissal();

  return toast;
}
