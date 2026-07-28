// Pure map-camera math, kept separate from CrawlMapView so it's testable
// without a react-native-maps rendering harness (#166).

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface RegionCity {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
}

const METERS_PER_DEGREE_LATITUDE = 111_320;
// Frames the city's coverage circle with margin so pins near the edge
// (radius_meters) aren't clipped against the viewport bounds.
const PADDING_FACTOR = 1.4;
// Floor so bad/missing radius data (0 or negative) can't zoom the camera in
// to a single point.
const MIN_RADIUS_METERS = 100;

/**
 * Computes the map region that frames a city's coverage circle, centered on
 * the city itself rather than an arbitrary venue.
 *
 * `latitudeDelta` is derived directly from `radiusMeters` (111,320 m per
 * degree of latitude everywhere on Earth). `longitudeDelta` widens by
 * `1 / cos(latitude)` because a degree of longitude covers fewer meters the
 * further a city sits from the equator — without that correction, cities at
 * different latitudes with the same radius would render non-circular.
 */
export function getRegionForCity(city: RegionCity): Region {
  const radiusMeters = Math.max(city.radiusMeters, MIN_RADIUS_METERS);
  const latitudeDelta = (2 * radiusMeters * PADDING_FACTOR) / METERS_PER_DEGREE_LATITUDE;
  const latitudeRadians = (city.centerLat * Math.PI) / 180;
  const longitudeDelta = latitudeDelta / Math.cos(latitudeRadians);

  return {
    latitude: city.centerLat,
    longitude: city.centerLng,
    latitudeDelta,
    longitudeDelta,
  };
}
