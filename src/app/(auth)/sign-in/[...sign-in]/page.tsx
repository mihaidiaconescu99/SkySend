import { SkySendSignInForm } from "@/components/auth/skysend-sign-in-form";
import { isClerkFrontendConfigured } from "@/lib/clerk-config";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Autentificare",
  "Acces securizat la contul SkySend pentru livrări și urmărire.",
);

const clerkEnabled = isClerkFrontendConfigured();

export default function SignInPage() {
  if (!clerkEnabled) {
    return (
      <p className="w-full text-center text-sm leading-7 text-muted-foreground">
        Autentificarea este indisponibilă momentan.
      </p>
    );
  }

  return (
    <div className="flex w-full justify-center">
      <SkySendSignInForm />
    </div>
  );
}
