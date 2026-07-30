#!/usr/bin/env node
// Helper for .github/workflows/db-migrate.yml — read-only reporting against
// the target database's `drizzle.__drizzle_migrations` ledger. Never runs
// DDL and never writes to the ledger itself; only `drizzle-kit migrate`
// (invoked separately by the workflow) does that.
//
// Modes:
//   node db-migrate-report.mjs pending  — list migrations pending in
//     apps/api/drizzle/ but not yet recorded in the ledger.
//   node db-migrate-report.mjs ledger   — print the ledger's current rows,
//     resolved back to migration names.
//
// Both modes append a Markdown section to $GITHUB_STEP_SUMMARY (falls back
// to stdout only when that env var is unset, e.g. local runs) and must be
// invoked with cwd = apps/api so the relative `drizzle/meta/_journal.json`
// path resolves.
//
// Pending detection mirrors drizzle-kit's own cursor logic (see
// drizzle-orm/pg-core/dialect.*'s PgDialect#migrate): a migration is
// "pending" iff its journal `when` timestamp is strictly greater than the
// max `created_at` currently recorded in the ledger — drizzle-kit does not
// match individual migrations by hash, only by that single cursor.

import { readFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const mode = process.argv[2];
if (!['pending', 'ledger'].includes(mode)) {
  console.error('Usage: node db-migrate-report.mjs <pending|ledger>');
  process.exit(1);
}

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.error('DIRECT_URL is not set.');
  process.exit(1);
}

const journalPath = path.resolve('drizzle/meta/_journal.json');
const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
const entries = [...journal.entries].sort((a, b) => a.when - b.when);

function writeSummary(md) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) appendFileSync(summaryPath, md);
  process.stdout.write(md);
}

function setOutput(name, value) {
  const outPath = process.env.GITHUB_OUTPUT;
  if (outPath) appendFileSync(outPath, `${name}=${value}\n`);
}

const client = new pg.Client({ connectionString: directUrl });
await client.connect();

let ledgerRows = [];
try {
  const res = await client.query(
    'select id, hash, created_at from drizzle.__drizzle_migrations order by created_at asc'
  );
  ledgerRows = res.rows;
} catch (err) {
  // 42P01 = undefined_table — ledger doesn't exist yet (database never migrated).
  if (err.code !== '42P01') throw err;
  ledgerRows = [];
}

await client.end();

const maxApplied =
  ledgerRows.length > 0 ? Math.max(...ledgerRows.map((r) => Number(r.created_at))) : 0;

const pending = entries.filter((e) => e.when > maxApplied);

if (mode === 'pending') {
  let md = '\n### Pending migrations\n\n';
  if (pending.length === 0) {
    md += '_None — the target database is already up to date with `apps/api/drizzle/`._\n';
  } else {
    md += `${pending.length} migration(s) pending (ledger currently has ${ledgerRows.length} applied row(s)):\n\n`;
    md += '| # | Migration |\n| - | --- |\n';
    pending.forEach((e, i) => {
      md += `| ${i + 1} | \`${e.tag}\` |\n`;
    });
  }
  writeSummary(md);
  setOutput('pending_count', String(pending.length));
} else {
  let md = '\n### Ledger state (`drizzle.__drizzle_migrations`)\n\n';
  if (ledgerRows.length === 0) {
    md += '_No rows — no migrations have ever been applied to this database._\n';
  } else {
    md += `${ledgerRows.length} row(s) applied:\n\n`;
    md += '| id | migration | created_at (folder timestamp) |\n| - | --- | --- |\n';
    for (const row of ledgerRows) {
      const match = entries.find((e) => e.when === Number(row.created_at));
      const name = match ? match.tag : '(unrecognized — no matching journal entry)';
      md += `| ${row.id} | \`${name}\` | ${row.created_at} |\n`;
    }
  }
  writeSummary(md);
}
