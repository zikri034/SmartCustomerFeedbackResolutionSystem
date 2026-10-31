import { useEffect, useState, useCallback } from 'react';
import { ticketApi } from '../api/ticketApi';
import type { DashboardMetrics } from '../types';

export function useMetrics(intervalMs = 30_000) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const data = await ticketApi.getMetrics();
      setMetrics(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, intervalMs);
    return () => clearInterval(id);
  }, [fetch, intervalMs]);

  return { metrics, loading, error, refresh: fetch };
}
