---
'@crawl/api': patch
---

Sprint 4 users/venues migration wave (#77, #129, #131, #167 remediation, #156):

- Removed the dead custom bcrypt `/auth/register`, `/auth/login`, and `/auth/refresh` routes, `AuthService`, and the `UserRepository`/`DrizzleUserRepository` pair. These only ever ran in local in-memory dev mode and were unreachable in production, where Supabase JWT verification via JWKS (`plugins/jwt.ts`) is the only auth path. Dropped `users.password_hash` and the `bcryptjs` dependency accordingly.
- Added `public.users.device_id` (abuse/dedup signal only, no auth-flow use) and `public.users.role` (`'user' | 'developer'`, `text` with a `CHECK` constraint). Replaced the per-request Supabase-user upsert in `jwt.ts` (which only fired for users hitting an authenticated endpoint) with a `SECURITY DEFINER` trigger on `auth.users` that provisions a `public.users` row for every identity, anonymous or linked, at creation time — plus a backfill for the 14 identities that predated it. Tightened the `users: update own` RLS policy's practical effect by revoking table-wide `UPDATE` from `authenticated` and re-granting it only on non-`role` columns, since a column-level `REVOKE (role)` alone does not narrow a table-wide grant.
- Reassigned the 27 `South End, Charlotte` venues to `Charlotte` and removed the `South End, Charlotte` `cities` row (Charlotte's existing 8000m radius already covers them). Corrected Sayville's `radius_meters` from 250 (a dropped zero) to 2500, matching Patchogue's radius for a same-scale town. Reassigned or deactivated the remaining out-of-radius venues from #167 based on an actual distance-to-city-center recomputation, rather than the ingest-time snapshot.
