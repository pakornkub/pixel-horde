import { afterEach, describe, expect, it } from 'vitest';
import { checkCompleteness, detectLang, lang, setLang, t } from './index';

afterEach(() => setLang('th'));

describe('i18n', () => {
  it('has every key in both languages with matching placeholders', () => {
    expect(checkCompleteness()).toEqual([]);
  });
  it('detects the problem when a key is missing', () => {
    expect(checkCompleteness({ th: { a: 'x', b: '{n}' }, en: { b: '{m}' } })).toEqual(['missing en: a', 'placeholders differ: b']);
  });
  it('translates with arguments and switches language', () => {
    expect(t('clear.title', { n: 3 })).toBe('STAGE 3 CLEAR');
    setLang('en');
    expect(lang()).toBe('en');
    expect(t('shop.buy', { cost: 40 })).toBe('Buy 40G');
    expect(t('no.such.key')).toBe('no.such.key');
  });
  it('defaults from browser languages', () => {
    expect(detectLang(['th-TH', 'en-US'])).toBe('th');
    expect(detectLang(['en-GB'])).toBe('en');
    expect(detectLang(['ja-JP'])).toBe('en');
  });
});
