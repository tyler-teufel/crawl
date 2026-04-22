# API Reference

Complete reference for the Crawl REST API (`apps/api`).

**Base URL (local):** `http://localhost:3000/api/v1`
**Base URL (production):** `https://api.crawlapp.com/api/v1` _(TBD — set when hosting is configured)_

---

## Authentication

Protected endpoints require a JWT `Bearer` token in the `Authorization` header:

```
Authorization: Bearer <accessToken>
```

Tokens are obtained via `POST /auth/login` or `POST /auth/register`. Access tokens expire after **15 minutes**. Use `POST /auth/refresh` to rotate the token pair.

---

## Endpoints

### Health

#### `GET /health`

Health check. No auth required. Used by load balancers and uptime monitors.

**Response 200:**
```json
{
  "status": "ok",
  "version": "0.0.0",
  "timestamp": "2026-04-20T00:00:00.000Z",
  "checks": {
    "database": "not_configured",
    "memory": {
      "heapUsedMb": 42,
      "heapTotalMb": 128
    }
  }
}
```

`database` values: `"ok"` | `"unavailable"` | `"not_configured"`

---

### Venues

#### `GET /venues`

List venues with optional filtering. No auth required.

**Query params:**

| Param     | Type   | Default | Description                                           |
|-----------|--------|---------|-------------------------------------------------------|
| `city`    | string | —       | City name substring filter (e.g. `Austin`)            |
| `lat`     | number | —       | Latitude for geo search (requires `lng` and `radius`) |
| `lng`     | number | —       | Longitude for geo search                              |
| `radius`  | number | `5000`  | Radius in meters for geo search                       |
| `q`       | string | —       | Full-text search across name, type, description       |
| `filters` | string | —       | Comma-separated venue types (e.g. `Bar,Club`)         |
| `page`    | number | `1`     | Page number                                           |
| `limit`   | number | `20`    | Results per page (max 100)                            |

**Response 200:**
```json
{
  "data": [
    {
      "id": "11111111-1111-1111-1111-111111111111",
      "name": "Rainey Street Brewing Co.",
      "type": "Bar",
      "address": "119 Rainey St",
      "city": "Austin, TX",
      "latitude": 30.2564,
      "longitude": -97.7352,
      "hotspotScore": 87,
      "voteCount": 142,
      "isOpen": true,
      "isTrending": true,
      "highlights": ["Craft Beer", "Live Music", "Patio"],
      "priceLevel": 2,
      "hours": "4pm - 2am",
      "description": "...",
      "imageUrl": null,
      "distance": "0.3 mi",
      "createdAt": "2026-04-20T00:00:00.000Z",
      "updatedAt": "2026-04-20T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "totalPages": 1
  }
}
```

---

#### `GET /venues/:id`

Fetch a single venue by UUID. No auth required.

**Path param:** `id` — UUID

**Response 200:** Single venue object (same shape as list items)
**Response 404:**
```json
{ "error": "Not Found", "message": "Venue <id> not found", "statusCode": 404 }
```

---

### Votes

All vote endpoints require authentication.

#### `GET /votes`

Returns the authenticated user's vote state for today.

**Response 200:**
```json
{
  "remainingVotes": 2,
  "maxVotes": 3,
  "votedVenueIds": ["11111111-1111-1111-1111-111111111111"],
  "resetAt": "2026-04-21T00:00:00.000Z"
}
```

---

#### `POST /votes`

Cast a vote for a venue. Each user gets 3 votes per day; one vote per venue per day.

**Request body:**
```json
{ "venueId": "11111111-1111-1111-1111-111111111111" }
```

**Response 200:** Updated `VoteState` (same shape as `GET /votes`)

**Error codes:**

| Status | Code                  | Meaning                              |
|--------|-----------------------|--------------------------------------|
| 400    | —                     | Validation error (invalid UUID)      |
| 401    | `Unauthorized`        | Missing or invalid token             |
| 404    | `VENUE_NOT_FOUND`     | Venue ID does not exist              |
| 409    | `ALREADY_VOTED`       | Already voted for this venue today   |
| 422    | `NO_VOTES_REMAINING`  | Used all 3 daily votes               |

---

#### `DELETE /votes/:venueId`

Remove today's vote for a venue. Only today's vote can be removed.

**Path param:** `venueId` — UUID

**Response 200:** Updated `VoteState`
**Response 404:** `VOTE_NOT_FOUND` — no vote exists for this venue today

---

### Trending

#### `GET /trending/:city`

Returns venues for a city sorted by hotspot score descending. No auth required.

**Path param:** `city` — URL-encoded city name (e.g. `Austin%2C+TX`)

**Query params:**

| Param   | Type   | Default | Description               |
|---------|--------|---------|---------------------------|
| `limit` | number | `10`    | Max results (max 50)      |

**Response 200:** Array of venue objects sorted by `hotspotScore` descending.

---

### Auth

#### `POST /auth/register`

Create a new user account.

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "displayName": "Tyler"
}
```

**Response 201:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "Tyler",
    "city": "Austin, TX",
    "createdAt": "2026-04-20T00:00:00.000Z"
  },
  "tokens": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 900
  }
}
```

**Response 409:** `EMAIL_IN_USE` — email already registered

---

#### `POST /auth/login`

Authenticate with email and password.

**Request body:**
```json
{ "email": "user@example.com", "password": "securepassword123" }
```

**Response 200:** Same shape as register response (201)
**Response 401:** `INVALID_CREDENTIALS`

---

#### `POST /auth/refresh`

Rotate token pair using a valid refresh token.

**Request body:**
```json
{ "refreshToken": "eyJ..." }
```

**Response 200:**
```json
{
  "tokens": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 900
  }
}
```

**Response 401:** `INVALID_TOKEN` — token expired, malformed, or is an access token

---

## Error Response Shape

All errors follow this envelope:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable message",
  "statusCode": 400,
  "details": {}
}
```

Validation errors include a `details` array from Fastify's schema validation.

---

## Rate Limits (Phase 8 — planned)

| Endpoint group   | Limit                    |
|------------------|--------------------------|
| `POST /votes`    | 10 requests/min per user |
| `POST /auth/*`   | 5 requests/min per IP    |
| General API      | 100 requests/min per user|

---

## Postman Collection

A Postman collection is available at `crawl-api.postman_collection.json` in the repo root. Import it and set the `{{baseUrl}}` variable to `http://localhost:3000/api/v1`.

Environment globals are at `apps/api/postman/globals/workspace.globals.yaml`.
