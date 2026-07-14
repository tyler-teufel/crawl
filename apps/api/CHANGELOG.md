# @crawl/api

## 1.0.7

### Patch Changes

- 23cec89: Bump `zod` to v4 and `fastify-type-provider-zod` to v7 together (Dependabot #87/#88 must land as one coordinated upgrade since v7 of the provider targets Zod 4 specifically). Tightened UUID validation in Zod 4 (`.uuid()` now enforces RFC 4122 version/variant nibbles) required switching request/response UUID schemas from `.uuid()` to the RFC-format-agnostic `.guid()` to preserve existing validation behavior for non-v4 identifiers.
- Updated dependencies [23cec89]
  - @crawl/shared-types@1.0.2
