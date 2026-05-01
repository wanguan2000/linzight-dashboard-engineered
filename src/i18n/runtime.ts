import { translateText } from './dictionary';
import { defaultLocale, type Locale } from './types';

declare global {
  // Shared between Vite's optimized JSX runtime dependency and app modules.
  var __LINZIGHT_I18N_RUNTIME__: { locale: Locale } | undefined;
}

const runtimeState = globalThis.__LINZIGHT_I18N_RUNTIME__ ?? { locale: defaultLocale };
globalThis.__LINZIGHT_I18N_RUNTIME__ = runtimeState;

const translatedAttributes = new Set(['aria-label', 'placeholder', 'title']);
const skippedTags = new Set(['script', 'style', 'noscript', 'code', 'pre']);

export function setRuntimeLocale(locale: Locale) {
  runtimeState.locale = locale;
}

export function getRuntimeLocale() {
  return runtimeState.locale;
}

function shouldSkipType(type: unknown) {
  return typeof type === 'string' && skippedTags.has(type.toLowerCase());
}

function translateValue(value: unknown): unknown {
  const locale = getRuntimeLocale();
  if (locale === 'zh-CN') return value;
  if (typeof value === 'string') return translateText(value, locale);
  if (Array.isArray(value)) return value.map(translateValue);
  return value;
}

function extractText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(extractText).join('');
  return '';
}

export function translateJsxProps(type: unknown, props: unknown) {
  const locale = getRuntimeLocale();
  if (!props || locale === 'zh-CN' || shouldSkipType(type) || typeof props !== 'object') {
    return props;
  }

  const input = props as Record<string, unknown>;
  let output: Record<string, unknown> | null = null;

  function setProp(key: string, value: unknown) {
    if (!output) output = { ...input };
    output[key] = value;
  }

  if ('children' in input) {
    const originalChildren = input.children;
    const translatedChildren = translateValue(originalChildren);
    if (translatedChildren !== originalChildren) {
      setProp('children', translatedChildren);
    }

    if (type === 'option' && input.value === undefined) {
      const optionValue = extractText(originalChildren).trim();
      if (optionValue) setProp('value', optionValue);
    }
  }

  for (const key of translatedAttributes) {
    const value = input[key];
    if (typeof value === 'string') {
      const translatedValue = translateText(value, locale);
      if (translatedValue !== value) setProp(key, translatedValue);
    }
  }

  return output ?? props;
}
