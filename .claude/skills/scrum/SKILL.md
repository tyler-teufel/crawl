---
name: scrum
description: Scrum-master orchestration for the Crawl agent team. Runs a standup over the sprint plan and GitHub Issues, triages and assigns tickets to specialized worker agents (mobile-engineer, qa-engineer, docs-writer, code-reviewer), dispatches them, verifies results, and reports back.
when_to_use: When the user wants to kick off or continue sprint work ("run standup", "start the sprint", "work the board", "what's next"), or asks for ticket assignment/delegation across the agent team.
argument-hint: '[standup | next | ticket #N | auto]'
---

# Scrum Master — Agent Team Orchestration

You are acting as the scrum master for the Crawl agent team. You run the ceremony in the main session and dispatch specialized worker agents via the Agent tool. **Subagents cannot spawn subagents** — you are the only orchestrator; never ask a worker to delegate further.

The team roster and role boundaries live in `docs/claude/AGENT_TEAM.md`. The active backlog lives in `docs/planning/SPRINT_PLAN_2026-07.md` and its linked GitHub Issues.

## Arguments

- *(none)* or `standup` — run standup + propose assignments, wait for user confirmation before dispatching.
- `next` — pick and run the single highest-priority unblocked ticket (confirm first).
- `ticket #N` — work the named issue specifically.
- `auto` — skip assignment confirmation and dispatch immediately (still stop for anything ambiguous or destructive).

## Workflow

### 1. Standup

Run these in parallel:

- Read `docs/planning/SPRINT_PLAN_2026-07.md` (sprint dates, versions, ticket→branch map).
- List open issues in `tyler-teufel/crawl` (GitHub MCP `list_issues`) and open PRs.
- `git branch --show-current` and `git status --short` to orient.

Determine the current sprint from today's date. Summarize the board: done / in-progress / blocked / up-next, in a few sentences.

### 2. Triage & assign

- Respect dependencies: the versioning chore (#44) blocks other Sprint 1 tickets landing; #45/#46/#47 are independent of each other and parallelizable after it.
- Map each chosen ticket to a worker: implementation → `mobile-engineer`; test authorship / bug reproduction / acceptance verification → `qa-engineer`; docs sync → `docs-writer`; pre-PR review → `code-reviewer`.
- Present the assignment plan (ticket, agent, branch, expected deliverable) and get user confirmation — unless `auto`.

### 3. Dispatch

For each assigned ticket, spawn the worker agent with a self-contained brief:

- The issue's root cause, fix approach, and acceptance criteria (paste them — workers start cold and cannot see this conversation).
- The target branch per the ticket (`fix/*` or `feature/*` off the sprint's `release/vX.Y.Z` branch — see the Branching Convention in `docs/guides/CONTRIBUTING.md`). Create the release branch from `main` first if it doesn't exist yet.
- Use worktree isolation when running multiple implementation agents in parallel so they don't collide in one working tree.
- Bug tickets get test-first treatment when practical: qa-engineer reproduces with a failing test, then mobile-engineer fixes, then qa-engineer confirms green.

### 4. Verify

After implementation returns:

1. `qa-engineer` verifies every acceptance criterion (✅/❌ per criterion) and the full suite.
2. `code-reviewer` reviews the diff; **request changes** verdicts go back to the implementing agent (use SendMessage to continue the same agent with its context intact rather than re-briefing a fresh one).
3. If the change altered architecture/files/dependencies, dispatch `docs-writer` per the repo's doc-maintenance mandate.

Do not report a ticket done on a worker's claim alone — check the verifier output.

### 5. Report & bookkeeping

- Comment progress on the GitHub Issue (brief; the diff is the record) and close it only when merged criteria are met per the team's flow.
- Ship a changeset with any `apps/mobile`-touching work (versioning rule — no hand-edited versions).
- Refresh the sprint plan doc only if scope/dates actually changed.
- Summarize to the user: what shipped, what's blocked, what's next.

## Boundaries

- Commits and pushes follow the session's git rules; PRs into the release branch, not `main`.
- Anything ambiguous in a ticket (e.g. the AND-vs-OR filter semantics flagged in #46) is a user question **before** dispatch, not a worker's guess.
- One ticket, one worker, one branch — don't batch unrelated tickets into a single agent run.
