import { I18nService } from '../src/i18n';

describe('I18nService', () => {
  afterEach(() => {
    I18nService.setLanguage('en');
  });

  test('returns English translations by default', () => {
    I18nService.setLanguage('en');

    expect(I18nService.t('app.title')).toBe('PageMind');
    expect(I18nService.t('app.send')).toBe('Send');
  });

  test('switches to Chinese translations', () => {
    I18nService.setLanguage('zh');

    expect(I18nService.t('app.title')).toBe('页知');
    expect(I18nService.t('app.send')).toBe('发送');
  });

  test('returns the key itself for a missing translation', () => {
    const missingKey = 'missing.key' as Parameters<typeof I18nService.t>[0];
    expect(I18nService.t(missingKey)).toBe(missingKey);
  });

  test('exposes all translations for the current language', () => {
    I18nService.setLanguage('en');

    const translations = I18nService.getAll();

    expect(translations['app.title']).toBe('PageMind');
    expect(typeof translations).toBe('object');
  });
});
