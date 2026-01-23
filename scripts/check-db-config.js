#!/usr/bin/env node

const path = require('path');
const { config } = require('dotenv');

config({ path: path.resolve(process.cwd(), '.env') });

const requiredEnv = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'DATABASE_URL',
  'DIRECT_URL',
];

const missing = requiredEnv.filter((key) => !process.env[key]);
const supabaseHost = 'ritalqlveknouvojxfgt.supabase.co';

console.log('Supabase/Postgres configuration check');
console.log('-------------------------------------');
requiredEnv.forEach((key) => {
  const value = process.env[key];
  const status = value ? 'FOUND' : 'MISSING';
  const note = value && value.includes(supabaseHost) ? '' : ' (not pointing to shared Supabase)';
  console.log(`${key}: ${status}${value && note}`);
});

if (missing.length > 0) {
  console.log('\nMissing required env vars:', missing.join(', '));
  process.exitCode = 1;
} else {
  const allPointToSupabase = requiredEnv.every(
    (key) => process.env[key] && process.env[key].includes(supabaseHost)
  );
  if (!allPointToSupabase) {
    console.log('\nWarning: not all connection strings reference the shared Supabase host.');
    process.exitCode = 1;
  } else {
    console.log('\nAll required env vars are present and point to the Supabase Postgres project.');
  }
}
