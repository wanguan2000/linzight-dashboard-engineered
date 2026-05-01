export type Locale = 'zh-CN' | 'en-US';

export const defaultLocale: Locale = 'zh-CN';

export const localeStorageKey = 'linzight-locale';

export const localeLabels: Record<Locale, string> = {
  'zh-CN': '中',
  'en-US': 'EN'
};
