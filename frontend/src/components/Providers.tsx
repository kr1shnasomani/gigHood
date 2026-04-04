'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
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
  const pathname = usePathname();

  const locationTrackingEnabled = process.env.NEXT_PUBLIC_ENABLE_LOCATION_TRACKING !== 'false';
  const isAuthRoute = pathname?.includes('/login') || pathname?.includes('/register');
  const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('gighood_jwt'));

  // Initialize notifications and location tracking when user is authenticated
  useEffect(() => {
    if (isAuthRoute || !hasToken) return;

    // Init push notifications
    initNotifications().catch(console.error);

    // Request location permission and start 15-min PoP pings only when explicitly enabled
    if (!locationTrackingEnabled) return;

    requestLocationPermission()
      .then((granted) => {
        if (granted) startLocationTracking(5 * 60 * 1000);
      })
      .catch(console.error);
  }, [hasToken, isAuthenticated, isAuthRoute, locationTrackingEnabled]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
