---
'@crawl/mobile': patch
---

Fix live venue data never loading on Supabase-direct builds. Venue queries now filter on `venues.city_id` (resolved from the selected city via `resolveCityId`) instead of the denormalized `venues.city` text column, which the ingest job writes as `"Charlotte"` while the client holds `"Charlotte, NC"` — matching zero rows for every city. `useTrending` gains the Supabase tier it was missing, so Global Rankings shows real venues instead of silently rendering bundled mock data. All read hooks now branch on a single `dataSource` value from `env.ts`.
