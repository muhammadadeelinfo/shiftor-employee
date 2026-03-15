import assert from 'assert';
import { shouldStackForCompactWidth } from '../src/shared/utils/responsiveLayout';
import { deTranslations } from '../src/shared/i18n/translations/de';
import { enTranslations } from '../src/shared/i18n/translations/en';

assert.strictEqual(shouldStackForCompactWidth(393), true);
assert.strictEqual(shouldStackForCompactWidth(430), false);

assert.ok(deTranslations.profileGreeting.includes('{name}'));
assert.ok(enTranslations.profileGreeting.includes('{name}'));
assert.notStrictEqual(deTranslations.notificationsSectionTitle, enTranslations.notificationsSectionTitle);
assert.ok(enTranslations.accountMonthlyHoursTitle.length > 0);
assert.ok(deTranslations.accountMonthlyHoursTitle.length > 0);

console.log('tests/uiAccountIntegration.test.ts OK');
