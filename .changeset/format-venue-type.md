---
'@crawl/mobile': patch
---

Format Google Places venue types for display — `lounge_bar` now renders as "Lounge Bar" instead of a raw snake_case token on venue cards, list items, map callouts, and the detail screen. Applied at the data boundary in `rowToVenue`; already-formatted strings (bundled mock venues) pass through untouched.
