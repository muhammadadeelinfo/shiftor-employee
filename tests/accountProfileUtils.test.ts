import assert from 'assert';
import {
  deriveStoragePathFromUrl,
  getMetadataAddressDeep,
  getProfilePhone,
  profileName,
} from '../src/features/account/accountProfileUtils';

assert.strictEqual(profileName({ email: 'alex@example.com', user_metadata: {} }), 'Alex');
assert.strictEqual(profileName({ email: null, user_metadata: { full_name: 'sam' } }), 'Sam');
assert.strictEqual(getProfilePhone({ contactPhone: '+49 123' }), '+49 123');
assert.strictEqual(getMetadataAddressDeep({ address: { street: 'Main', houseNumber: '4', city: 'Berlin' } }), 'Main 4, Berlin');
assert.strictEqual(
  deriveStoragePathFromUrl('https://example.test/storage/v1/object/public/company-assets/a/b.jpg', 'company-assets'),
  'a/b.jpg'
);
assert.strictEqual(deriveStoragePathFromUrl('not a url', 'company-assets'), null);

console.log('tests/accountProfileUtils.test.ts OK');
