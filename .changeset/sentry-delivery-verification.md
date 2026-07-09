---
'@crawl/mobile': patch
---

Make Sentry crash reporting verifiable end-to-end. Release builds now emit a
one-time-per-version verification event so a healthy staging build takes the
Sentry project out of its "waiting for first event" onboarding state, and a
staging build with a missing `EXPO_PUBLIC_SENTRY_DSN` now fails CI loudly
instead of shipping with reporting silently disabled.
