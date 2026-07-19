"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs/legacy";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import { roleRoutingPaths } from "@/constants/roles";
import { Button } from "@/components/ui/button";
import {
  SkySendSocialAuthButtons,
  type SkySendSocialAuthStrategy,
} from "@/components/auth/skysend-social-auth-buttons";
import { cn } from "@/lib/utils";

type ClerkErrorLike = {
  errors?: {
    code?: string;
    message?: string;
    longMessage?: string;
  }[];
};

function getClerkErrorMessage(error: unknown) {
  const firstError = (error as ClerkErrorLike).errors?.[0];

  if (!firstError) {
    return "Nu am putut autentifica acest cont acum. Încearcă din nou.";
  }

  if (firstError.code?.includes("form_password_incorrect")) {
    return "Parola introdusă nu este corectă.";
  }

  if (firstError.code?.includes("form_identifier_not_found")) {
    return "Nu există un cont pentru această adresă de email.";
  }

  return (
    firstError.longMessage ??
    firstError.message ??
    "Nu am putut autentifica acest cont acum. Încearcă din nou."
  );
}

function getVisibleAuthMessage(message: string) {
  if (message.includes("Clerk") && message.includes("verificare")) {
    return "Autentificarea nu a fost finalizată. Verifică în Clerk dacă emailul este verificat și contul are parola activă, apoi încearcă din nou.";
  }

  return message;
}

function PasswordField({
  value,
  onChange,
  label = "Parola",
  placeholder = "Introdu parola",
  autoComplete = "current-password",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="grid gap-2 text-left">
      <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Parolă
      </span>
      <span className="relative">
        <input
          type={visible ? "text" : "password"}
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required
          autoComplete={autoComplete}
          className="h-12 w-full rounded-2xl border border-input bg-muted px-4 pr-12 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-primary/55 focus:ring-4 focus:ring-ring"
        />
        <button
          type="button"
          aria-label={visible ? "Ascunde parola" : "Arată parola"}
          onClick={() => setVisible((current) => !current)}
          className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </span>
    </label>
  );
}

