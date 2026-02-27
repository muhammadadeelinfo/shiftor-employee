import assert from 'assert';
import {
  getLanguageStorageKey,
  loadStoredLanguage,
} from '../src/shared/utils/languageUtils';
import { getStartupRoute } from '../src/shared/utils/startupRoute';

const run = async () => {
  const mem = new Map<string, string>();

  const userId = 'employee-42';
  const key = getLanguageStorageKey(userId);
  assert.ok(key);

  mem.set(key!, 'de');
  const storage = {
    getItem: async (storageKey: string) => mem.get(storageKey) ?? null,
  };

  const languageAfterRestart = await loadStoredLanguage(storage, key!);
  assert.strictEqual(languageAfterRestart, 'de');

  assert.strictEqual(getStartupRoute(false), '/login');
  assert.strictEqual(getStartupRoute(true), '(tabs)/my-shifts');
};

void run()
  .then(() => {
    console.log('tests/e2eLanguageRestartFlow.test.ts OK');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
