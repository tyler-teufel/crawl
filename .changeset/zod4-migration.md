---
'@crawl/api': patch
'@crawl/shared-types': patch
---

Bump `zod` to v4 and `fastify-type-provider-zod` to v7 together (Dependabot #87/#88 must land as one coordinated upgrade since v7 of the provider targets Zod 4 specifically). Tightened UUID validation in Zod 4 (`.uuid()` now enforces RFC 4122 version/variant nibbles) required switching request/response UUID schemas from `.uuid()` to the RFC-format-agnostic `.guid()` to preserve existing validation behavior for non-v4 identifiers.
