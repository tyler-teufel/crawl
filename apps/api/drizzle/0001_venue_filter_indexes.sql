-- Indexes supporting dynamic filter composition in `useVenues`.
-- All idempotent; safe to re-run.
--
-- Filter predicates (decided in docs/architecture/DESIGN_DECISIONS.md
-- "Dynamic Venue Filtering Strategy"):
--   trending          → is_trending = true
--   open-now          → is_open = true
--   live-music, happy-hour, rooftop, craft-cocktails,
--   dive-bar, sports, dancing, outdoor
--                     → highlights @> ARRAY['<tag>']
--
-- The map screen always scopes by city, so each compound index leads
-- with `city` to satisfy index-only access for the common case.

CREATE INDEX IF NOT EXISTS venues_city_active_idx
  ON venues (city, is_active);

CREATE INDEX IF NOT EXISTS venues_city_trending_idx
  ON venues (city, is_trending)
  WHERE is_trending = true;

CREATE INDEX IF NOT EXISTS venues_city_open_idx
  ON venues (city, is_open)
  WHERE is_open = true;

-- GIN index on highlights[] enables fast `highlights @> ARRAY['<tag>']`
-- and `highlights && ARRAY[...]` lookups across all the tag-based filters.
CREATE INDEX IF NOT EXISTS venues_highlights_gin_idx
  ON venues USING gin (highlights);

-- Cities are looked up by `is_active = true` and rarely change; a small
-- index keeps the `useCities` hook fast even as the table grows.
CREATE INDEX IF NOT EXISTS cities_is_active_idx
  ON cities (is_active)
  WHERE is_active = true;
