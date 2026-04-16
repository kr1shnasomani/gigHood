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

function readPosition(options: GeolocationOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function toGeolocationErrorMessage(error: GeolocationPositionError): string {
  const codeLabel =
    error.code === error.PERMISSION_DENIED
      ? 'permission denied'
      : error.code === error.POSITION_UNAVAILABLE
        ? 'position unavailable'
        : error.code === error.TIMEOUT
          ? 'location timeout'
          : 'unknown location error';
  return error.message || `Unable to read location (${codeLabel}).`;
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

  const attempts: GeolocationOptions[] = [
    // First try: precise and fresh.
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    // Retry: allow less precise but more likely fix on weak networks/devices.
    { enableHighAccuracy: false, timeout: 20000, maximumAge: 30000 },
    // Final fallback: cached fix is better than hard-failing claim flow.
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 180000 },
  ];

  let lastError: GeolocationPositionError | null = null;
  for (const options of attempts) {
    try {
      return await readPosition(options);
    } catch (error) {
      if ((error as GeolocationPositionError).code === GeolocationPositionError.PERMISSION_DENIED) {
        throw new Error(toGeolocationErrorMessage(error as GeolocationPositionError));
      }
      lastError = error as GeolocationPositionError;
    }
  }

  throw new Error(lastError ? toGeolocationErrorMessage(lastError) : 'Unable to read location.');
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
    const status =
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 0;
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('invalid api key')) {
      console.warn('Location ping disabled: backend Supabase key is invalid. Update backend/.env keys.');
      return;
    }
    if (
      status === 401 ||
      message.toLowerCase().includes('not authenticated') ||
      message.toLowerCase().includes('token expired') ||
      message.toLowerCase().includes('could not validate credentials') ||
      message.includes('401')
    ) {
      console.warn('Location ping failed: unauthorized. Stopping tracking.');
      stopLocationTracking();
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
