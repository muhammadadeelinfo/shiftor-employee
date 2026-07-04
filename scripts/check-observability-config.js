require('dotenv').config();

const strict = process.argv.includes('--strict');
const production = (process.env.EXPO_STAGE || 'production').toLowerCase() === 'production';
const required = ['SENTRY_DSN', 'SENTRY_ORG', 'SENTRY_PROJECT'];
const missing = required.filter((key) => !process.env[key]?.trim());
const sentryEnabled = process.env.SENTRY_ENABLED === 'true';
const analyticsEnabled = process.env.ANALYTICS_ENABLED === 'true';
const issues = [];

if (production && !sentryEnabled) issues.push('SENTRY_ENABLED is not true.');
if (production && missing.length) issues.push(`Missing ${missing.join(', ')}.`);
if (production && !analyticsEnabled) issues.push('ANALYTICS_ENABLED is not true.');

console.log('Production observability check');
console.log('------------------------------');
console.log(`Stage: ${production ? 'production' : 'non-production'}`);
console.log(`Sentry: ${sentryEnabled && !missing.length ? 'READY' : 'NOT READY'}`);
console.log(`Analytics: ${analyticsEnabled ? 'READY' : 'NOT READY'}`);

if (!issues.length) {
  console.log('Observability configuration is ready.');
  process.exit(0);
}

issues.forEach((issue) => console.log(`${strict ? '[FAIL]' : '[WARN]'} ${issue}`));
if (strict) process.exit(1);
