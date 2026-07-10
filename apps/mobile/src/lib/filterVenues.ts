import { Venue } from '@/types/venue';

const hasHighlight = (venue: Venue, highlight: string) => venue.highlights.includes(highlight);

// Maps filter ids from src/data/filters.ts to Venue predicates. Ids missing
// from this map (unknown filters) match every venue rather than crashing.
const filterPredicates: Record<string, (venue: Venue) => boolean> = {
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
  return venues.filter((venue) =>
    activeFilterIds.every((id) => filterPredicates[id]?.(venue) ?? true)
  );
}
