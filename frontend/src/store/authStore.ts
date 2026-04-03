import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { saveToken, deleteToken } from '@/lib/auth';

export interface WorkerProfile {
  id: string;
  phone: string;
  name: string;
  city: string;
  platform_affiliation?: string;
  platform_id?: string;
  is_platform_verified?: boolean;
  dark_store_zone: string;
  hex_id: string;
  avg_daily_earnings: number;
  upi_id: string;
}

interface AuthState {
  _hasHydrated: boolean;
  isAuthenticated: boolean;
  accessToken: string | null;
  phone: string;
  workerProfile: WorkerProfile | null;
  setHasHydrated: (value: boolean) => void;
  setAuth: (token: string, profile: WorkerProfile) => void;
  setWorkerProfile: (profile: WorkerProfile) => void;
  clearAuth: () => void;
  setPhone: (phone: string) => void;
  hydrateFromStorage: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      _hasHydrated: false,
      isAuthenticated: false,
      accessToken: null,
      phone: '',
      workerProfile: null,

      setHasHydrated: (value) => {
        set({ _hasHydrated: value });
      },

      setAuth: (token, profile) => {
        saveToken(token);
        set({ isAuthenticated: true, accessToken: token, workerProfile: profile, phone: profile.phone });
      },

      setWorkerProfile: (profile) => {
        set({ workerProfile: profile });
      },

      clearAuth: () => {
        deleteToken();
        set({ isAuthenticated: false, accessToken: null, workerProfile: null, phone: '' });
      },

      setPhone: (phone) => set({ phone }),

      hydrateFromStorage: () => {
        // This is called during hydration
      },
    }),
    {
      name: 'gighood-auth-store',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken,
        phone: state.phone,
        workerProfile: state.workerProfile,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
