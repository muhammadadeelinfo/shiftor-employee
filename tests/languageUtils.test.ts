import assert from 'assert';
import {
  getLanguageStorageKey,
  interpolate,
  isValidLanguage,
  languageDefinitions,
} from '../src/shared/utils/languageUtils';

assert.strictEqual(languageDefinitions.length, 2);
assert.strictEqual(languageDefinitions[0].code, 'en');
assert.strictEqual(languageDefinitions[1].code, 'de');

assert.strictEqual(getLanguageStorageKey(undefined), null);
assert.strictEqual(getLanguageStorageKey(null), null);
assert.strictEqual(getLanguageStorageKey('user-1'), 'employee-portal-language:user-1');

assert.strictEqual(isValidLanguage('en'), true);
assert.strictEqual(isValidLanguage('de'), true);
assert.strictEqual(isValidLanguage('fr'), false);
assert.strictEqual(isValidLanguage(null), false);

assert.strictEqual(interpolate('Hello world'), 'Hello world');
assert.strictEqual(interpolate('Hello {name}', { name: 'Adeel' }), 'Hello Adeel');
assert.strictEqual(interpolate('{count} shifts', { count: 5 }), '5 shifts');
assert.strictEqual(
  interpolate('Hi {name}, {name} again', { name: 'Sam' }),
  'Hi Sam, {name} again'
);

console.log('tests/languageUtils.test.ts OK');
