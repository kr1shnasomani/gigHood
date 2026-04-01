'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { initNotifications } from '@/lib/notifications';
import { startLocationTracking, requestLocationPermission } from '@/lib/location';
import { useAuthStore } from '@/store/authStore';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: 1,
      },
    },
  }));

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Initialize notifications and location tracking when user is authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    // Init push notifications
    initNotifications().catch(console.error);

    // Request location permission and start 15-min PoP pings
    requestLocationPermission().then((granted) => {
      if (granted) startLocationTracking(15 * 60 * 1000);
    }).catch(console.error);
  }, [isAuthenticated]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
