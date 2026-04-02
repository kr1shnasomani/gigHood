// Location ping service for web-based Proof-of-Presence tracking
// Uses browser Geolocation API instead of native mobile APIs

export interface LocationPing {
  latitude: number;
  longitude: number;
  accuracy_radius: number;
  network_signal_strength: number;
  mock_location_flag: boolean;
  hex_id: string;
}

export interface GeolocationOptions {
  enableHighAccuracy: boolean;
  timeout: number;
  maximumAge: number;
}

// Check if geolocation is available
export function isGeolocationSupported(): boolean {
  return 'geolocation' in navigator;
}

// Get current position with mock location detection
export async function getCurrentPosition(): Promise<GeolocationPosition> {
  if (!isGeolocationSupported()) {
    throw new Error('Geolocation is not supported by this browser');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

// Detect if mock location might be enabled (web limitation - best effort)
// In web, we can check for VPN indicators and other patterns
export function detectMockLocation(): boolean {
  // Web browsers cannot definitively detect mock location
  // This is a known limitation of web-based approach
  // For production, this would need native app support
  
  // Return false as we cannot reliably detect mock location on web
  // In real implementation, this would require native app APIs
  return false;
}

// Estimate network signal strength (web limitation)
// Browser APIs don't provide direct network signal access
export function getNetworkSignalStrength(): number {
  // Web browsers don't expose network signal strength
  // Return a default value - this would need native app for real data
  // Using connection API as a proxy indicator
  type NavigatorWithConnection = Navigator & {
    connection?: { effectiveType?: string };
    mozConnection?: { effectiveType?: string };
    webkitConnection?: { effectiveType?: string };
  };

  const nav = navigator as NavigatorWithConnection;
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
  
  if (connection) {
    // Map effective type to signal strength (1-5 scale)
    const effectiveType = connection.effectiveType;
    switch (effectiveType) {
      case 'slow-2g': return 1;
      case '2g': return 2;
      case '3g': return 3;
      case '4g': return 4;
      default: return 3;
    }
  }
  
  return 3; // Default moderate signal
}

// Convert coordinates to H3 hex ID
export async function coordinatesToHexId(lat: number, lng: number): Promise<string> {
  // This would call the backend to convert coordinates to H3 hex
  // For now, we'll make an API call
  const api = (await import('./api')).default;
  try {
    const response = await api.post('/workers/me/location/hex', { latitude: lat, longitude: lng });
    return response.data.hex_id;
  } catch {
    // Fallback: generate a mock hex ID based on coordinates
    // This is for demo purposes - real implementation needs H3 library
    const latHex = Math.floor(lat * 1000000).toString(16);
    const lngHex = Math.floor(lng * 1000000).toString(16);
    return `${latHex}${lngHex}`.substring(0, 15);
  }
}

// Create a location ping payload
export async function createLocationPing(): Promise<LocationPing> {
  const position = await getCurrentPosition();
  const { latitude, longitude, accuracy } = position.coords;
  
  const hex_id = await coordinatesToHexId(latitude, longitude);
  
  return {
    latitude,
    longitude,
    accuracy_radius: accuracy,
    network_signal_strength: getNetworkSignalStrength(),
    mock_location_flag: detectMockLocation(),
    hex_id
  };
}

// Submit location ping to backend
export async function submitLocationPing(): Promise<void> {
  const ping = await createLocationPing();
  const api = (await import('./api')).default;
  
  try {
    await api.post('/location-pings', ping);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('invalid api key')) {
      console.warn('Location ping disabled: backend Supabase key is invalid. Update backend/.env keys.');
      return;
    }
    throw error;
  }
}

// Start continuous location tracking
let locationTrackingInterval: NodeJS.Timeout | null = null;

export function startLocationTracking(intervalMs: number = 15 * 60 * 1000): void {
  if (locationTrackingInterval) {
    console.log('Location tracking already active');
    return;
  }

  // Submit initial ping
  submitLocationPing().catch(console.error);

  // Set up recurring pings
  locationTrackingInterval = setInterval(() => {
    submitLocationPing().catch(console.error);
  }, intervalMs);

  console.log(`Location tracking started: every ${intervalMs / 1000 / 60} minutes`);
}

export function stopLocationTracking(): void {
  if (locationTrackingInterval) {
    clearInterval(locationTrackingInterval);
    locationTrackingInterval = null;
    console.log('Location tracking stopped');
  }
}

// Check if location permissions are granted
export async function checkLocationPermission(): Promise<PermissionState> {
  if (!('permissions' in navigator)) {
    return 'prompt'; // Assume prompt if API not available
  }

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state;
  } catch {
    return 'prompt';
  }
}

// Request location permission
export async function requestLocationPermission(): Promise<boolean> {
  const permission = await checkLocationPermission();
  
  if (permission === 'granted') {
    return true;
  }

  if (permission === 'prompt') {
    try {
      await getCurrentPosition();
      return true;
    } catch {
      return false;
    }
  }

  return false; // denied
}
