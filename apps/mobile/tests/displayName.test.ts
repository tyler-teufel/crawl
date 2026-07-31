import { describe, it, expect } from 'vitest';
import {
  initialsFrom,
  isPrivateRelayEmail,
  readProfileName,
  resolveDisplayName,
  resolveProfileEmail,
} from '@/lib/displayName';

// Regression coverage for the v1.1.2 report: the Profile header rendered
// `ndkkkycjtb5@privaterelay.appleid.com` as the user's name, because the
// display name fell back to `user.email` and Sign in with Apple with "Hide My
// Email" returns a relay address. A name now only ever comes from
// user_metadata (set by the onboarding name step / the Apple credential
// capture / Google's id_token).

describe('resolveDisplayName', () => {
  it('prefers user_metadata.full_name', () => {
    expect(
      resolveDisplayName({ user_metadata: { full_name: 'Tyler T' }, email: 'x@y.com' }, false)
    ).toBe('Tyler T');
  });

  it("falls back to Google's user_metadata.name", () => {
    expect(resolveDisplayName({ user_metadata: { name: 'Tyler' } }, false)).toBe('Tyler');
  });

  it('ignores a blank or non-string metadata name', () => {
    expect(resolveDisplayName({ user_metadata: { full_name: '   ' } }, false)).toBe('Crawler');
    expect(resolveDisplayName({ user_metadata: { full_name: 42 } }, false)).toBe('Crawler');
  });

  it('never uses the email as a name', () => {
    expect(resolveDisplayName({ user_metadata: {}, email: 'plain@example.com' }, false)).toBe(
      'Crawler'
    );
    expect(
      resolveDisplayName({ email: 'ndkkkycjtb5@privaterelay.appleid.com' }, false)
    ).not.toContain('privaterelay');
  });

  it('labels an anonymous user Guest when they have no name', () => {
    expect(resolveDisplayName(null, true)).toBe('Guest');
  });

  it('still uses a chosen name for an anonymous user', () => {
    expect(resolveDisplayName({ user_metadata: { full_name: 'Night Owl' } }, true)).toBe(
      'Night Owl'
    );
  });
});

describe('resolveProfileEmail', () => {
  it('returns a real address for the secondary line', () => {
    expect(resolveProfileEmail({ email: 'tyler@example.com' }, false)).toBe('tyler@example.com');
  });

  it('suppresses Apple relay addresses', () => {
    expect(resolveProfileEmail({ email: 'abc123@privaterelay.appleid.com' }, false)).toBeNull();
    expect(resolveProfileEmail({ email: 'ABC@PrivateRelay.AppleID.com' }, false)).toBeNull();
  });

  it('shows nothing for anonymous users', () => {
    expect(resolveProfileEmail({ email: 'leftover@example.com' }, true)).toBeNull();
    expect(resolveProfileEmail(null, true)).toBeNull();
  });
});

describe('helpers', () => {
  it('detects relay addresses', () => {
    expect(isPrivateRelayEmail('a@privaterelay.appleid.com')).toBe(true);
    expect(isPrivateRelayEmail('a@example.com')).toBe(false);
    expect(isPrivateRelayEmail(null)).toBe(false);
  });

  it('reads a trimmed profile name or null', () => {
    expect(readProfileName({ user_metadata: { full_name: '  Jane  ' } })).toBe('Jane');
    expect(readProfileName({ user_metadata: {} })).toBeNull();
    expect(readProfileName(null)).toBeNull();
  });

  it('derives initials from the first two words', () => {
    expect(initialsFrom('jane doe')).toBe('JD');
    expect(initialsFrom('Jane Quinn Doe')).toBe('JQ');
    expect(initialsFrom('Cher')).toBe('C');
  });
});
