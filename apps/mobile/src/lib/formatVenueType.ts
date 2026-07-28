// Google Places returns `primaryType` as a raw snake_case token — 'night_club',
// 'lounge_bar', 'tex_mex_restaurant'. Those reach the UI verbatim on the
// Supabase-direct path and read like database column names on venue cards and
// the detail screen. This formats them for display at the data boundary
// (`rowToVenue`), so every render site gets the same string.

/** Words that stay lowercase unless they lead the phrase. */
const MINOR_WORDS = new Set(['and', 'or', 'of', 'the', 'in', 'on', 'at']);

/**
 * Tokens whose word-by-word title case reads wrong. Keyed on the raw Google
 * type. Add sparingly — the general rule covers almost everything.
 */
const OVERRIDES: Record<string, string> = {
  tex_mex_restaurant: 'Tex-Mex Restaurant',
  bbq_restaurant: 'BBQ Restaurant',
  atm: 'ATM',
};

/**
 * 'night_club' → 'Night Club', 'bar_and_grill' → 'Bar and Grill'.
 *
 * Strings that are already human-formatted pass through untouched: bundled
 * mock venues carry values like 'Rooftop Bar' and 'BBQ & Bar', and
 * lowercase-then-title-case would corrupt the acronym in the second one.
 */
export function formatVenueType(type: string): string {
  const raw = type.trim();
  if (!raw) return raw;

  // Only reformat raw Places tokens: lowercase letters, digits, underscores.
  // Anything with spaces, capitals, or punctuation is already display-ready.
  if (!/^[a-z0-9_]+$/.test(raw)) return raw;

  const override = OVERRIDES[raw];
  if (override) return override;

  return raw
    .split('_')
    .filter(Boolean)
    .map((word, i) =>
      i > 0 && MINOR_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ');
}
