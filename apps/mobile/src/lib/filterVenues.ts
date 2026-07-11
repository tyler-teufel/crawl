import { Venue } from '@/types/venue';
import { defaultFilters } from '@/data/filters';

const hasHighlight = (venue: Venue, highlight: string) => venue.highlights.includes(highlight);

// Maps filter ids from src/data/filters.ts to Venue predicates. Keyed on the
// literal id union so a renamed/added filter without a predicate fails
// typecheck. Ids missing at runtime (server-driven) match every venue via the
// fallback in filterVenues rather than crashing.
const filterPredicates: Record<(typeof defaultFilters)[number]['id'], (venue: Venue) => boolean> = {
  trending: (venue) => venue.isTrending,
  'open-now': (venue) => venue.isOpen,
  'live-music': (venue) => hasHighlight(venue, 'Live Music'),
  'happy-hour': (venue) => hasHighlight(venue, 'Happy Hour'),
  rooftop: (venue) => hasHighlight(venue, 'Rooftop'),
  'craft-cocktails': (venue) => hasHighlight(venue, 'Craft Cocktails'),
  'dive-bar': (venue) => hasHighlight(venue, 'Dive Bar'),
  sports: (venue) => hasHighlight(venue, 'Sports'),
  dancing: (venue) => hasHighlight(venue, 'Dancing'),
  outdoor: (venue) => hasHighlight(venue, 'Outdoor Patio'),
};

/** AND-combines active filters: a venue must satisfy every active filter id. */
export function filterVenues(venues: Venue[], activeFilterIds: string[]): Venue[] {
  if (activeFilterIds.length === 0) return venues;
  // Widen to a string key for lookup so server-driven ids outside the static
  // set fall through to `?? true` instead of failing to index the literal map.
  const predicates: Record<string, (venue: Venue) => boolean> = filterPredicates;
  return venues.filter((venue) => activeFilterIds.every((id) => predicates[id]?.(venue) ?? true));
}
