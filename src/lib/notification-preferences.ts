export type NotificationPreferences = {
  popupNotificări: boolean;
  emailNotificări: boolean;
};

export const defaultNotificationPreferences: NotificationPreferences = {
  popupNotificări: true,
  emailNotificări: true,
};

export function readNotificationPreferences(): NotificationPreferences {
  return defaultNotificationPreferences;
}

export function writeNotificationPreferences(
  preferences: NotificationPreferences,
) {
  return preferences;
}

export function subscribeNotificationPreferences() {
  return () => {};
}

export function arePopupNotificăriEnabled() {
  return defaultNotificationPreferences.popupNotificări;
}

export function areEmailNotificăriEnabled() {
  return defaultNotificationPreferences.emailNotificări;
}
