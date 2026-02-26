#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { config } = require('dotenv');

config({ path: path.resolve(process.cwd(), '.env') });

let passCount = 0;
let warnCount = 0;
let failCount = 0;

const pass = (message) => {
  passCount += 1;
  console.log(`[PASS] ${message}`);
};

const warn = (message) => {
  warnCount += 1;
  console.log(`[WARN] ${message}`);
};

const fail = (message) => {
  failCount += 1;
  console.log(`[FAIL] ${message}`);
};

const readJson = (file) => {
  try {
    const content = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
};

const isHttpsUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const hasNonRootPath = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.pathname && parsed.pathname !== '/';
  } catch {
    return false;
  }
};

const normalizeUrl = (value) => {
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
  } catch {
    return '';
  }
};

console.log('Google Play release readiness check');
console.log('----------------------------------');

let expoConfig;
try {
  const output = execSync('npx expo config --type public --json', {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  expoConfig = JSON.parse(output);
  pass('Expo public config resolves successfully.');
} catch (error) {
  fail('Failed to resolve Expo public config (`npx expo config --type public --json`).');
  if (error && error.stderr) {
    console.log(String(error.stderr).trim());
  }
}

const easJson = readJson('eas.json') ?? {};
const appVersionSource = easJson?.cli?.appVersionSource;

if (expoConfig) {
  const appName = expoConfig.name;
  const appSlug = expoConfig.slug;
  const androidPackage = expoConfig?.android?.package;
  const androidVersionCode = expoConfig?.android?.versionCode;
  const blockedPermissions = expoConfig?.android?.blockedPermissions ?? [];
  const requestedPermissions = expoConfig?.android?.permissions ?? [];
  const appScheme = expoConfig.scheme;
  const legalPrivacyUrl = expoConfig?.extra?.legalPrivacyUrl;
  const legalTermsUrl = expoConfig?.extra?.legalTermsUrl;

  if (typeof appName === 'string' && appName.trim()) {
    pass(`App name is set (${appName}).`);
  } else {
    fail('App name is missing.');
  }

  if (typeof appSlug === 'string' && appSlug.trim()) {
    pass(`Slug is set (${appSlug}).`);
  } else {
    fail('Slug is missing.');
  }

  if (typeof appScheme === 'string' && appScheme.trim()) {
    pass(`Scheme is set (${appScheme}).`);
  } else {
    fail('Scheme is missing.');
  }

  if (typeof androidPackage === 'string' && /^[a-zA-Z][a-zA-Z0-9_.]+$/.test(androidPackage)) {
    pass(`Android package is set (${androidPackage}).`);
  } else {
    fail('Android package is missing or invalid.');
  }

  if (typeof androidVersionCode === 'number' && Number.isInteger(androidVersionCode) && androidVersionCode > 0) {
    pass(`Android versionCode is set (${androidVersionCode}).`);
  } else if (appVersionSource === 'remote') {
    warn('Android versionCode is not in app config; EAS remote versioning is expected to provide it.');
  } else {
    fail('Android versionCode is not set.');
  }

  if (blockedPermissions.includes('android.permission.SYSTEM_ALERT_WINDOW')) {
    pass('SYSTEM_ALERT_WINDOW is explicitly blocked.');
  } else {
    fail('SYSTEM_ALERT_WINDOW is not blocked in app config.');
  }

  if (requestedPermissions.includes('android.permission.SYSTEM_ALERT_WINDOW')) {
    fail('SYSTEM_ALERT_WINDOW is still requested by the app.');
  } else {
    pass('No SYSTEM_ALERT_WINDOW runtime permission is requested.');
  }

  if (isHttpsUrl(legalPrivacyUrl)) {
    pass(`Privacy policy URL is HTTPS (${legalPrivacyUrl}).`);
    if (!hasNonRootPath(legalPrivacyUrl)) {
      warn('Privacy policy URL points to site root; prefer a dedicated privacy page path.');
    }
  } else {
    fail('LEGAL_PRIVACY_URL must be a valid HTTPS URL.');
  }

  if (isHttpsUrl(legalTermsUrl)) {
    pass(`Terms URL is HTTPS (${legalTermsUrl}).`);
    if (!hasNonRootPath(legalTermsUrl)) {
      warn('Terms URL points to site root; prefer a dedicated terms/legal page path.');
    }
  } else {
    fail('LEGAL_TERMS_URL must be a valid HTTPS URL.');
  }

  if (
    isHttpsUrl(legalPrivacyUrl) &&
    isHttpsUrl(legalTermsUrl) &&
    normalizeUrl(legalPrivacyUrl) === normalizeUrl(legalTermsUrl)
  ) {
    fail('LEGAL_TERMS_URL and LEGAL_PRIVACY_URL must point to different pages.');
  }
}

const gradlePath = path.resolve(process.cwd(), 'android/app/build.gradle');
try {
  const gradleContent = fs.readFileSync(gradlePath, 'utf8');
  if (gradleContent.includes("signingConfig signingConfigs.release")) {
    pass('Android release build type uses release signing config.');
  } else {
    fail('Android release build type is not using release signing config.');
  }
  if (gradleContent.includes('android.injected.signing.store.file')) {
    pass('Android build.gradle supports injected release signing credentials (EAS/CI).');
  } else {
    warn('Android build.gradle does not reference injected signing credentials.');
  }
} catch {
  warn('Could not read android/app/build.gradle (managed workflow or native dir not generated).');
}

console.log('');
console.log(`Summary: ${passCount} pass, ${warnCount} warn, ${failCount} fail`);

if (failCount > 0) {
  process.exitCode = 1;
}
