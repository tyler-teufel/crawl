import { describe, it, expect, beforeEach } from 'vitest';
import { VenueService } from '../../src/services/venue.service.js';
import { InMemoryVenueRepository } from '../../src/repositories/venue.repository.js';

describe('VenueService', () => {
  let service: VenueService;
  let venueRepo: InMemoryVenueRepository;

  beforeEach(() => {
    venueRepo = new InMemoryVenueRepository();
    service = new VenueService(venueRepo);
  });

  describe('listVenues', () => {
    it('returns all seed venues with default pagination', async () => {
      const result = await service.listVenues({}, 1, 20);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.total).toBeGreaterThan(0);
    });

    it('filters by city', async () => {
      const result = await service.listVenues({ city: 'Charlotte' }, 1, 20);
      expect(result.data.length).toBeGreaterThan(0);
      result.data.forEach((v) => expect(v.city).toContain('Charlotte'));
    });

    it('filters by text query', async () => {
      const result = await service.listVenues({ q: 'Brickhouse' }, 1, 20);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0].name).toContain('Brickhouse');
    });

    it('paginates results', async () => {
      const page1 = await service.listVenues({}, 1, 1);
      const page2 = await service.listVenues({}, 2, 1);
      expect(page1.data[0].id).not.toBe(page2.data[0]?.id ?? null);
    });

    it('returns correct totalPages', async () => {
      const result = await service.listVenues({}, 1, 1);
      expect(result.pagination.totalPages).toBe(result.pagination.total);
    });
  });

  describe('getVenue', () => {
    it('returns venue by id', async () => {
      const venue = await service.getVenue('11111111-1111-1111-1111-111111111111');
      expect(venue).not.toBeNull();
      expect(venue?.id).toBe('11111111-1111-1111-1111-111111111111');
    });

    it('returns null for unknown id', async () => {
      const venue = await service.getVenue('00000000-0000-0000-0000-000000000000');
      expect(venue).toBeNull();
    });
  });

  describe('getTrendingVenues', () => {
    it('returns venues sorted by hotspot score', async () => {
      const venues = await service.getTrendingVenues('Charlotte', 10);
      for (let i = 1; i < venues.length; i++) {
        expect(venues[i - 1].hotspotScore).toBeGreaterThanOrEqual(venues[i].hotspotScore);
      }
    });

    it('respects limit', async () => {
      const venues = await service.getTrendingVenues('Charlotte', 1);
      expect(venues.length).toBeLessThanOrEqual(1);
    });
  });

  describe('resetDailyMetrics', () => {
    it('resets voteCount, hotspotScore, and isTrending to zero on all venues', async () => {
      // Seed venue '11111111-...' starts with voteCount:134, hotspotScore:85, isTrending:true
      await service.resetDailyMetrics();
      const venue = await venueRepo.findById('11111111-1111-1111-1111-111111111111');
      expect(venue!.voteCount).toBe(0);
      expect(venue!.hotspotScore).toBe(0);
      expect(venue!.isTrending).toBe(false);
    });

    it('resets all seeded venues, not just the first', async () => {
      await service.resetDailyMetrics();
      const venues = await service.listVenues({}, 1, 100);
      for (const v of venues.data) {
        expect(v.voteCount).toBe(0);
        expect(v.hotspotScore).toBe(0);
        expect(v.isTrending).toBe(false);
      }
    });
  });

  describe('recalculateHotspotScores', () => {
    it('resolves without throwing (placeholder no-op)', async () => {
      await expect(service.recalculateHotspotScores()).resolves.toBeUndefined();
    });
  });
});
