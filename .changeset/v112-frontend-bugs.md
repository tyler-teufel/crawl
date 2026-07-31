---
'@crawl/mobile': patch
'@crawl/shared-types': patch
'@crawl/api': patch
---

Fix four v1.1.2 front-end reports.

**Sign-in re-prompted on every launch.** `/` is claimed by two index routes — `(onboarding)/index` and `(tabs)/index` — and expo-router resolves that ambiguity in `(onboarding)`'s favor, so every cold start rendered the welcome screen. `OnboardingGate` only ever redirected *into* onboarding, leaving an already-onboarded user with no way out. It now redirects in both directions (`resolveOnboardingRedirect`). Sign-out is handled as the inverse case: `AuthContext.signOut()` clears the first-launch flag (`clearOnboardingFlag()`) and the gate drops `hasReturningSession` on `SIGNED_OUT`, so a signed-out user isn't bounced back into the tabs.

**Anonymous votes survived signing in with Apple.** Signing in with a native id_token creates a new Supabase user rather than upgrading the anonymous one, but neither the React Query `votes` cache nor the device-scoped persisted mock state is keyed by user. `AuthContext` now watches the user id and resets both on an identity swap.

**Profile showed an Apple private-relay address as the user's name.** The display name fell back to `user.email`, which for a "Hide My Email" user is `<random>@privaterelay.appleid.com`. A name now only comes from `user_metadata` (`src/lib/displayName.ts`), a new onboarding step asks for one (`app/(onboarding)/name.tsx`), and `signInWithApple()` captures the `fullName` Apple returns on first authorization — the only time it is ever offered.

**Onboarding progress dots appeared on the first page only.** Extracted to `components/onboarding/StepDots.tsx` and rendered on all four steps.

**Venue detail page.** `venue.hours` holds Google's seven newline-joined `weekdayDescriptions`, which were being rendered raw into the status row. Today's hours now show inline (`src/lib/venueHours.ts`) with the full week behind a disclosure; the meta line joins type/price/distance without leaving a dangling separator when a field is empty; About and Highlights are hidden when the venue has neither; the hero renders `imageUrl` when present; and a Directions / Call / Website action row was added, backed by new optional `phone` and `website` fields on the shared `Venue` type, the Supabase read columns, and the API venue schema.
