export type CompanyLinkStatus = 'pending' | 'active' | 'rejected';

export type CompanyLinkRequestResult = {
  ok: boolean;
  status: CompanyLinkStatus | 'invalid_code' | 'code_expired' | 'code_exhausted' | 'rate_limited';
  companyId?: string;
  requestedAction?: 'join' | 'switch';
};

export const isCompanyLinkStatus = (value: unknown): value is CompanyLinkStatus =>
  value === 'pending' || value === 'active' || value === 'rejected';

export const parseCompanyLinkRequestResult = (value: unknown): CompanyLinkRequestResult => {
  if (!value || typeof value !== 'object') {
    throw new Error('Company link request returned an invalid response.');
  }
  const record = value as Record<string, unknown>;
  const status = record.status;
  const validErrorStatuses = ['invalid_code', 'code_expired', 'code_exhausted', 'rate_limited'];
  if (!isCompanyLinkStatus(status) && !validErrorStatuses.includes(String(status))) {
    throw new Error('Company link request returned an unknown status.');
  }
  return {
    ok: record.ok === true,
    status: status as CompanyLinkRequestResult['status'],
    companyId: typeof record.companyId === 'string' ? record.companyId : undefined,
    requestedAction:
      record.requestedAction === 'join' || record.requestedAction === 'switch'
        ? record.requestedAction
        : undefined,
  };
};
