"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useSignIn } from "@clerk/nextjs/legacy";
import {
  Bell,
  Camera,
  KeyRound,
  LogOut,
  Mail,
  Trash2,
  X,
  UserCog,
} from "lucide-react";
import { AppButton } from "@/components/shared/app-button";
import { PageHeader } from "@/components/shared/page-header";
import { PreferencesControls } from "@/components/shared/preferences/preferences-controls";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useCurrentProfile } from "@/lib/profile-context/profile-context";
import { useSettings } from "@/lib/settings/settings-context";
import { showToast } from "@/lib/toast-store";
import { cn } from "@/lib/utils";

type PreferenceKey = keyof NotificationPreferences;

type NotificationPreferences = {
  popupNotificări: boolean;
  emailNotificări: boolean;
};

const defaultNotificationPreferences: NotificationPreferences = {
  popupNotificări: true,
  emailNotificări: true,
};

const notificationOptions: {
  key: PreferenceKey;
  title: string;
  description: string;
  icon: typeof Bell;
}[] = [
  {
    key: "popupNotificări",
    title: "Notificări pop-up",
    description:
      "Afișează notificări rapide în aplicație pentru statusul comenzilor și al livrărilor.",
    icon: Bell,
  },
  {
    key: "emailNotificări",
    title: "Notificări prin email",
    description:
      "Primește emailuri importante despre comenzi, tracking și livrări finalizate.",
    icon: Mail,
  },
];

