import type { City } from '@/api/cities';

// Mock city seed data for the two launch cities. Used by useCities() as bundled
// fallback until a live cities source exists. `displayName` is the key the
// venue hooks and VenueContext use to resolve a city's venues.
export const mockCities: City[] = [
  {
    id: 'charlotte-nc',
    slug: 'charlotte',
    name: 'Charlotte',
    state: 'NC',
    centerLat: 35.2271,
    centerLng: -80.8431,
    displayName: 'Charlotte, NC',
  },
  {
    id: 'patchogue-ny',
    slug: 'patchogue',
    name: 'Patchogue',
    state: 'NY',
    centerLat: 40.7659,
    centerLng: -73.0151,
    displayName: 'Patchogue, NY',
  },
];
