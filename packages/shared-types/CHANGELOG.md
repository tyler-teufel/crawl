# @crawl/shared-types

## 1.0.2

### Patch Changes

- 23cec89: Bump `zod` to v4 and `fastify-type-provider-zod` to v7 together (Dependabot #87/#88 must land as one coordinated upgrade since v7 of the provider targets Zod 4 specifically). Tightened UUID validation in Zod 4 (`.uuid()` now enforces RFC 4122 version/variant nibbles) required switching request/response UUID schemas from `.uuid()` to the RFC-format-agnostic `.guid()` to preserve existing validation behavior for non-v4 identifiers.

## 1.0.1

### Patch Changes

- 3dc86e4: Add optional `resetAt` (ISO 8601 datetime string) to the shared `VoteState` type to
  match the server's vote state response, allowing clients to display when daily votes
  reset without a type assertion.