function getDisplayName({
  fullName,
  firstName,
  lastName,
}: {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  if (fullName) {
    return fullName;
  }

  return [firstName, lastName].filter(Boolean).join(" ") || "Client SkySend";
}

function PreferenceToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "inline-flex h-11 w-16 shrink-0 items-center rounded-full border p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring",
        checked
          ? "border-primary/45 bg-primary"
          : "border-border/80 bg-secondary",
      )}
    >
      <span
        className={cn(
          "size-8 rounded-full bg-background shadow-sm transition-transform",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

export function ClientSettingsView() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { isLoaded: isSignInLoaded, signIn } = useSignIn();
  const { state: profileState, refresh: refreshProfile } = useCurrentProfile();
  const { t } = useSettings();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    defaultNotificationPreferences,
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [accountPanelOpen, setAccountPanelOpen] = useState(false);
  const [firstNameDraft, setFirstNameDraft] = useState("");
  const [lastNameDraft, setLastNameDraft] = useState("");
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isSendingPasswordCode, setIsSendingPasswordCode] = useState(false);
  const displayName = useMemo(
    () =>
      getDisplayName({
        fullName: user?.fullName,
        firstName: user?.firstName,
        lastName: user?.lastName,
      }),
    [user?.firstName, user?.fullName, user?.lastName],
  );
  const primaryEmail =
    user?.primaryEmailAddress?.emailAddress ?? "Email indisponibil";

  useEffect(() => {
    if (!user) {
      return;
    }

    void Promise.resolve().then(() => {
      setFirstNameDraft(user.firstName ?? "");
      setLastNameDraft(user.lastName ?? "");
    });
  }, [user]);

  useEffect(() => {
    if (profileState.status !== "authenticated") {
      return;
    }

    void Promise.resolve().then(() => {
      setPreferences({
        popupNotificări: profileState.profile.notificationPreferences.popup,
        emailNotificări: profileState.profile.notificationPreferences.email,
      });
    });
  }, [profileState]);

  async function updatePreference(key: PreferenceKey) {
    const nextPreferences = {
      ...preferences,
      [key]: !preferences[key],
    };

    setPreferences(nextPreferences);

    const response = await fetch("/api/profile/notification-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        popup: nextPreferences.popupNotificări,
        email: nextPreferences.emailNotificări,
      }),
    });

    if (!response.ok) {
      setSaveMessage("Preferintele nu au putut fi salvate");
      return;
    }

    await refreshProfile();
    setSaveMessage("Preferințele au fost salvate");

    if (nextPreferences.popupNotificări) {
      showToast({
        title: "Preferințele au fost salvate",
        tone: "success",
      });
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !user) {
      return;
    }

    setAccountMessage("Se incarca poza de profil...");

    try {
      await user.setProfileImage({ file });
      await user.reload();
      setAccountMessage("Poza de profil a fost actualizata.");
    } catch {
      setAccountMessage("Poza de profil nu a putut fi actualizata.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleSaveAccountName() {
    if (!user || isSavingAccount) {
      return;
    }

    setIsSavingAccount(true);
    setAccountMessage(null);

    try {
      await user.update({
        firstName: firstNameDraft.trim() || null,
        lastName: lastNameDraft.trim() || null,
      });
      await user.reload();
      setAccountMessage("Numele contului a fost actualizat.");
    } catch {
      setAccountMessage("Numele contului nu a putut fi actualizat.");
    } finally {
      setIsSavingAccount(false);
    }
  }

  async function handleDeleteAccount() {
    if (!user) {
      return;
    }

    const confirmed = window.confirm(
      "Stergi definitiv contul SkySend? Aceasta actiune nu poate fi anulata.",
    );

    if (!confirmed) {
      return;
    }

    try {
      await user.delete();
      await signOut({ redirectUrl: "/" });
    } catch {
      setAccountMessage("Contul nu a putut fi sters.");
    }
  }

  async function handleSendPasswordResetCode() {
    if (!isSignInLoaded || !signIn || isSendingPasswordCode) {
      return;
    }

    const email = user?.primaryEmailAddress?.emailAddress;

    if (!email) {
      setAccountMessage("Nu exista un email principal pentru acest cont.");
      return;
    }

    const confirmed = window.confirm(
      `Trimitem un cod de resetare a parolei la ${email}?`,
    );

    if (!confirmed) {
      return;
    }

    setIsSendingPasswordCode(true);
    setAccountMessage(null);

    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });
      setAccountMessage(`Codul de resetare a fost trimis la ${email}.`);
    } catch {
      setAccountMessage("Codul de resetare nu a putut fi trimis.");
    } finally {
      setIsSendingPasswordCode(false);
    }
  }

  return (
    <section className="grid gap-6">
      <PageHeader
        eyebrow="Setări"
        title="Setări"
        description="Gestionează contul și preferințele aplicației."
      />

      <div className="grid gap-5">
        <SectionCard
          eyebrow="Cont"
          title="Cont"
          description="Datele sensibile ale contului sunt gestionate securizat prin Clerk."
        >
          <div className="grid gap-4">
            <div className="grid gap-5 rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-secondary/35 p-5 expanded-ui:grid-cols-[auto_minmax(0,1fr)_auto] expanded-ui:items-center">
              <div className="relative size-20">
                <div className="size-20 overflow-hidden rounded-3xl border border-primary/20 bg-primary/10">
                  {isLoaded && user?.imageUrl ? (

                    <img
                      src={user.imageUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center font-heading text-2xl text-primary">
                      {displayName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleAvatarChange}
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border border-border/80 bg-background text-primary shadow-[var(--elevation-card)] transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
                  aria-label="Schimba poza de profil"
                >
                  <Camera className="size-4" />
                </button>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-heading text-2xl tracking-tight text-foreground">
                    {displayName}
                  </h2>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[var(--radius)] border border-border/80 bg-background p-4">
                    <p className="text-sm text-muted-foreground">Email principal</p>
                    <p className="mt-1 truncate font-medium text-foreground">
                      {primaryEmail}
                    </p>
                  </div>
                  <div className="rounded-[var(--radius)] border border-border/80 bg-background p-4">
                    <p className="text-sm text-muted-foreground">Status cont</p>
                    <p className="mt-1 font-medium text-foreground">
                      {isLoaded ? "Activ" : "Se încarcă"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 expanded-ui:min-w-48 expanded-ui:grid-cols-1">
                <AppButton
                  type="button"
                  onClick={() => setAccountPanelOpen(true)}
                  className="w-full"
                >
                  <UserCog className="size-4" />
                  Gestionează contul
                </AppButton>
                <AppButton
                  type="button"
                  variant="outline"
                  onClick={() => void signOut({ redirectUrl: "/" })}
                  className="w-full"
                >
                  <LogOut className="size-4" />
                  Deconectare
                </AppButton>
              </div>
            </div>

            {accountMessage ? (
              <p className="text-sm font-medium text-primary">{accountMessage}</p>
            ) : null}

          </div>
        </SectionCard>

        <SectionCard
          eyebrow={t("settings.preferences.eyebrow")}
          title={t("settings.preferences.title")}
          description={t("settings.preferences.description")}
        >
          <div className="grid gap-3">
            <PreferencesControls />
            <p className="text-xs leading-5 text-muted-foreground">
              {t("settings.preferences.note")}
            </p>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Notificări"
          title="Notificări"
          description="Alege cum primești actualizări despre comenzi și livrări."
        >
          <div className="grid gap-3">
            {notificationOptions.map((option) => {
              const Icon = option.icon;
              const checked = preferences[option.key];

              return (
                <div
                  key={option.key}
                  className="grid gap-4 rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/35 p-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                >
                  <span className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading text-lg tracking-tight text-foreground">
                        {option.title}
                      </h3>
                      <StatusBadge
                        label={checked ? "Pornit" : "Oprit"}
                        tone={checked ? "success" : "neutral"}
                      />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                  <PreferenceToggle
                    checked={checked}
                    onChange={() => updatePreference(option.key)}
                    label={option.title}
                  />
                </div>
              );
            })}
          </div>

          {saveMessage ? (
            <p className="text-sm font-medium text-primary">{saveMessage}</p>
          ) : null}
        </SectionCard>
      </div>

      {accountPanelOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-background/70 p-3 backdrop-blur-sm sm:place-items-center">
          <div className="w-full max-w-xl rounded-[calc(var(--radius)+0.75rem)] border border-border/80 bg-background p-4 shadow-[var(--elevation-panel)] sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="type-caption">Cont</p>
                <h3 className="mt-1 font-heading text-2xl tracking-tight text-foreground">
                  Gestioneaza contul
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Modifica numele, securitatea sau sterge contul SkySend.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAccountPanelOpen(false)}
                className="flex size-10 items-center justify-center rounded-full border border-border/80 bg-secondary/45 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
                aria-label="Inchide panoul"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <div className="grid gap-3 rounded-[calc(var(--radius)+0.35rem)] border border-border/80 bg-secondary/35 p-4">
                <p className="font-medium text-foreground">Numele contului</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm">
                    <span className="text-muted-foreground">Prenume</span>
                    <input
                      value={firstNameDraft}
                      onChange={(event) => setFirstNameDraft(event.target.value)}
                      className="h-11 rounded-2xl border border-input bg-card px-4 outline-none transition focus-visible:ring-4 focus-visible:ring-ring"
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="text-muted-foreground">Nume</span>
                    <input
                      value={lastNameDraft}
                      onChange={(event) => setLastNameDraft(event.target.value)}
                      className="h-11 rounded-2xl border border-input bg-card px-4 outline-none transition focus-visible:ring-4 focus-visible:ring-ring"
                    />
                  </label>
                </div>
                <AppButton
                  type="button"
                  onClick={handleSaveAccountName}
                  disabled={isSavingAccount}
                  className="w-full sm:w-fit"
                >
                  {isSavingAccount ? "Se salveaza" : "Salveaza numele"}
                </AppButton>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <AppButton
                  type="button"
                  variant="outline"
                  onClick={() => void handleSendPasswordResetCode()}
                  disabled={isSendingPasswordCode}
                  className="w-full"
                >
                  <KeyRound className="size-4" />
                  {isSendingPasswordCode ? "Se trimite codul" : "Schimba parola"}
                </AppButton>
                <AppButton
                  type="button"
                  variant="outline"
                  onClick={handleDeleteAccount}
                  className="w-full border-destructive/45 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-4" />
                  Sterge contul
                </AppButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
