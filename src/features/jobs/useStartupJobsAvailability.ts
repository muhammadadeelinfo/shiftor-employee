import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@hooks/useSupabaseAuth';
import {
  buildStartupJobsEndpoint,
  normalizeStartupJobs,
  type StartupJobsResponse,
} from './startupJobs';

type StartupJobsAvailability = {
  hasJobs: boolean;
  loading: boolean;
};

const JOBS_AVAILABILITY_LIMIT = 1;

export const useStartupJobsAvailability = (): StartupJobsAvailability => {
  const { session, loading: authLoading } = useAuth();
  const [hasJobs, setHasJobs] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchAvailability = useCallback(async () => {
    if (authLoading) {
      return;
    }

    const url = buildStartupJobsEndpoint({ limit: JOBS_AVAILABILITY_LIMIT });
    if (!url) {
      setHasJobs(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const responseText = await response.text();
        const isMissingAccessToken =
          response.status === 401 ||
          responseText.toLowerCase().includes('missing access token');

        if (isMissingAccessToken && !session?.access_token) {
          setHasJobs(false);
          return;
        }

        throw new Error('Unable to load startup jobs');
      }

      const payload = (await response.json()) as StartupJobsResponse;
      setHasJobs(normalizeStartupJobs(payload).length > 0);
    } catch {
      setHasJobs(false);
    } finally {
      setLoading(false);
    }
  }, [authLoading, session?.access_token]);

  useEffect(() => {
    void fetchAvailability();
  }, [fetchAvailability]);

  return { hasJobs, loading };
};
