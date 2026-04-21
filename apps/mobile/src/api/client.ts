declare const process: { env: Record<string, string | undefined> };

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

let _authToken: string | null = null;

export function setAuthToken(token: string | null) {
  _authToken = token;
}

export async function apiClient<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };
  if (_authToken) {
    headers['Authorization'] = `Bearer ${_authToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

export async function getVenues(params?: {
  city?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  q?: string;
  filters?: string[];
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.city) qs.set('city', params.city);
  if (params?.lat != null) qs.set('lat', String(params.lat));
  if (params?.lng != null) qs.set('lng', String(params.lng));
  if (params?.radius != null) qs.set('radius', String(params.radius));
  if (params?.q) qs.set('q', params.q);
  if (params?.filters?.length) qs.set('filters', params.filters.join(','));
  if (params?.page != null) qs.set('page', String(params.page));
  if (params?.limit != null) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return apiClient<{ data: unknown[]; pagination: unknown }>(`/venues${query ? `?${query}` : ''}`);
}

export async function castVote(venueId: string) {
  return apiClient<unknown>('/votes', {
    method: 'POST',
    body: JSON.stringify({ venueId }),
  });
}
