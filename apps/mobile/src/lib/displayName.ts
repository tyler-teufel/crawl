// How a signed-in user is named in the UI.
//
// Supabase never guarantees a human name: anonymous users have neither name
// nor email, and Sign in with Apple with "Hide My Email" yields an opaque
// `<random>@privaterelay.appleid.com` address. Falling back to `user.email`
// meant the Profile header rendered that relay address as the user's name —
// the bug this module exists to prevent. A name the user typed during
// onboarding (stored in `user_metadata.full_name`) is the only value we
// treat as a name; everything else falls back to a generic label.

const APPLE_PRIVATE_RELAY_DOMAIN = '@privaterelay.appleid.com';

/** Minimal structural shape of a Supabase `User` this module reads. */
export interface DisplayNameUser {
  email?: string | null;
  user_metadata?: {
    full_name?: unknown;
    name?: unknown;
  } | null;
}

export function isPrivateRelayEmail(email?: string | null): boolean {
  return !!email && email.toLowerCase().endsWith(APPLE_PRIVATE_RELAY_DOMAIN);
}

/**
 * The name the user (or their identity provider) gave us, if any.
 * `full_name` is what the onboarding name step and the Apple credential
 * writer set; `name` is what Google's id_token populates.
 */
export function readProfileName(user: DisplayNameUser | null): string | null {
  const meta = user?.user_metadata;
  for (const candidate of [meta?.full_name, meta?.name]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
}

export function resolveDisplayName(user: DisplayNameUser | null, isAnonymous: boolean): string {
  return readProfileName(user) ?? (isAnonymous ? 'Guest' : 'Crawler');
}

/**
 * Email to show as the secondary line under the name, or null when there is
 * nothing worth showing. Apple relay addresses are suppressed: they are
 * machine-generated noise the user cannot act on.
 */
export function resolveProfileEmail(
  user: DisplayNameUser | null,
  isAnonymous: boolean
): string | null {
  if (isAnonymous) return null;
  const email = user?.email;
  if (!email || isPrivateRelayEmail(email)) return null;
  return email;
}

export function initialsFrom(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
