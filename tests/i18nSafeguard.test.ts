import assert from 'assert';
import {
  getTranslationValue,
  setMissingTranslationHandler,
} from '../src/shared/utils/i18nUtils';

const dictionary = {
  existing: 'Localized value',
  empty: '',
} as const;

assert.strictEqual(getTranslationValue(dictionary, 'existing'), 'Localized value');

const events: { key: string; reason: 'missing' | 'empty' }[] = [];
setMissingTranslationHandler((payload) => {
  events.push(payload);
});

assert.strictEqual(getTranslationValue(dictionary, 'missing_key'), 'missing_key');
assert.strictEqual(getTranslationValue(dictionary, 'empty'), 'empty');
assert.strictEqual(events.length, 2);
assert.deepStrictEqual(events[0], { key: 'missing_key', reason: 'missing' });
assert.deepStrictEqual(events[1], { key: 'empty', reason: 'empty' });

setMissingTranslationHandler(null);

console.log('tests/i18nSafeguard.test.ts OK');
