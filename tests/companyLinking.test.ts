import assert from 'assert';
import { parseCompanyLinkRequestResult } from '../src/features/account/companyLinkingUtils';

assert.deepStrictEqual(
  parseCompanyLinkRequestResult({
    ok: true,
    status: 'pending',
    companyId: 'company-1',
    requestedAction: 'join',
  }),
  {
    ok: true,
    status: 'pending',
    companyId: 'company-1',
    requestedAction: 'join',
  }
);
assert.deepStrictEqual(parseCompanyLinkRequestResult({ ok: false, status: 'invalid_code' }), {
  ok: false,
  status: 'invalid_code',
  companyId: undefined,
  requestedAction: undefined,
});
assert.throws(() => parseCompanyLinkRequestResult({ ok: false, status: 'surprise' }));

console.log('tests/companyLinking.test.ts OK');
