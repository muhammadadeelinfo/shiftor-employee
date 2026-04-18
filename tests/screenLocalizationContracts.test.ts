import assert from 'assert';
import fs from 'fs';
import { enTranslations } from '../src/shared/i18n/translations/en';
import { deTranslations } from '../src/shared/i18n/translations/de';

const files = ['app/notifications.tsx', 'app/(tabs)/account.tsx', 'app/vacation-requests.tsx'];
const keyPattern = /t\('([A-Za-z0-9_]+)'/g;

const keys = new Set<string>();
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  let match: RegExpExecArray | null = null;
  while ((match = keyPattern.exec(source)) !== null) {
    keys.add(match[1]);
  }
}

assert.ok(keys.size > 0, 'Expected to find localization keys in target screens');

for (const key of keys) {
  assert.ok(key in enTranslations, `Missing key in EN translations: ${key}`);
  assert.ok(key in deTranslations, `Missing key in DE translations: ${key}`);
}

console.log('tests/screenLocalizationContracts.test.ts OK');
