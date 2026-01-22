const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const envPath = path.resolve(__dirname, '..', '.env');

if (!fs.existsSync(envPath)) {
  console.error('✖ .env file is missing. Copy `.env.example` and set the Supabase keys.');
  process.exit(1);
}

const { parsed, error } = dotenv.config({ path: envPath });

if (error) {
  console.error('✖ Failed to parse `.env`:', error.message);
  process.exit(1);
}

const missing = required.filter((key) => !parsed?.[key]);

if (missing.length) {
  console.error(`✖ Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('✔︎ .env is valid and contains the required Supabase keys.');
