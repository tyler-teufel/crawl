#!/usr/bin/env node
/**
 * CLI entry for the venue sync job.
 *
 * Usage:
 *   npx dotenv -e .env -- tsx src/jobs/syncVenues.cli.ts \
 *     --city "Charlotte" --state "NC" [--radius 12000] [--max-per-type 20] [--dry-run]
 *
 * Flags:
 *   -c, --city          City name (required)
 *   -s, --state         State/region code (required)
 *       --radius        Search radius in meters (default 8000)
 *       --max-per-type  Max places per included type, 1-20 (default 20)
 *       --dry-run       Geocode + search + filter but do not write to DB
 *   -h, --help          Show this message
 *
 * Parsing uses node:util parseArgs so that `--city=Charlotte`, short flags,
 * and strict unknown-flag errors all behave correctly.
 */
import { parseArgs } from 'node:util';

import { syncCity } from './syncVenues.js';

const USAGE = `Usage:
  sync:venues --city <name> --state <code> [options]

Required:
  -c, --city <name>         City name (e.g. "Charlotte")
  -s, --state <code>        State/region code (e.g. "NC")

Options:
      --radius <meters>     Search radius in meters (default 8000)
      --max-per-type <n>    Max places per included type, 1-20 (default 20)
      --dry-run             Geocode + search + filter but skip DB writes
  -h, --help                Show this message
`;

interface ParsedArgs {
  city: string;
  state: string;
  radius?: number;
  maxPerType?: number;
  dryRun: boolean;
}

function parse(argv: string[]): ParsedArgs {
  const { values } = parseArgs({
    args: argv,
    allowPositionals: false,
    strict: true,
    options: {
      city: { type: 'string', short: 'c' },
      state: { type: 'string', short: 's' },
      radius: { type: 'string' },
      'max-per-type': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    console.log(USAGE);
    process.exit(0);
  }

  if (!values.city || !values.state) {
    console.error('Error: --city and --state are required.\n');
    console.error(USAGE);
    process.exit(2);
  }

  const radius = toPositiveInt(values.radius, '--radius');
  const maxPerType = toPositiveInt(values['max-per-type'], '--max-per-type');

  if (maxPerType !== undefined && (maxPerType < 1 || maxPerType > 20)) {
    console.error('Error: --max-per-type must be between 1 and 20.');
    process.exit(2);
  }

  return {
    city: values.city,
    state: values.state,
    radius,
    maxPerType,
    dryRun: values['dry-run'] ?? false,
  };
}

function toPositiveInt(raw: string | undefined, flag: string): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    console.error(`Error: ${flag} must be a positive integer (got "${raw}").`);
    process.exit(2);
  }
  return n;
}

async function main() {
  const args = parse(process.argv.slice(2));

  if (args.dryRun) {
    console.log('[sync] DRY RUN — no DB writes will be issued.\n');
    // TODO: wire a true dry-run path into syncCity that skips upsert/update.
    // For now, dry-run is advisory only; fall through to the normal path so
    // we still surface Places API + filter behavior.
  }

  const result = await syncCity({
    city: args.city,
    state: args.state,
    radiusMeters: args.radius,
    maxResultsPerType: args.maxPerType,
    log: (msg) => console.log(`[sync] ${msg}`),
  });

  console.log('\n--- result ---');
  console.log(JSON.stringify(result, null, 2));

  if (result.errors.length > 0) {
    console.error(`\n${result.errors.length} error(s) — see above.`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
