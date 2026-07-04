import { supabase } from '@lib/supabaseClient';
import {
  isCompanyLinkStatus,
  parseCompanyLinkRequestResult,
  type CompanyLinkStatus,
} from './companyLinkingUtils';
export type { CompanyLinkRequestResult, CompanyLinkStatus } from './companyLinkingUtils';

export type CompanyLink = {
  id: string;
  companyId: string;
  status: CompanyLinkStatus;
  requestedCode: string;
  createdAt: string;
  updatedAt: string;
};

export const requestCompanyLink = async (joinCode: string, fullName?: string) => {
  if (!supabase) throw new Error('Supabase client not configured');
  const { data, error } = await supabase.rpc('request_employee_company_link', {
    join_code: joinCode.trim(),
    full_name: fullName?.trim() || null,
  });
  if (error) throw error;
  return parseCompanyLinkRequestResult(data);
};

export const fetchCompanyLinks = async (userId: string): Promise<CompanyLink[]> => {
  if (!supabase) throw new Error('Supabase client not configured');
  const { data, error } = await supabase
    .from('employee_company_links')
    .select('id, company_id, status, requested_code, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).flatMap((row) => {
    if (
      typeof row.id !== 'string' ||
      typeof row.company_id !== 'string' ||
      !isCompanyLinkStatus(row.status)
    ) {
      return [];
    }
    return [{
      id: row.id,
      companyId: row.company_id,
      status: row.status,
      requestedCode: typeof row.requested_code === 'string' ? row.requested_code : '',
      createdAt: typeof row.created_at === 'string' ? row.created_at : '',
      updatedAt: typeof row.updated_at === 'string' ? row.updated_at : '',
    }];
  });
};
