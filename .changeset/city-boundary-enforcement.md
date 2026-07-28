---
'@crawl/api': patch
---

Fix the venue sync job silently assigning out-of-radius Google Places results to the city being synced (#167). `locationBias` on `searchText` was always a soft preference, not a hard filter, and nothing validated distance before stamping a place with `cityId`. The sync job now rejects any place farther than `radiusMeters` from the city's geocoded center before it is ever upserted, logging the venue name and distance and recording the rejection in `SyncCityResult.errors` so out-of-bounds counts are visible in a sync run.
