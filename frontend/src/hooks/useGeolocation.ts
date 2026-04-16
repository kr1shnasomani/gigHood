import { useState, useEffect } from "react";

export default function useGeolocation(watch = false) {
  const browserHasGeo = typeof window !== "undefined" && Boolean(navigator.geolocation);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState<string | null>(browserHasGeo ? null : "Geolocation not supported");

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      return;
    }

    const onSuccess = (pos: GeolocationPosition) => {
      setCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      setError(null);
    };

    const onError = (err: GeolocationPositionError) => {
      setError(err.message);
    };

    if (watch) {
      const id = navigator.geolocation.watchPosition(onSuccess, onError, {
        enableHighAccuracy: true,
      });
      return () => navigator.geolocation.clearWatch(id);
    } else {
      navigator.geolocation.getCurrentPosition(onSuccess, onError);
    }
  }, [watch]);

  return { coords, error };
}
