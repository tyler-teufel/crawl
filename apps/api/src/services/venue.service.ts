import type { VenueRepository, VenueFilters } from '../repositories/venue.repository.js';
import type { Venue, VenueListResponse } from '../schemas/venue.schema.js';

export class VenueService {
  constructor(private readonly repo: VenueRepository) {}

  async listVenues(
    filters: VenueFilters,
    page: number,
    limit: number,
  ): Promise<VenueListResponse> {
    const { data, total } = await this.repo.findMany(filters, page, limit);
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getVenue(id: string): Promise<Venue | null> {
    return this.repo.findById(id);
  }

  async getTrendingVenues(city: string, limit: number): Promise<Venue[]> {
    return this.repo.findTrendingByCity(city, limit);
  }

  async recalculateHotspotScores(): Promise<void> {
    // Placeholder algorithm: score = min(100, voteCount * 2)
    // In Phase 2, this will use velocity, recency, and historical data from the DB.
    // Called by the hourly cron job.
  }

  async resetDailyMetrics(): Promise<void> {
    await this.repo.resetDailyMetrics();
  }
}
