import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppLanguage = 'en' | 'hi' | 'ta' | 'te' | 'kn' | 'mr' | 'bn' | 'as';

const CITY_LANGUAGE_MAP: Record<string, AppLanguage> = {
  bengaluru: 'kn',
  bangalore: 'kn',
  chennai: 'ta',
  hyderabad: 'te',
  kolkata: 'bn',
  guwahati: 'as',
  mumbai: 'mr',
  delhi: 'hi',
  jaipur: 'hi',
  lucknow: 'hi',
};

interface LanguageState {
  language: AppLanguage;
  hasManualChoice: boolean;
  isHydrated: boolean;
  setLanguage: (language: AppLanguage) => void;
  inferLanguageFromCity: (city?: string | null) => void;
  setHydrated: (value: boolean) => void;
}

function mapCityToLanguage(city?: string | null): AppLanguage {
  const normalized = (city || '').trim().toLowerCase();
  return CITY_LANGUAGE_MAP[normalized] || 'en';
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: 'en',
      hasManualChoice: false,
      isHydrated: false,

      setHydrated: (value) => set({ isHydrated: value }),

      setLanguage: (language) => {
        set({ language, hasManualChoice: true });
      },

      inferLanguageFromCity: (city) => {
        if (get().hasManualChoice) {
          return;
        }
        set({ language: mapCityToLanguage(city) });
      },
    }),
    {
      name: 'gighood-language-store',
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
      partialize: (state) => ({
        language: state.language,
        hasManualChoice: state.hasManualChoice,
      }),
    }
  )
);

export const LANGUAGE_OPTIONS: Array<{ code: AppLanguage; label: string; name: string }> = [
  { code: 'en', label: 'ENG', name: 'English' },
  { code: 'hi', label: 'HIN', name: 'Hindi' },
  { code: 'ta', label: 'TAM', name: 'Tamil' },
  { code: 'te', label: 'TEL', name: 'Telugu' },
  { code: 'kn', label: 'KAN', name: 'Kannada' },
  { code: 'mr', label: 'MAR', name: 'Marathi' },
  { code: 'bn', label: 'BEN', name: 'Bengali' },
  { code: 'as', label: 'ASM', name: 'Assamese' },
];
