---
'@crawl/mobile': minor
---

Re-add a Supabase-direct read branch for venues and cities, gated behind `hasSupabase`. Reads now branch `hasApi` → `hasSupabase` → bundled mock data, so the app can read live venue/city data from Supabase (RLS permits public read) without a Railway API deployment.
