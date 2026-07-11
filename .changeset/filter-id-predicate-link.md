---
'@crawl/mobile': patch
---

Link filter ids to the `filterVenues` predicate map at compile time: `defaultFilters` is
now `as const satisfies readonly FilterOption[]` and the predicate map is keyed on the
literal id union, so renaming or adding a filter id without a matching predicate fails
typecheck. The runtime fallback for unknown server-driven ids is preserved.
