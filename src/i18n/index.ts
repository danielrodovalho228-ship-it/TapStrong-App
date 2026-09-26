import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import es from './locales/es.json';
import ptBR from './locales/pt-BR.json';

export const SUPPORTED_LOCALES = ['en', 'es', 'pt-BR'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

export const resources = {
  en: { translation: en },
  es: { translation: es },
  'pt-BR': { translation: ptBR },
} as const;

/** Maps a device locale (e.g. "pt-PT", "es-MX", "en-GB") to a supported one. */
export function resolveLocale(languageTag: string | null | undefined): SupportedLocale {
  if (!languageTag) return DEFAULT_LOCALE;
  const lower = languageTag.toLowerCase();
  if (lower.startsWith('pt')) return 'pt-BR';
  if (lower.startsWith('es')) return 'es';
  return DEFAULT_LOCALE;
}

export function deviceLocale(): SupportedLocale {
  return resolveLocale(getLocales()[0]?.languageTag);
}

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: deviceLocale(),
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
