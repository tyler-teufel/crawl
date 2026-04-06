export interface Venue {
  id: string;
  name: string;
  type: string;
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
  priceLevel: number; // 1-4
  hours: string;
  description: string;
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
}
