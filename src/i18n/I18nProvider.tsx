/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { enUSMessages } from './messages.en-US';
import { zhCNMessages } from './messages.zh-CN';
import { defaultLocale, localeStorageKey, type Locale } from './types';
import { translateText } from './dictionary';
import { setRuntimeLocale } from './runtime';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (text: string) => string;
}

const messages = {
  'zh-CN': zhCNMessages,
  'en-US': enUSMessages
};

const I18nContext = createContext<I18nContextValue | null>(null);

function isLocale(value: string | null): value is Locale {
  return value === 'zh-CN' || value === 'en-US';
}

function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale;
  const bootLocale = (window as typeof window & { __LINZIGHT_INITIAL_LOCALE__?: string }).__LINZIGHT_INITIAL_LOCALE__ ?? null;
  if (isLocale(bootLocale)) return bootLocale;

  const params = new URLSearchParams(window.location.search);
  const urlLocale = params.get('locale') ?? params.get('lang');
  if (isLocale(urlLocale)) return urlLocale;

  const stored = window.localStorage.getItem(localeStorageKey);
  return isLocale(stored) ? stored : defaultLocale;
}

function applyLocale(locale: Locale) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.title = locale === 'en-US' ? 'LinZight RWS EDC' : 'LinZight RWS EDC';

  const url = new URL(window.location.href);
  if (url.searchParams.get('locale') !== locale) {
    url.searchParams.set('locale', locale);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);
  setRuntimeLocale(locale);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem(localeStorageKey, nextLocale);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN');
  }, [locale, setLocale]);

  const t = useCallback((text: string) => translateText(text, locale), [locale]);

  useEffect(() => {
    applyLocale(locale);
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      t
    }),
    [locale, setLocale, toggleLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return context;
}

export function useLocaleMessages() {
  const { locale } = useI18n();
  return messages[locale];
}
