---
'@crawl/shared-types': patch
---

Add optional `resetAt` (ISO 8601 datetime string) to the shared `VoteState` type to
match the server's vote state response, allowing clients to display when daily votes
reset without a type assertion.
