import { FilterOption } from '@/types/venue';

export const defaultFilters: FilterOption[] = [
  { id: 'trending', label: 'Trending', icon: 'flame', enabled: false },
  { id: 'open-now', label: 'Open Now', icon: 'time', enabled: false },
  { id: 'live-music', label: 'Live Music', icon: 'musical-notes', enabled: false },
  { id: 'happy-hour', label: 'Happy Hour', icon: 'beer', enabled: false },
  { id: 'rooftop', label: 'Rooftop', icon: 'sunny', enabled: false },
  { id: 'craft-cocktails', label: 'Craft Cocktails', icon: 'wine', enabled: false },
  { id: 'dive-bar', label: 'Dive Bar', icon: 'skull', enabled: false },
  { id: 'sports', label: 'Sports Bar', icon: 'football', enabled: false },
  { id: 'dancing', label: 'Dancing', icon: 'disc', enabled: false },
  { id: 'outdoor', label: 'Outdoor Patio', icon: 'leaf', enabled: false },
];
