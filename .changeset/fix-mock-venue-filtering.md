---
"@crawl/mobile": patch
---

Fix venue filter chips having no effect in mock mode: mock `useVenues` now applies filter predicates (AND semantics) via a new `filterVenues` util.
