// Utility functions for GPS Satellite Coordinates, Haversine Distance, and Geofencing

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface SchoolGeofenceConfig {
  schoolId: string;
  schoolName: string;
  schoolAddress: string;
  centerCoordinates: Coordinates;
  radiusMeters: number; // e.g., 350 meters
  entryStartTime: string; // "06:30"
  entryLateTime: string;  // "08:00"
  exitStartTime: string;  // "15:30"
  gates: {
    id: string;
    name: string;
    coordinates: Coordinates;
    radiusMeters: number;
  }[];
}

// Default Configuration: Uttaradit School Campus
export const DEFAULT_SCHOOL_GEOFENCE: SchoolGeofenceConfig = {
  schoolId: 'UTD-001',
  schoolName: 'โรงเรียนอุตรดิตถ์ (Uttaradit School)',
  schoolAddress: 'ถนนประชานิมิตร ตำบลท่าอิฐ อำเภอเมืองอุตรดิตถ์ จังหวัดอุตรดิตถ์ 53000',
  centerCoordinates: {
    latitude: 17.625345,
    longitude: 100.093412,
  },
  radiusMeters: 350,
  entryStartTime: '06:30',
  entryLateTime: '08:00',
  exitStartTime: '15:30',
  gates: [
    {
      id: 'gate-1',
      name: 'ประตู 1 (หน้าโรงเรียน - ถนนประชานิมิตร)',
      coordinates: { latitude: 17.625620, longitude: 100.093200 },
      radiusMeters: 120,
    },
    {
      id: 'gate-2',
      name: 'ประตู 2 (ด้านข้าง - หอประชุมใหญ่)',
      coordinates: { latitude: 17.624950, longitude: 100.093850 },
      radiusMeters: 100,
    },
    {
      id: 'gate-3',
      name: 'ประตู 3 (สนามกีฬาและอาคารพลศึกษา)',
      coordinates: { latitude: 17.625800, longitude: 100.094100 },
      radiusMeters: 150,
    }
  ]
};

/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the Haversine formula (in meters).
 */
export function calculateHaversineDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 6371e3; // Earth's mean radius in meters
  const lat1Rad = (coord1.latitude * Math.PI) / 180;
  const lat2Rad = (coord2.latitude * Math.PI) / 180;
  const deltaLatRad = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const deltaLonRad = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLonRad / 2) *
      Math.sin(deltaLonRad / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c); // Distance in meters
}

/**
 * Checks whether user coordinates fall within the school's configured geofence radius.
 */
export function isWithinSchoolGeofence(
  userCoord: Coordinates,
  schoolConfig: SchoolGeofenceConfig = DEFAULT_SCHOOL_GEOFENCE
): {
  isInside: boolean;
  distanceMeters: number;
  nearestGateName?: string;
  gateDistanceMeters?: number;
} {
  const distanceToCenter = calculateHaversineDistance(userCoord, schoolConfig.centerCoordinates);
  
  // Check center boundary
  let isInside = distanceToCenter <= schoolConfig.radiusMeters;
  
  // Check gate boundaries
  let nearestGate = schoolConfig.gates[0];
  let minGateDistance = Infinity;

  for (const gate of schoolConfig.gates) {
    const dist = calculateHaversineDistance(userCoord, gate.coordinates);
    if (dist < minGateDistance) {
      minGateDistance = dist;
      nearestGate = gate;
    }
    if (dist <= gate.radiusMeters) {
      isInside = true;
    }
  }

  return {
    isInside,
    distanceMeters: distanceToCenter,
    nearestGateName: nearestGate?.name,
    gateDistanceMeters: minGateDistance !== Infinity ? minGateDistance : undefined,
  };
}

/**
 * Formats distance in meters into human-readable Thai text (e.g., "45 เมตร" or "1.2 กม.")
 */
export function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${distanceMeters} เมตร`;
  }
  return `${(distanceMeters / 1000).toFixed(2)} กม.`;
}

/**
 * Calculates initial compass bearing from point A to point B in degrees (0 - 360)
 */
export function calculateBearing(start: Coordinates, dest: Coordinates): number {
  const startLat = (start.latitude * Math.PI) / 180;
  const startLng = (start.longitude * Math.PI) / 180;
  const destLat = (dest.latitude * Math.PI) / 180;
  const destLng = (dest.longitude * Math.PI) / 180;

  const y = Math.sin(destLng - startLng) * Math.cos(destLat);
  const x =
    Math.cos(startLat) * Math.sin(destLat) -
    Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);

  let brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Returns Thai cardinal direction name from degrees
 */
export function getThaiDirection(degrees: number): string {
  const directions = [
    { name: 'ทิศเหนือ (N)', min: 337.5, max: 360 },
    { name: 'ทิศเหนือ (N)', min: 0, max: 22.5 },
    { name: 'ทิศตะวันออกเฉียงเหนือ (NE)', min: 22.5, max: 67.5 },
    { name: 'ทิศตะวันออก (E)', min: 67.5, max: 112.5 },
    { name: 'ทิศตะวันออกเฉียงใต้ (SE)', min: 112.5, max: 157.5 },
    { name: 'ทิศใต้ (S)', min: 157.5, max: 202.5 },
    { name: 'ทิศตะวันตกเฉียงใต้ (SW)', min: 202.5, max: 247.5 },
    { name: 'ทิศตะวันตก (W)', min: 247.5, max: 292.5 },
    { name: 'ทิศตะวันตกเฉียงเหนือ (NW)', min: 292.5, max: 337.5 },
  ];

  for (const dir of directions) {
    if (degrees >= dir.min && degrees < dir.max) {
      return dir.name;
    }
  }
  return 'ทิศเหนือ (N)';
}
