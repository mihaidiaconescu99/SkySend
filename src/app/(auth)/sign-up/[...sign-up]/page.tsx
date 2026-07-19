import { SkySendSignUpForm } from "@/components/auth/skysend-sign-up-form";
import { isClerkFrontendConfigured } from "@/lib/clerk-config";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Creează cont",
  "Creează un cont SkySend securizat prin Clerk.",
);

const clerkEnabled = isClerkFrontendConfigured();

export default function SignUpPage() {
  if (!clerkEnabled) {
    return (
      <p className="w-full text-center text-sm leading-7 text-muted-foreground">
        Crearea contului este indisponibilă momentan.
      </p>
    );
  }

  return (
    <div className="flex w-full justify-center">
      <SkySendSignUpForm />
    </div>
  );
}
