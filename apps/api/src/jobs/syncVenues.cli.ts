#!/usr/bin/env node
/**
 * CLI entry for the venue sync job.
 *
 * Usage:
 *   npx dotenv -e .env -- tsx src/jobs/syncVenues.cli.ts \
 *     --city "Charlotte" --state "NC" [--radius 12000] [--max-per-type 20]
 */
import { syncCity } from './syncVenues.js';

interface Args {
  city: string;
  state: string;
  radius?: number;
  maxPerType?: number;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };

  const city = get('--city');
  const state = get('--state');
  if (!city || !state) {
    throw new Error('Usage: --city <name> --state <code> [--radius <m>] [--max-per-type <n>]');
  }

  const radiusRaw = get('--radius');
  const maxRaw = get('--max-per-type');

  return {
    city,
    state,
    radius: radiusRaw ? Number(radiusRaw) : undefined,
    maxPerType: maxRaw ? Number(maxRaw) : undefined,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

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
    console.error(`\n${result.errors.length} errors — see above.`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
