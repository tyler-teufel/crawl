#!/bin/bash
# SessionStart hook: prints git orientation (branch, worktree path, last commit)
# at the start of every session so an agent never has to guess which
# branch/worktree it's in — this matters most for parallel worktree-isolated
# workers dispatched by /scrum. See root CLAUDE.md's Git Workflow section.

# Read (and discard) the hook payload — we don't need any fields from it,
# but stdin must be drained since Claude Code always sends one.
cat >/dev/null

WORKTREE=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
BRANCH=$(git branch --show-current 2>/dev/null)
if [ -z "$BRANCH" ]; then
  BRANCH="(detached HEAD)"
fi
LAST_COMMIT=$(git log -1 --oneline 2>/dev/null || echo "(no commits yet)")

CONTEXT="Session orientation:
- Branch: $BRANCH
- Worktree: $WORKTREE
- Last commit: $LAST_COMMIT"

jq -n --arg ctx "$CONTEXT" '{
  "continue": true,
  "suppressOutput": false,
  "systemMessage": $ctx,
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": $ctx
  }
}'

exit 0
