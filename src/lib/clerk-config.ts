function hasPlaceholderFragment(value: string, fragments: readonly string[]) {
  return fragments.some((fragment) => value.includes(fragment));
}

export function hasValidClerkPublishableKey(
  key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
) {
  if (!key || key.trim().length === 0) {
    return false;
  }

  return (
    /^pk_(test|live)_/i.test(key) &&
    !hasPlaceholderFragment(key, ["your_clerk_publishable_key"])
  );
}

export function hasValidClerkSecretKey(key = process.env.CLERK_SECRET_KEY) {
  if (!key || key.trim().length === 0) {
    return false;
  }

  return (
    /^sk_(test|live)_/i.test(key) &&
    !hasPlaceholderFragment(key, ["your_clerk_secret_key"])
  );
}

export function isClerkFrontendConfigured() {
  return hasValidClerkPublishableKey();
}

export function isClerkServerConfigured() {
  return hasValidClerkSecretKey();
}

export function isClerkConfigured() {
  return isClerkFrontendConfigured() && isClerkServerConfigured();
}