export function SkySendSignInForm() {
  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();
  const [authMode, setAuthMode] = useState<"sign-in" | "forgot-password" | "reset-password">("sign-in");
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingSocialStrategy, setLoadingSocialStrategy] =
    useState<SkySendSocialAuthStrategy | null>(null);

  const canSubmit = useMemo(
    () =>
      isLoaded &&
      emailAddress.trim().length > 0 &&
      password.length > 0 &&
      !isSubmitting &&
      !loadingSocialStrategy,
    [emailAddress, isLoaded, isSubmitting, loadingSocialStrategy, password],
  );
  const canStartPasswordReset = useMemo(
    () =>
      isLoaded &&
      emailAddress.trim().length > 0 &&
      !isSubmitting &&
      !loadingSocialStrategy,
    [emailAddress, isLoaded, isSubmitting, loadingSocialStrategy],
  );
  const canConfirmPasswordReset = useMemo(
    () =>
      isLoaded &&
      resetCode.trim().length > 0 &&
      newPassword.length >= 8 &&
      !isSubmitting &&
      !loadingSocialStrategy,
    [isLoaded, isSubmitting, loadingSocialStrategy, newPassword, resetCode],
  );

  function switchAuthMode(nextMode: typeof authMode) {
    setAuthMode(nextMode);
    setErrorMessage(null);
    setStatusMessage(null);
    setResetCode("");
    setNewPassword("");
  }

  async function handleSocialAuth(strategy: SkySendSocialAuthStrategy) {
    if (!isLoaded || loadingSocialStrategy) {
      return;
    }

    setLoadingSocialStrategy(strategy);
    setErrorMessage(null);

    try {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: roleRoutingPaths.authContinue,
      });
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error));
      setLoadingSocialStrategy(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isLoaded) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await signIn.create({
        strategy: "password",
        identifier: emailAddress.trim(),
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push(roleRoutingPaths.authContinue);
        router.refresh();
        return;
      }

      setErrorMessage(
        "Contul necesită o verificare suplimentară în Clerk înainte de autentificare.",
      );
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordResetStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isLoaded) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: emailAddress.trim(),
      });
      setAuthMode("reset-password");
      setStatusMessage("Am trimis un cod de resetare pe email.");
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordResetConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isLoaded) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: resetCode.trim(),
        password: newPassword,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push(roleRoutingPaths.authContinue);
        router.refresh();
        return;
      }

      setStatusMessage(
        "Parola a fost actualizata. Te poti autentifica folosind noua parola.",
      );
      setAuthMode("sign-in");
      setPassword("");
      setResetCode("");
      setNewPassword("");
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full rounded-[var(--ui-radius-panel)] border border-border/80 bg-card p-4 shadow-2xl shadow-black/30 sm:p-6">
      <div className="mb-4 text-center sm:mb-6">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary sm:mb-4 sm:size-12">
          <LockKeyhole className="size-5" />
        </div>
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">
          Autentificare
        </p>
        <h1 className="mt-2 font-heading text-2xl tracking-tight text-foreground sm:mt-3 sm:text-3xl">
          Bine ai revenit
        </h1>
        <p className="mt-2 text-sm leading-5 text-muted-foreground sm:mt-3 sm:leading-6">
          Intră în cont pentru a gestiona livrările SkySend.
        </p>
      </div>

      {authMode === "sign-in" ? (
        <SkySendSocialAuthButtons
          disabled={!isLoaded || isSubmitting || Boolean(loadingSocialStrategy)}
          loadingStrategy={loadingSocialStrategy}
          onProviderSelect={handleSocialAuth}
        />
      ) : null}

      <form
        onSubmit={handleSubmit}
        className={cn("grid gap-3 sm:gap-4", authMode !== "sign-in" && "hidden")}
      >
        <label className="grid gap-2 text-left">
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Adresă de email
          </span>
          <span className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              value={emailAddress}
              onChange={(event) => setEmailAddress(event.target.value)}
              placeholder="Introdu adresa de email"
              required
              autoComplete="email"
              className="h-12 w-full rounded-2xl border border-input bg-muted px-4 pl-11 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-primary/55 focus:ring-4 focus:ring-ring"
            />
          </span>
        </label>

        <PasswordField value={password} onChange={setPassword} />

        <div className="-mt-1 flex justify-end">
          <button
            type="button"
            onClick={() => switchAuthMode("forgot-password")}
            className="text-sm font-semibold text-primary transition-colors hover:text-primary/85"
          >
            Ai uitat parola?
          </button>
        </div>

        {statusMessage ? (
          <p className="rounded-2xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
            {statusMessage}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="rounded-2xl border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
            {getVisibleAuthMessage(errorMessage)}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={!canSubmit}
          className={cn("mt-2 w-full rounded-full", isSubmitting && "cursor-wait")}
        >
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          Continuă
        </Button>
      </form>

      {authMode === "forgot-password" ? (
        <form onSubmit={handlePasswordResetStart} className="grid gap-3 sm:gap-4">
          <label className="grid gap-2 text-left">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Adresa de email
            </span>
            <span className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={emailAddress}
                onChange={(event) => setEmailAddress(event.target.value)}
                placeholder="Emailul contului SkySend"
                required
                autoComplete="email"
                className="h-12 w-full rounded-2xl border border-input bg-muted px-4 pl-11 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-primary/55 focus:ring-4 focus:ring-ring"
              />
            </span>
          </label>

          {errorMessage ? (
            <p className="rounded-2xl border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
              {getVisibleAuthMessage(errorMessage)}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={!canStartPasswordReset}
            className={cn("mt-2 w-full rounded-full", isSubmitting && "cursor-wait")}
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Trimite codul
          </Button>

          <button
            type="button"
            onClick={() => switchAuthMode("sign-in")}
            className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Inapoi la autentificare
          </button>
        </form>
      ) : null}

      {authMode === "reset-password" ? (
        <form onSubmit={handlePasswordResetConfirm} className="grid gap-3 sm:gap-4">
          {statusMessage ? (
            <p className="rounded-2xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
              {statusMessage}
            </p>
          ) : null}

          <label className="grid gap-2 text-left">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Cod primit pe email
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={resetCode}
              onChange={(event) => setResetCode(event.target.value)}
              placeholder="Introdu codul"
              required
              autoComplete="one-time-code"
              className="h-12 w-full rounded-2xl border border-input bg-muted px-4 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-primary/55 focus:ring-4 focus:ring-ring"
            />
          </label>

          <PasswordField
            value={newPassword}
            onChange={setNewPassword}
            label="Parola noua"
            placeholder="Minimum 8 caractere"
            autoComplete="new-password"
          />

          {errorMessage ? (
            <p className="rounded-2xl border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
              {getVisibleAuthMessage(errorMessage)}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={!canConfirmPasswordReset}
            className={cn("mt-2 w-full rounded-full", isSubmitting && "cursor-wait")}
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Reseteaza parola
          </Button>

          <button
            type="button"
            onClick={() => switchAuthMode("forgot-password")}
            className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Retrimite codul
          </button>
        </form>
      ) : null}

      <div className="mt-4 border-t border-border/80 pt-4 text-center text-sm text-muted-foreground sm:mt-6 sm:pt-5">
        Nu ai cont?{" "}
        <Link href="/sign-up" className="font-semibold text-primary hover:text-primary/85">
          Creează cont
        </Link>
      </div>
    </div>
  );
}
