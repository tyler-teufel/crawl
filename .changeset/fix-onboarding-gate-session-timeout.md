---
'@crawl/mobile': patch
---

#191: bound `OnboardingGate`'s Supabase session read so a stalled `getSession()` can't strand the app on a blank screen.

`getSession()` can trigger a network token refresh and has no built-in timeout. Since #158 made the gate wait for both the `crawl.firstLaunchComplete.v1` flag and the session read before resolving, a request that never settles — poor connectivity, a Supabase incident, a captive-portal wifi that accepts the connection but never responds — held the gate in `'loading'` indefinitely with no path forward.

`readSessionWithTimeout()` now races the read against a 5s bound and treats expiry as "no returning session found", falling through to the flag's answer. That degrades to the pre-#158 behavior in the bad case (a returning user may see onboarding again — annoying but recoverable) rather than an unrecoverable hang.

Also replaces the gate's silent `.catch(() => {})` on the session read with `Sentry.captureException`, consistent with #158's own premise that these failures shouldn't be swallowed — it had instrumented the flag read for exactly that reason. Both the timeout and a thrown read now report.
