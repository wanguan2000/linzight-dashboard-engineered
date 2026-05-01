import { useI18n, useLocaleMessages } from '../i18n/I18nProvider';

export function LanguageToggle() {
  const { locale, toggleLocale } = useI18n();
  const messages = useLocaleMessages();

  return (
    <button
      className="language-toggle"
      type="button"
      aria-label={messages.languageToggleLabel}
      onClick={toggleLocale}
      data-locale={locale}
    >
      {messages.languageToggleText}
    </button>
  );
}
