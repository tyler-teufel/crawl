---
'@crawl/mobile': patch
---

Flatten the mock vote budget from per-city to a single global 3-votes/day pool, matching the server contract, and have the mock throw a `NO_VOTES_REMAINING`/`ALREADY_VOTED` error on exhaustion/duplicate casts instead of silently no-op'ing.
