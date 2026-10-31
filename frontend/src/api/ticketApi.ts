import type {
  PaginatedResponse,
  Ticket,
  TicketDetailResponse,
  CreateTicketResponse,
  DashboardMetrics,
  CreateTicketPayload,
} from '../types';

const BASE_URL = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error((body as { error?: string }).error ?? `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// ── Ticket Endpoints ──────────────────────────────────────────────────────────

export const ticketApi = {
  list(params?: { status?: string; priority?: string; page?: number; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.priority) qs.set('priority', params.priority);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return request<PaginatedResponse<Ticket>>(`/tickets${query}`);
  },

  get(id: string) {
    return request<TicketDetailResponse>(`/tickets/${id}`);
  },

  create(payload: CreateTicketPayload) {
    return request<CreateTicketResponse>('/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateStatus(id: string, status: string, resolution_text?: string) {
    return request<{ ticket: Ticket }>(`/tickets/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, resolution_text }),
    });
  },

  getMetrics() {
    return request<DashboardMetrics>('/tickets/metrics');
  },
};
