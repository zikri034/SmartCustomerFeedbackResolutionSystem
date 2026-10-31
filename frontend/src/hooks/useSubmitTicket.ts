import { useState } from 'react';
import { ticketApi } from '../api/ticketApi';
import type { CreateTicketPayload, CreateTicketResponse } from '../types';

interface UseSubmitTicketReturn {
  submit: (payload: CreateTicketPayload) => Promise<CreateTicketResponse>;
  loading: boolean;
  error: string | null;
  result: CreateTicketResponse | null;
  reset: () => void;
}

export function useSubmitTicket(): UseSubmitTicketReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateTicketResponse | null>(null);

  const submit = async (payload: CreateTicketPayload): Promise<CreateTicketResponse> => {
    setLoading(true);
    setError(null);
    try {
      const res = await ticketApi.create(payload);
      setResult(res);
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Submission failed';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setError(null);
    setResult(null);
  };

  return { submit, loading, error, result, reset };
}
