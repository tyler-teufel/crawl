# Agent Team — Charter & Orchestration Guide

**Status:** Active (first wave) · **Last updated:** 2026-07-08

The Crawl agent team is a set of specialized Claude Code subagents (`.claude/agents/*.md`) coordinated by a scrum-master skill (`/scrum`, defined in `.claude/skills/scrum/SKILL.md`). The scrum master runs standup over the sprint plan and GitHub Issues, assigns tickets to workers, dispatches them, and verifies results before anything is reported done.

This implements the first wave of the roster proposed in [CLAUDE_DIRECTORY_PLAN.md](./CLAUDE_DIRECTORY_PLAN.md), collapsed to the roles the current (frontend-focused) sprints need.

---

## Why the scrum master is a skill, not an agent

Claude Code subagents cannot spawn subagents — orchestration must live in the main session loop. So the scrum master's *brain* is a skill the main session executes, and its *hands* are the main session's Agent tool. Worker agents are real, isolated subagent configs with scoped tools. See the "Agent Orchestration" section of [DESIGN_DECISIONS.md](../architecture/DESIGN_DECISIONS.md) for the full rationale.

---

## Orchestration flow

```
                       ┌────────────────────────────┐
                       │   Main session — /scrum    │
                       │      (scrum master)        │
                       └─────────────┬──────────────┘
        1. standup                   │
   ┌──────────────────┐              │
   │ SPRINT_PLAN doc  │◄─────────────┤ reads plan, issues, PRs
   │ GitHub Issues    │              │
   └──────────────────┘              │
        2. assign (user confirms)    │
                                     ▼
              ┌──────────────┬───────────────┬──────────────┐
              │              │               │              │
              ▼              ▼               ▼              ▼
      ┌──────────────┐ ┌─────────────┐ ┌────────────┐ ┌─────────────┐
      │   mobile-    │ │     qa-     │ │   docs-    │ │    code-    │
      │   engineer   │ │   engineer  │ │   writer   │ │   reviewer  │
      │ (implement)  │ │ (repro/test │ │ (sync docs)│ │ (read-only  │
      │              │ │  /verify)   │ │            │ │   review)   │
      └──────┬───────┘ └──────┬──────┘ └─────┬──────┘ └──────┬──────┘
             │                │              │               │
             └────────────────┴──────┬───────┴───────────────┘
                                     │ 3. results return
                                     ▼
                       ┌────────────────────────────┐
                       │ 4. verify → 5. report:     │
                       │ issue comments, changeset, │
                       │ PR into release/vX.Y.Z     │
                       └────────────────────────────┘
```

---

## Roster (wave 1)

| Agent | Role | File scope (owns) | Never touches | Tools | Model |
| --- | --- | --- | --- | --- | --- |
| `mobile-engineer` | Implements tickets in the Expo app | `apps/mobile/**` | `apps/api`, `packages`, `docs`, `wiki` | Read/Edit/Write/Glob/Grep/Bash | inherit |
| `qa-engineer` | Regression tests, bug reproduction, acceptance verification | `apps/mobile/tests/**`, `apps/api/tests/**` | production source, `docs`, `wiki` | Read/Edit/Write/Glob/Grep/Bash | inherit |
| `docs-writer` | Keeps `docs/` in sync per the doc-maintenance mandate | `docs/**` | source code, `wiki/**` | Read/Edit/Write/Glob/Grep + read-only git | haiku |
| `code-reviewer` | Independent pre-PR diff review | *(read-only)* | everything (reports only) | Read/Glob/Grep + read-only git | inherit |

Role boundaries are enforced in each agent's config (`.claude/agents/<name>.md`): scope, conventions, definition of done, and when to hand back to the orchestrator. Workers report; the scrum master (main session) commits, pushes, and does GitHub bookkeeping.

---

## How to run a sprint day

```
/scrum                  # standup + proposed assignments, waits for your OK
/scrum next             # pick and run the single highest-priority unblocked ticket
/scrum ticket #46       # work a specific issue
/scrum auto             # dispatch without assignment confirmation
```

Typical bug-ticket lifecycle (e.g. #45, vote reset):

1. `/scrum ticket #45` — scrum master reads the issue, confirms the assignment with you.
2. `qa-engineer` writes a failing regression test reproducing the bug.
3. `mobile-engineer` implements the fix on `fix/vote-state-persistence` off `release/v1.0.1`.
4. `qa-engineer` re-runs: failing test now green, acceptance criteria checked ✅/❌.
5. `code-reviewer` reviews the diff; change requests loop back to step 3 (same agent, via SendMessage).
6. `docs-writer` runs if architecture/files/dependencies changed.
7. Scrum master ships a changeset, comments on the issue, opens the PR into the release branch.

## Ground rules

- **One ticket, one worker, one branch.** No batching unrelated tickets into a single agent run.
- **Workers start cold.** Every dispatch brief must paste the root cause, fix approach, and acceptance criteria — workers can't see the main conversation.
- **Verification is independent.** A ticket is not done on the implementer's claim; the qa-engineer's criterion-by-criterion verdict and the code-reviewer's verdict are required.
- **Ambiguity goes to the user, not to a worker's guess** (e.g. the AND-vs-OR filter semantics flagged on #46).
- **Versioning discipline:** any `apps/mobile`-touching work ships a changeset; versions are never hand-edited (see SPRINT_PLAN_2026-07.md, Epic V).

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `/scrum` not recognized | Skill loads at session start — restart the session after pulling the branch that adds `.claude/skills/scrum/`. |
| Worker agent type not found when dispatching | Same session-start snapshot issue: agent configs added mid-session aren't loaded until a new session. |
| Worker edited files outside its scope | Its config forbids this — reject the result, re-dispatch with the boundary restated, and tighten the config if it recurs. |
| Two parallel workers clobbered each other | Dispatch parallel implementation agents with worktree isolation (the scrum skill specifies this). |
| Worker "completed" but criteria unmet | Expected occasionally — this is exactly why the qa-engineer verification step is mandatory before reporting done. |

## Expansion criteria (wave 2 and beyond)

Add a role only when there's recurring work it would own **now** (the directory plan's own rule). Triggers:

- Backend work resumes (Mode B/C from the stabilization plan) → `backend-engineer` (Fastify/Drizzle, `apps/api/**` + `packages/shared-types/**`).
- CI/EAS/Railway changes become frequent → `devops-engineer`.
- Auth surface or input-validation changes → `security-reviewer` pass alongside code-reviewer.
- Guardrail hooks (`session-start.sh`, `pre-commit-guard.sh`) are tracked separately — see the Epic E issues in the sprint plan.
