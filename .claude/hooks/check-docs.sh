#!/bin/bash
# PostToolUse hook: checks if an edited/written file warrants documentation updates.
# Runs after Edit or Write tool calls. Outputs a system message if the file
# is in a docs-relevant path.

# Read tool input from stdin
INPUT=$(cat)

# Extract the file path from the tool input
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Normalize to forward slashes and get relative path
FILE_PATH=$(echo "$FILE_PATH" | sed 's|\\|/|g')

# Skip if the edit is already to a docs file or memory file
if echo "$FILE_PATH" | grep -qE '(/docs/|/memory/|CLAUDE\.md|MEMORY\.md|\.claude/)'; then
  exit 0
fi

# Check if the file is in a docs-relevant path
NEEDS_DOCS=false
REASON=""

if echo "$FILE_PATH" | grep -qE '/apps/api/src/'; then
  NEEDS_DOCS=true
  REASON="API source change — may need updates to FILE_REFERENCE.md, ARCHITECTURE.md, or DATA_PIPELINE.md"
elif echo "$FILE_PATH" | grep -qE '/apps/mobile/app/'; then
  NEEDS_DOCS=true
  REASON="Screen/route change — may need updates to ARCHITECTURE.md and FILE_REFERENCE.md"
elif echo "$FILE_PATH" | grep -qE '/apps/mobile/components/'; then
  NEEDS_DOCS=true
  REASON="Component change — may need updates to FILE_REFERENCE.md and ARCHITECTURE.md (component graph)"
elif echo "$FILE_PATH" | grep -qE '/apps/mobile/src/'; then
  NEEDS_DOCS=true
  REASON="Shared logic change — may need updates to FILE_REFERENCE.md"
elif echo "$FILE_PATH" | grep -qE '/packages/shared-types/'; then
  NEEDS_DOCS=true
  REASON="Shared types change — may need updates to FILE_REFERENCE.md and ARCHITECTURE.md"
elif echo "$FILE_PATH" | grep -qE '(package\.json|tsconfig.*\.json|turbo\.json)'; then
  NEEDS_DOCS=true
  REASON="Config change — may need updates to PROJECT_OVERVIEW.md or FILE_REFERENCE.md"
elif echo "$FILE_PATH" | grep -qE '(tailwind\.config|global\.css|theme\.ts)'; then
  NEEDS_DOCS=true
  REASON="Styling change — may need updates to REACT_NATIVE_REUSABLES.md and ARCHITECTURE.md"
fi

if [ "$NEEDS_DOCS" = true ]; then
  jq -n --arg reason "$REASON" '{
    "continue": true,
    "suppressOutput": true,
    "systemMessage": ("Documentation note: " + $reason + ". Consider running /docs when this task is complete.")
  }'
fi

exit 0
