export interface Venue {
  id: string;
  name: string;
  primaryType: string;
  address: string;
  distance: string;
  hotspotScore: number;
  voteCount: number;
  isOpen: boolean;
  isTrending: boolean;
  highlights: string[];
  latitude: number;
  longitude: number;
  imageUrl?: string;
  priceLevel: number | null; // 0-4 (null when unknown)
  /** Google `weekdayDescriptions`, one day per line. See mobile src/lib/venueHours.ts. */
  hours: string;
  description: string;
  /** Contact details, when the venue's Places record had them. */
  phone?: string | null;
  website?: string | null;
}

export interface FilterOption {
  id: string;
  label: string;
  icon?: string;
  enabled: boolean;
}

export interface VoteState {
  remainingVotes: number;
  maxVotes: number;
  votedVenueIds: string[];
  resetAt?: string; // ISO 8601 datetime; present on real API responses, omitted in mock mode
}
