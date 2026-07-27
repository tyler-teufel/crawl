import { describe, it, expect } from 'vitest';
import { formatVenueType } from '@/lib/formatVenueType';

// Google Places primaryType tokens reached the UI verbatim on the
// Supabase-direct path ('lounge_bar' on a venue card). The fixtures below are
// the actual distinct primary_type values in the live database.

describe('formatVenueType', () => {
  it('title-cases raw snake_case Places tokens', () => {
    expect(formatVenueType('night_club')).toBe('Night Club');
    expect(formatVenueType('lounge_bar')).toBe('Lounge Bar');
    expect(formatVenueType('wine_bar')).toBe('Wine Bar');
    expect(formatVenueType('sports_bar')).toBe('Sports Bar');
    expect(formatVenueType('irish_pub')).toBe('Irish Pub');
    expect(formatVenueType('live_music_venue')).toBe('Live Music Venue');
    expect(formatVenueType('asian_fusion_restaurant')).toBe('Asian Fusion Restaurant');
    expect(formatVenueType('sports_activity_location')).toBe('Sports Activity Location');
  });

  it('capitalizes a single-word token', () => {
    expect(formatVenueType('bar')).toBe('Bar');
    expect(formatVenueType('pub')).toBe('Pub');
    expect(formatVenueType('brewery')).toBe('Brewery');
  });

  it('keeps connector words lowercase unless they lead', () => {
    expect(formatVenueType('bar_and_grill')).toBe('Bar and Grill');
    expect(formatVenueType('and_bar')).toBe('And Bar');
  });

  it('applies overrides where title case reads wrong', () => {
    expect(formatVenueType('tex_mex_restaurant')).toBe('Tex-Mex Restaurant');
  });

  it('leaves already-formatted strings untouched', () => {
    // Bundled mock venues carry display-ready values. Lowercasing then
    // title-casing would turn 'BBQ & Bar' into 'Bbq & Bar'.
    expect(formatVenueType('Rooftop Bar')).toBe('Rooftop Bar');
    expect(formatVenueType('BBQ & Bar')).toBe('BBQ & Bar');
    expect(formatVenueType('Speakeasy')).toBe('Speakeasy');
  });

  it('handles empty and whitespace input without throwing', () => {
    expect(formatVenueType('')).toBe('');
    expect(formatVenueType('   ')).toBe('');
  });

  it('does not leave stray separators for malformed tokens', () => {
    expect(formatVenueType('bar__grill')).toBe('Bar Grill');
    expect(formatVenueType('_bar')).toBe('Bar');
  });
});
