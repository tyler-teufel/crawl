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
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: "Rainey Street Brewing Co.",
    type: 'Bar',
    address: '119 Rainey St',
    city: 'Austin, TX',
    latitude: 30.2564,
    longitude: -97.7352,
    hotspotScore: 87,
    voteCount: 142,
    isOpen: true,
    isTrending: true,
    highlights: ['Craft Beer', 'Live Music', 'Patio'],
    priceLevel: 2,
    hours: '4pm - 2am',
    description: 'A lively craft brewery anchoring the Rainey Street entertainment district.',
    imageUrl: undefined,
    distance: '0.3 mi',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'The Dogwood',
    type: 'Bar',
    address: '715 W 6th St',
    city: 'Austin, TX',
    latitude: 30.2724,
    longitude: -97.7501,
    hotspotScore: 74,
    voteCount: 98,
    isOpen: true,
    isTrending: false,
    highlights: ['Cocktails', 'Happy Hour', 'Rooftop'],
    priceLevel: 3,
    hours: '3pm - 2am',
    description: 'Multi-level bar with a rooftop patio on the West 6th corridor.',
    imageUrl: undefined,
    distance: '0.7 mi',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Stubb\'s Outdoor Amphitheatre',
    type: 'Music Venue',
    address: '801 Red River St',
    city: 'Austin, TX',
    latitude: 30.2672,
    longitude: -97.7361,
    hotspotScore: 91,
    voteCount: 203,
    isOpen: false,
    isTrending: true,
    highlights: ['Live Music', 'BBQ', 'Outdoor'],
    priceLevel: 2,
    hours: 'Event nights only',
    description: 'Legendary outdoor music venue and BBQ restaurant on Red River.',
    imageUrl: undefined,
    distance: '0.5 mi',
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
          v.type.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q),
      );
    }
    if (filters.types && filters.types.length > 0) {
      results = results.filter((v) =>
        filters.types!.some((t) => v.type.toLowerCase() === t.toLowerCase()),
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
