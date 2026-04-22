import type { Venue } from '../schemas/venue.schema.js';

export interface VenueFilters {
  city?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  q?: string;
  types?: string[];
}

export interface VenueRepository {
  findMany(filters: VenueFilters, page: number, limit: number): Promise<{ data: Venue[]; total: number }>;
  findById(id: string): Promise<Venue | null>;
  findTrendingByCity(city: string, limit: number): Promise<Venue[]>;
  incrementVoteCount(id: string): Promise<void>;
  decrementVoteCount(id: string): Promise<void>;
  updateHotspotScore(id: string, score: number): Promise<void>;
  resetDailyMetrics(): Promise<void>;
}

const now = () => new Date().toISOString();

const SEED_VENUES: Venue[] = [
  // Charlotte, NC
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Whiskey Warehouse',
    primaryType: 'Bar',
    address: '1515 S Tryon St',
    city: 'Charlotte, NC',
    latitude: 35.2094,
    longitude: -80.8571,
    hotspotScore: 85,
    voteCount: 134,
    isOpen: true,
    isTrending: true,
    highlights: ['Whiskey Selection', 'Live Music', 'Patio'],
    priceLevel: 2,
    hours: '4pm - 2am',
    description: 'A massive bar in South End with an enormous whiskey list and regular live acts.',
    imageUrl: undefined,
    distance: '0.4 mi',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Optimist Hall',
    primaryType: 'Food Hall',
    address: '1115 N Brevard St',
    city: 'Charlotte, NC',
    latitude: 35.2301,
    longitude: -80.8397,
    hotspotScore: 78,
    voteCount: 112,
    isOpen: true,
    isTrending: false,
    highlights: ['Craft Beer', 'Food Hall', 'Dog Friendly'],
    priceLevel: 2,
    hours: '11am - 12am',
    description: 'Converted mill food hall in NoDa with a rotating lineup of chefs and a full bar.',
    imageUrl: undefined,
    distance: '1.1 mi',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Bottle Cap Group - Rooftop',
    primaryType: 'Rooftop Bar',
    address: '201 E 5th St',
    city: 'Charlotte, NC',
    latitude: 35.2268,
    longitude: -80.8403,
    hotspotScore: 92,
    voteCount: 187,
    isOpen: true,
    isTrending: true,
    highlights: ['Rooftop', 'Skyline Views', 'Cocktails'],
    priceLevel: 3,
    hours: '5pm - 2am',
    description: 'Uptown rooftop bar with sweeping skyline views and craft cocktails.',
    imageUrl: undefined,
    distance: '0.2 mi',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Sycamore Brewing',
    primaryType: 'Brewery',
    address: '2161 Hawkins St',
    city: 'Charlotte, NC',
    latitude: 35.2073,
    longitude: -80.8604,
    hotspotScore: 71,
    voteCount: 89,
    isOpen: true,
    isTrending: false,
    highlights: ['Craft Beer', 'Trivia Nights', 'Patio'],
    priceLevel: 1,
    hours: '3pm - 11pm',
    description: 'South End neighborhood brewery known for small-batch IPAs and a chill patio.',
    imageUrl: undefined,
    distance: '0.6 mi',
    createdAt: now(),
    updatedAt: now(),
  },
  // Patchogue / Sayville, NY
  {
    id: '55555555-5555-5555-5555-555555555555',
    name: 'The Tap Room',
    primaryType: 'Bar',
    address: '4 West Main St',
    city: 'Patchogue, NY',
    latitude: 40.7657,
    longitude: -73.0155,
    hotspotScore: 83,
    voteCount: 119,
    isOpen: true,
    isTrending: true,
    highlights: ['Craft Beer', 'Happy Hour', 'Sports TV'],
    priceLevel: 2,
    hours: '12pm - 2am',
    description: 'A beloved Main Street craft beer bar in the heart of Patchogue\'s nightlife strip.',
    imageUrl: undefined,
    distance: '0.1 mi',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    name: 'Brickhouse Brewery',
    primaryType: 'Brewery',
    address: '67 West Main St',
    city: 'Patchogue, NY',
    latitude: 40.7653,
    longitude: -73.0187,
    hotspotScore: 76,
    voteCount: 101,
    isOpen: true,
    isTrending: false,
    highlights: ['Craft Beer', 'Live Music', 'Outdoor Seating'],
    priceLevel: 2,
    hours: '12pm - 11pm',
    description: 'Long Island\'s original brewpub, serving handcrafted beers in a historic brick building.',
    imageUrl: undefined,
    distance: '0.3 mi',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '77777777-7777-7777-7777-777777777777',
    name: 'The Oar Steak & Seafood',
    primaryType: 'Restaurant & Bar',
    address: '24 Foster Ave',
    city: 'Sayville, NY',
    latitude: 40.7393,
    longitude: -73.0844,
    hotspotScore: 68,
    voteCount: 77,
    isOpen: true,
    isTrending: false,
    highlights: ['Waterfront', 'Seafood', 'Cocktails'],
    priceLevel: 3,
    hours: '11:30am - 10pm',
    description: 'Waterfront restaurant and bar near the Sayville Ferry, known for fresh seafood and sunsets.',
    imageUrl: undefined,
    distance: '0.5 mi',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '88888888-8888-8888-8888-888888888888',
    name: 'The Drift',
    primaryType: 'Bar',
    address: '9 Main St',
    city: 'Sayville, NY',
    latitude: 40.7409,
    longitude: -73.0831,
    hotspotScore: 72,
    voteCount: 93,
    isOpen: false,
    isTrending: false,
    highlights: ['Cocktails', 'DJ Nights', 'Late Night'],
    priceLevel: 2,
    hours: '5pm - 2am',
    description: 'Sayville\'s go-to late-night bar with a rotating DJ lineup and strong cocktails.',
    imageUrl: undefined,
    distance: '0.2 mi',
    createdAt: now(),
    updatedAt: now(),
  },
];

