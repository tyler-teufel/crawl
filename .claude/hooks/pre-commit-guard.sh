#!/bin/bash
# PreToolUse hook (matcher: Bash): blocks destructive commands before they run.
#
# Blocked by default:
#   - git push --force / -f            (rewrites remote history)
#   - git reset --hard                 (discards uncommitted work irreversibly)
#   - rm -rf / rm -fr                  (unless the path is a known-safe
#                                        scratch/build path — see ALLOWLIST below)
#   - drizzle-kit push against a database that isn't clearly local
#
# Explicit-approval escape hatch: prefix the command with
#   GUARDRAIL_APPROVE=1
# to skip these checks for that one, deliberately-reviewed command, e.g.:
#   GUARDRAIL_APPROVE=1 git push --force origin my-branch
#
# Blocking mechanism: exit 2 + a message on stderr, which Claude Code's
# PreToolUse contract treats as "deny the tool call, feed stderr back to
# the model as the reason."

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ "$TOOL_NAME" != "Bash" ] || [ -z "$CMD" ]; then
  exit 0
fi

# Explicit approval bypass — must be a literal, standalone env-var prefix.
if echo "$CMD" | grep -qE '(^|[;&|[:space:]])GUARDRAIL_APPROVE=1([;&|[:space:]]|$)'; then
  exit 0
fi

block() {
  {
    echo "[pre-commit-guard] BLOCKED: $1"
    echo "[pre-commit-guard] Command: $CMD"
    echo "[pre-commit-guard] If this is intentional and reviewed, re-run with a GUARDRAIL_APPROVE=1 prefix to bypass this check."
  } >&2
  exit 2
}

# 1. git push --force / -f (short flag). --force-with-lease is intentionally
#    NOT blocked — it's the safer, remote-aware alternative and is already
#    the recommended pattern elsewhere in this repo's git workflow docs.
if echo "$CMD" | grep -qE '\bgit\b.*\bpush\b'; then
  if echo "$CMD" | grep -qE '(^|[[:space:]])(-f|--force)([[:space:]]|$)'; then
    block "force-push detected (git push --force/-f). This can overwrite remote history and break other agents' worktrees."
  fi
fi

# 2. git reset --hard
if echo "$CMD" | grep -qE '\bgit\b.*\breset\b.*--hard\b'; then
  block "git reset --hard discards uncommitted work irreversibly."
fi

# 3. rm -rf / rm -fr, unless the target is a known-safe scratch/build path.
RM_SEGMENTS=$(echo "$CMD" | grep -oE 'rm[[:space:]]+[^;&|]*' || true)
if [ -n "$RM_SEGMENTS" ]; then
  while IFS= read -r seg; do
    [ -z "$seg" ] && continue
    HAS_R=false
    HAS_F=false
    echo "$seg" | grep -qE -- '(--recursive|(^|[[:space:]])-[A-Za-z]*r[A-Za-z]*([[:space:]]|$))' && HAS_R=true
    echo "$seg" | grep -qE -- '(--force|(^|[[:space:]])-[A-Za-z]*f[A-Za-z]*([[:space:]]|$))' && HAS_F=true
    if [ "$HAS_R" = true ] && [ "$HAS_F" = true ]; then
      if ! echo "$seg" | grep -qE '(node_modules|/dist(/|$)|/build(/|$)|\.turbo|\.next|\.cache|/coverage(/|$)|/tmp/|^/tmp|scratchpad)'; then
        block "rm -rf targets a path outside the known-safe allowlist (node_modules/dist/build/.turbo/.next/.cache/coverage//tmp/scratchpad). Segment: '$seg'"
      fi
    fi
  done <<<"$RM_SEGMENTS"
fi

# 4. drizzle-kit push against a non-local database.
if echo "$CMD" | grep -qE 'drizzle-kit[[:space:]]+push\b'; then
  if echo "$CMD" | grep -qE 'localhost|127\.0\.0\.1|0\.0\.0\.0'; then
    : # explicit local host reference — allow
  elif echo "$CMD" | grep -qE '(postgres(ql)?|mysql)://'; then
    block "drizzle-kit push with an inline connection string that isn't localhost/127.0.0.1 — looks like a non-local database."
  elif echo "$CMD" | grep -qiE '(supabase\.co|railway\.app|neon\.tech|amazonaws\.com|render\.com|production|staging|--prod\b)'; then
    block "drizzle-kit push appears targeted at a non-local/staging/production database."
  fi
fi

exit 0
