import { describe, it, expect } from 'vitest';

import { filterVenues } from '@/lib/filterVenues';
import { defaultFilters } from '@/data/filters';
import { mockVenues, mockVenuesByCity } from '@/data/venues';

const charlotte = mockVenuesByCity['Charlotte, NC'];

describe('filterVenues', () => {
  it('returns all venues when no filters are active', () => {
    expect(filterVenues(charlotte, [])).toEqual(charlotte);
    expect(filterVenues(mockVenues, [])).toEqual(mockVenues);
  });

  it('narrows to a strict, non-empty subset for a single filter', () => {
    const result = filterVenues(charlotte, ['trending']);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThan(charlotte.length);
    expect(result.every((venue) => venue.isTrending)).toBe(true);
    expect(result.map((venue) => venue.id)).toEqual(['clt-1', 'clt-2', 'clt-6']);
  });

  it('ANDs multiple filters together (intersection of single-filter results)', () => {
    const trending = filterVenues(charlotte, ['trending']);
    const cocktails = filterVenues(charlotte, ['craft-cocktails']);
    const both = filterVenues(charlotte, ['trending', 'craft-cocktails']);

    expect(both.length).toBeGreaterThan(0);
    for (const venue of both) {
      expect(trending).toContainEqual(venue);
      expect(cocktails).toContainEqual(venue);
      expect(venue.isTrending).toBe(true);
      expect(venue.highlights).toContain('Craft Cocktails');
    }
    expect(both.map((venue) => venue.id)).toEqual(['clt-1', 'clt-2']);
  });

  it('treats unknown filter ids as matching all venues without throwing', () => {
    expect(() => filterVenues(charlotte, ['not-a-real-filter'])).not.toThrow();
    expect(filterVenues(charlotte, ['not-a-real-filter'])).toEqual(charlotte);
    // Unknown ids are inert when combined with known ones.
    expect(filterVenues(charlotte, ['trending', 'not-a-real-filter'])).toEqual(
      filterVenues(charlotte, ['trending'])
    );
  });

  it('every default filter matches at least one mock venue', () => {
    for (const filter of defaultFilters) {
      const result = filterVenues(mockVenues, [filter.id]);
      expect(result.length, `filter "${filter.id}" matches no mock venues`).toBeGreaterThan(0);
    }
  });

  it('every default filter narrows at least one city', () => {
    for (const filter of defaultFilters) {
      const narrowsSomeCity = Object.values(mockVenuesByCity).some((venues) => {
        const result = filterVenues(venues, [filter.id]);
        return result.length > 0 && result.length < venues.length;
      });
      expect(narrowsSomeCity, `filter "${filter.id}" never narrows any city`).toBe(true);
    }
  });
});