export class InMemoryVenueRepository implements VenueRepository {
  private venues: Map<string, Venue> = new Map(SEED_VENUES.map((v) => [v.id, { ...v }]));

  async findMany(
    filters: VenueFilters,
    page: number,
    limit: number,
  ): Promise<{ data: Venue[]; total: number }> {
    let results = [...this.venues.values()];

    if (filters.city) {
      results = results.filter((v) =>
        v.city.toLowerCase().includes(filters.city!.toLowerCase()),
      );
    }
    if (filters.q) {
      const q = filters.q.toLowerCase();
      results = results.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.primaryType.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q),
      );
    }
    if (filters.types && filters.types.length > 0) {
      results = results.filter((v) =>
        filters.types!.some((t) => v.primaryType.toLowerCase() === t.toLowerCase()),
      );
    }

    const total = results.length;
    const start = (page - 1) * limit;
    return { data: results.slice(start, start + limit), total };
  }

  async findById(id: string): Promise<Venue | null> {
    const venue = this.venues.get(id);
    return venue ? { ...venue } : null;
  }

  async findTrendingByCity(city: string, limit: number): Promise<Venue[]> {
    return [...this.venues.values()]
      .filter((v) => v.city.toLowerCase().includes(city.toLowerCase()))
      .sort((a, b) => b.hotspotScore - a.hotspotScore)
      .slice(0, limit);
  }

  async incrementVoteCount(id: string): Promise<void> {
    const venue = this.venues.get(id);
    if (venue) {
      venue.voteCount += 1;
      venue.updatedAt = now();
    }
  }

  async decrementVoteCount(id: string): Promise<void> {
    const venue = this.venues.get(id);
    if (venue && venue.voteCount > 0) {
      venue.voteCount -= 1;
      venue.updatedAt = now();
    }
  }

  async updateHotspotScore(id: string, score: number): Promise<void> {
    const venue = this.venues.get(id);
    if (venue) {
      venue.hotspotScore = Math.min(100, Math.max(0, score));
      venue.isTrending = venue.hotspotScore >= 80;
      venue.updatedAt = now();
    }
  }

  async resetDailyMetrics(): Promise<void> {
    for (const venue of this.venues.values()) {
      venue.voteCount = 0;
      venue.hotspotScore = 0;
      venue.isTrending = false;
      venue.updatedAt = now();
    }
  }
}
