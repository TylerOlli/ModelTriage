# API Keys & Authentication

## Overview

Pro users can generate API keys for programmatic access to ModelTriage. Keys are used by the CLI tool and can authenticate any request to the `/api/stream` endpoint.

## Key Format

- Prefix: `mt_` followed by 64 hex characters
- Example: `mt_a1b2c3d4e5f6...`
- Storage: SHA-256 hash in database — the plain-text key is shown once on creation

## Key Management

### Creating keys

- Navigate to **Account → API keys**
- Click "Create new API key"
- Optionally add a label (e.g. "My laptop", "CI/CD")
- Copy the key immediately — it won't be shown again

### Limits

- Maximum **5 active keys** per user
- Keys are tied to your user account
- All keys share the same daily request quota

### Revoking keys

- Click "Revoke" next to any key in the account page
- Revocation is immediate — any tool using that key will receive `401` errors
- Revocation is a soft delete (key record preserved for audit trail)

## API Authentication

Include the API key as a Bearer token:

```bash
curl -X POST https://modeltriage.com/api/stream \
  -H "Authorization: Bearer mt_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello", "stream": true}'
```

### Auth resolution priority

1. **API key** (`Authorization: Bearer mt_...`) — checked first
2. **Supabase session** (cookie-based, web UI)
3. **Anonymous fingerprint** (IP + localStorage ID)

### Error responses

| Status | Meaning |
|--------|---------|
| `401` | Invalid or revoked API key |
| `403` | API key exists but user is not on Pro plan |
| `429` | Daily rate limit exceeded |

## Rate Limit Headers

API key authenticated responses include rate limit headers:

```
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 158
X-RateLimit-Used: 42
```

## Database Schema

```sql
CREATE TABLE api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  key_hash    TEXT UNIQUE NOT NULL,  -- SHA-256 of full key
  key_prefix  TEXT NOT NULL,          -- "mt_abc1..." for display
  label       TEXT,                   -- optional user label
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ            -- soft delete
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
```

## Security

- Keys are **never stored in plain text** — only the SHA-256 hash is persisted
- The `keyPrefix` (first 11 characters) is stored for UI display purposes
- Key lookup is O(1) via the unique `key_hash` index
- `lastUsedAt` is updated fire-and-forget on each authenticated request

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/keys` | Create a new API key |
| `GET` | `/api/keys` | List active (non-revoked) keys |
| `DELETE` | `/api/keys/[id]` | Revoke a specific key |

## Implementation Files

- `lib/api-keys.ts` — Key generation, hashing, resolution
- `src/app/api/keys/route.ts` — Create + list endpoints
- `src/app/api/keys/[id]/route.ts` — Revoke endpoint
- `src/app/api/stream/route.ts` — API key auth in streaming endpoint
