'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { initNotifications } from '@/lib/notifications';
import { startLocationTracking, stopLocationTracking, requestLocationPermission } from '@/lib/location';
import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';
import i18n from '@/i18n';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  }));

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const language = useLanguageStore((s) => s.language);
  const pathname = usePathname();

  const locationTrackingEnabled = process.env.NEXT_PUBLIC_ENABLE_LOCATION_TRACKING !== 'false';
  const isAuthRoute = pathname?.includes('/login') || pathname?.includes('/register');
  const isWorkerRoute = pathname?.startsWith('/worker-app') || false;

  // Sync i18next with language store
  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language]);

  // Initialize notifications and location tracking when user is authenticated
  useEffect(() => {
    if (!isWorkerRoute || isAuthRoute || !isAuthenticated) {
      stopLocationTracking();
      return;
    }

    const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('gighood_jwt'));
    if (!hasToken) {
      stopLocationTracking();
      return;
    }

    const runDeferredSetup = () => {
      // Init push notifications
      initNotifications().catch(console.error);

      // Request location permission and start 15-min PoP pings only when explicitly enabled
      if (!locationTrackingEnabled) return;

      requestLocationPermission()
        .then((granted) => {
          if (granted) startLocationTracking(15 * 60 * 1000);
        })
        .catch(console.error);
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(runDeferredSetup);
      return () => window.cancelIdleCallback(id);
    }

    const timeoutId = setTimeout(runDeferredSetup, 0);
    return () => clearTimeout(timeoutId);
  }, [isAuthenticated, isAuthRoute, isWorkerRoute, locationTrackingEnabled]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
