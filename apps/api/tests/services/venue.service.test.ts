import { describe, it, expect, beforeEach } from 'vitest';
import { VenueService } from '../../src/services/venue.service.js';
import { InMemoryVenueRepository } from '../../src/repositories/venue.repository.js';

describe('VenueService', () => {
  let service: VenueService;

  beforeEach(() => {
    service = new VenueService(new InMemoryVenueRepository());
  });

  describe('listVenues', () => {
    it('returns all seed venues with default pagination', async () => {
      const result = await service.listVenues({}, 1, 20);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.total).toBeGreaterThan(0);
    });

    it('filters by city', async () => {
      const result = await service.listVenues({ city: 'Austin' }, 1, 20);
      result.data.forEach((v) => expect(v.city).toContain('Austin'));
    });

    it('filters by text query', async () => {
      const result = await service.listVenues({ q: 'Rainey' }, 1, 20);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0].name).toContain('Rainey');
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
      const venues = await service.getTrendingVenues('Austin', 10);
      for (let i = 1; i < venues.length; i++) {
        expect(venues[i - 1].hotspotScore).toBeGreaterThanOrEqual(venues[i].hotspotScore);
      }
    });

    it('respects limit', async () => {
      const venues = await service.getTrendingVenues('Austin', 1);
      expect(venues.length).toBeLessThanOrEqual(1);
    });
  });
});
