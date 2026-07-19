"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SkySendSocialAuthStrategy =
  | "oauth_google"
  | "oauth_facebook"
  | "oauth_apple";

const socialProviders: readonly {
  strategy: SkySendSocialAuthStrategy;
  label: string;
}[] = [
  {
    strategy: "oauth_google",
    label: "Continuă cu Google",
  },
  {
    strategy: "oauth_facebook",
    label: "Continuă cu Facebook",
  },
  {
    strategy: "oauth_apple",
    label: "Continuă cu Apple",
  },
];

function SocialProviderIcon({
  strategy,
}: {
  strategy: SkySendSocialAuthStrategy;
}) {
  if (strategy === "oauth_google") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-4 shrink-0"
      >
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.24 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"
        />
      </svg>
    );
  }

  if (strategy === "oauth_facebook") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-4 shrink-0"
      >
        <path
          fill="#1877F2"
          d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.09 4.39 23.08 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.08 24 18.09 24 12.07z"
        />
        <path
          fill="#FFFFFF"
          d="m16.67 15.56.53-3.49h-3.33V9.81c0-.96.47-1.89 1.96-1.89h1.51V4.96s-1.37-.24-2.68-.24c-2.74 0-4.53 1.67-4.53 4.69v2.66H7.08v3.49h3.05V24a12.3 12.3 0 0 0 3.74 0v-8.44h2.8z"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0">
      <path
        fill="currentColor"
        d="M16.37 1.43c0 1.14-.42 2.14-1.26 3-.86.86-1.86 1.36-3 1.27-.14-1.1.43-2.28 1.2-3.05.85-.86 2.16-1.48 3.06-1.22zM20.47 17.37c-.55 1.26-.82 1.82-1.53 2.93-.99 1.53-2.38 3.44-4.1 3.46-1.53.02-1.93-1-4.02-.99-2.08.01-2.52 1.02-4.05 1-1.72-.02-3.03-1.74-4.02-3.27-2.76-4.27-3.05-9.28-1.35-11.95 1.21-1.89 3.12-3 4.92-3.03 1.84-.04 3.57 1.02 4.02 1.02.44 0 2.54-1.26 4.29-1.07.73.03 2.79.29 4.11 2.23-.11.07-2.45 1.44-2.42 4.27.03 3.38 2.96 4.5 4.15 5.4z"
      />
    </svg>
  );
}

export function SkySendSocialAuthButtons({
  disabled,
  loadingStrategy,
  onProviderSelect,
}: {
  disabled: boolean;
  loadingStrategy: SkySendSocialAuthStrategy | null;
  onProviderSelect: (strategy: SkySendSocialAuthStrategy) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        {socialProviders.map((provider) => {
          const isLoading = loadingStrategy === provider.strategy;

          return (
            <Button
              key={provider.strategy}
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => onProviderSelect(provider.strategy)}
              className={cn(
                "h-12 w-full justify-center rounded-2xl border-border/80 bg-secondary/35 text-sm font-semibold text-foreground shadow-none transition-[border-color,background-color,box-shadow] hover:border-primary/35 hover:bg-secondary/60 focus-visible:ring-4 focus-visible:ring-ring",
                isLoading && "cursor-wait",
              )}
            >
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
              {!isLoading ? (
                <SocialProviderIcon strategy={provider.strategy} />
              ) : null}
              {provider.label}
            </Button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-border/80" />
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          sau
        </span>
        <span className="h-px flex-1 bg-border/80" />
      </div>
    </div>
  );
}
