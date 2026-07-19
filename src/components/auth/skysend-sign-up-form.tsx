"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs/legacy";
import { Eye, EyeOff, Loader2, Mail, ShieldCheck } from "lucide-react";
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
    return "Nu am putut crea contul acum. Încearcă din nou.";
  }

  if (firstError.code?.includes("form_identifier_exists")) {
    return "Există deja un cont cu această adresă de email.";
  }

  if (firstError.code?.includes("form_password")) {
    return "Parola nu respectă cerințele de securitate.";
  }

  return (
    firstError.longMessage ??
    firstError.message ??
    "Nu am putut crea contul acum. Încearcă din nou."
  );
}

function PasswordField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="grid gap-2 text-left">
      <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required
          minLength={8}
          autoComplete="new-password"
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

export function SkySendSignUpForm() {
  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingSocialStrategy, setLoadingSocialStrategy] =
    useState<SkySendSocialAuthStrategy | null>(null);

  const canSubmit = useMemo(
    () =>
      isLoaded &&
      emailAddress.trim().length > 0 &&
      password.length >= 8 &&
      confirmPassword.length >= 8 &&
      !isSubmitting &&
      !loadingSocialStrategy,
    [
      confirmPassword.length,
      emailAddress,
      isLoaded,
      isSubmitting,
      loadingSocialStrategy,
      password.length,
    ],
  );

  async function activateCreatedSession(sessionId: string | null) {
    if (!sessionId || !setActive) {
      setErrorMessage("Contul a fost creat, dar sesiunea nu a putut fi pornită automat.");
      return;
    }

    await setActive({ session: sessionId });
    router.push(roleRoutingPaths.authContinue);
    router.refresh();
  }

  async function handleSocialAuth(strategy: SkySendSocialAuthStrategy) {
    if (!isLoaded || loadingSocialStrategy) {
      return;
    }

    setLoadingSocialStrategy(strategy);
    setErrorMessage(null);

    try {
      await signUp.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: roleRoutingPaths.authContinue,
        continueSignUp: true,
      });
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error));
      setLoadingSocialStrategy(null);
    }
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isLoaded) {
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Parolele nu coincid.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await signUp.create({
        emailAddress: emailAddress.trim(),
        password,
        locale: "ro-RO",
      });

      if (result.status === "complete") {
        await activateCreatedSession(result.createdSessionId);
        return;
      }

      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });
      setPendingVerification(true);
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isLoaded) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      });

      if (result.status === "complete") {
        await activateCreatedSession(result.createdSessionId);
        return;
      }

      setErrorMessage("Verificarea nu este completă încă. Verifică datele introduse.");
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
          <ShieldCheck className="size-5" />
        </div>
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">
          Creează cont
        </p>
        <h1 className="mt-2 font-heading text-2xl tracking-tight text-foreground sm:mt-3 sm:text-3xl">
          Creează contul
        </h1>
        <p className="mt-2 text-sm leading-5 text-muted-foreground sm:mt-3 sm:leading-6">
          Completează datele pentru a începe livrările cu SkySend.
        </p>
      </div>

      {pendingVerification ? (
        <form onSubmit={handleVerifyEmail} className="grid gap-3 sm:gap-4">
          <label className="grid gap-2 text-left">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Cod de verificare
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value)}
              placeholder="Introdu codul primit pe email"
              required
              className="h-12 w-full rounded-2xl border border-input bg-muted px-4 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-primary/55 focus:ring-4 focus:ring-ring"
            />
          </label>

          <p className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-sm leading-5 text-muted-foreground sm:p-4 sm:leading-6">
            Am trimis un cod la <span className="text-foreground">{emailAddress}</span>.
            Introdu codul pentru a finaliza contul.
          </p>

          {errorMessage ? (
            <p className="rounded-2xl border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}

          <Button type="submit" disabled={isSubmitting} className="mt-2 w-full rounded-full">
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Verifică emailul
          </Button>
        </form>
      ) : (
        <>
          <SkySendSocialAuthButtons
            disabled={!isLoaded || isSubmitting || Boolean(loadingSocialStrategy)}
            loadingStrategy={loadingSocialStrategy}
            onProviderSelect={handleSocialAuth}
          />

          <form onSubmit={handleCreateAccount} className="grid gap-3 sm:gap-4">
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

          <PasswordField
            id="password"
            label="Parolă"
            value={password}
            onChange={setPassword}
            placeholder="Creează o parolă"
          />
          <PasswordField
            id="confirm-password"
            label="Confirmă parola"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Reintrodu parola"
          />

          {errorMessage ? (
            <p className="rounded-2xl border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
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
        </>
      )}

      <div className="mt-4 border-t border-border/80 pt-4 text-center text-sm text-muted-foreground sm:mt-6 sm:pt-5">
        Ai deja cont?{" "}
        <Link href="/sign-in" className="font-semibold text-primary hover:text-primary/85">
          Autentifică-te
        </Link>
      </div>

    </div>
  );
}
