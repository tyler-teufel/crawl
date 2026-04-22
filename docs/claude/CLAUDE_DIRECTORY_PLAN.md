# `.claude/` Directory Overhaul Plan

**Status:** Proposed — not yet implemented.
**Last updated:** 2026-04-22

This document captures the plan for evolving `.claude/` from its current minimal
state into a purposeful toolkit: an SDLC-aligned roster of agents, useful hooks,
and sharper rules. It is separate from the work done in the rest of the
`feature-backend` branch; execution will happen once that branch is merged.

## Motivation

Today the `.claude/` directory has:

- 1 hook: `.claude/hooks/check-docs.sh` (PostToolUse, Edit|Write)
- 0 slash commands
- 3 skills (`docs`, `supabase`, `supabase-postgres-best-practices`)
- 0 agents

That's enough to trigger doc reminders, but it misses most of what makes
Claude Code a force multiplier on a real project: specialized agents with
scoped tool access, guardrail hooks against destructive ops, and slash
commands that encode common workflows.

## Target structure

```
.claude/
├── CLAUDE.md                      # NEW — narrative rules for this repo
├── settings.json                  # existing (team-shared hooks/permissions)
├── settings.local.json            # existing (personal, gitignored)
├── agents/                        # NEW — one .md per agent, SDLC-aligned
│   ├── planner.md
│   ├── mobile-engineer.md
│   ├── backend-engineer.md
│   ├── data-engineer.md
│   ├── devops-engineer.md
│   ├── qa-engineer.md
│   ├── docs-writer.md
│   ├── security-reviewer.md
│   └── code-reviewer.md
├── commands/                      # slash commands — thin wrappers over agents
│   ├── plan.md
│   ├── doc-sync.md
│   ├── pre-pr.md
│   └── sync-city.md
├── hooks/
│   ├── check-docs.sh              # existing
│   ├── session-start.sh           # NEW
│   ├── pre-commit-guard.sh        # NEW
│   └── stop-summary.sh            # NEW
└── skills/
    ├── docs/                      # existing
    ├── supabase/                  # fix broken listing
    └── supabase-postgres-best-practices/   # fix broken listing
```

## Agents — responsibilities

Each agent file specifies: **when to invoke**, **allowed tools**, **file
scope**, **style rules**, **when to delegate back**.

| Agent                | Owns                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `planner`            | Product/tech planning, decomposition, plan-mode work                                               |
| `mobile-engineer`    | Expo / RN / NativeWind work under `apps/mobile/**`                                                 |
| `backend-engineer`   | Fastify / Drizzle / Supabase work under `apps/api/**` and `packages/shared-types/**`               |
| `data-engineer`      | Sync jobs, Drizzle migrations, Places API ingest, seed data                                        |
| `devops-engineer`    | GitHub Actions, Railway, EAS, CI/CD pipeline changes                                               |
| `qa-engineer`        | Vitest/Playwright authorship, test strategy, repro scripts for bugs                                |
| `docs-writer`        | Keeps `docs/` in sync with code; owns `docs/` structure                                            |
| `security-reviewer`  | Sec-review pass on diffs (auth flows, secrets, input validation, SQL/XSS)                          |
| `code-reviewer`      | Independent PR review, style/structure feedback                                                    |

Early rosters may collapse roles (e.g. `devops-engineer` and `data-engineer`
as one person). Split only when the volume justifies it.

## Hooks — proposed additions

| Hook                    | Event                          | Why                                                                                                                                     |
| ----------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `session-start.sh`      | `SessionStart`                 | Print `git branch --show-current`, worktree path, and last commit. Avoids the "forgot what branch I'm on" foot-gun the root CLAUDE.md flags. |
| `pre-commit-guard.sh`   | `PreToolUse` matcher `Bash`    | Block `git push --force`, `git reset --hard`, `rm -rf`, and `drizzle-kit push` against non-local DBs unless explicitly approved.        |
| `stop-summary.sh`       | `Stop`                         | If `apps/**/src/**` was edited but `docs/**` wasn't, remind the agent to run `/doc-sync` before closing.                                |

## Slash commands — candidates

Thin wrappers over the agents, so users can invoke them directly.

| Command       | Delegates to                                   | Use                                             |
| ------------- | ---------------------------------------------- | ----------------------------------------------- |
| `/plan`       | `planner`                                      | Before starting non-trivial work                |
| `/doc-sync`   | `docs-writer` (scoped to recent diff)          | Update docs after code changes                  |
| `/pre-pr`     | `code-reviewer` + `security-reviewer` (parallel) | Right before opening a PR                       |
| `/sync-city`  | `devops-engineer`                              | Dispatch the `Sync Venues` GH Actions workflow  |

## Rule refinements (CLAUDE.md additions)

- **Delegation table.** For task X, invoke agent Y. Removes ambiguity about
  which role Claude should take.
- **Permission tightening.** Audit `.claude/settings.local.json` after a few
  sessions to find commands that still trigger prompts. Use the
  `fewer-permission-prompts` skill to build the allowlist.
- **Citation rule.** All new agents cite file paths as `file:line` so users
  can jump instantly in VS Code / JetBrains.
- **Memory boundaries.** Clarify what lives in `.claude/memory/` (cross-session
  facts about the user/project) vs what lives here (rules/agents).

## Execution order (once merged)

1. **Create `.claude/CLAUDE.md`** — the narrative rule file specific to this
   directory.
2. **Add hooks** (`session-start`, `pre-commit-guard`) — cheapest high-value
   guardrails.
3. **Add agents one at a time.** Start with `docs-writer` and
   `backend-engineer` since those are the active surfaces. Resist scaffolding
   all nine at once.
4. **Add slash commands last.** They're thin wrappers over agents and are
   trivial once the agent definitions exist.
5. **Audit settings.local.json** using the `fewer-permission-prompts` skill.

## Open questions

- Do we want agents to have their own scoped `CLAUDE.md` inside
  `.claude/agents/<agent>/` for deeper per-role rules, or is a single file
  sufficient?
- Should `.claude/memory/` be gitignored (personal) or committed (team
  shared)? Current behavior is user-level only — probably keep that.
- Does the `docs-writer` agent cover `wiki/` maintenance, or is the wiki
  still only updated from the Crawl repo per the root CLAUDE.md? Need to
  reconcile before writing `docs-writer.md`.
