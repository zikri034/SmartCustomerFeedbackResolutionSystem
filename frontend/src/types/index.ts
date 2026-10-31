// ── Domain Types ──────────────────────────────────────────────────────────────

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'escalated';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type DominantEmotion = 'anger' | 'disgust' | 'fear' | 'joy' | 'sadness' | 'neutral';

export interface Ticket {
  id: string;
  customer_name: string;
  customer_email: string;
  subject: string;
  body: string;
  status: TicketStatus;
  priority: TicketPriority;
  auto_resolved: boolean;
  resolution_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmotionLog {
  id: string;
  ticket_id: string;
  dominant_emotion: DominantEmotion;
  anger_score: number;
  disgust_score: number;
  fear_score: number;
  joy_score: number;
  sadness_score: number;
  created_at: string;
}

// ── API Response Types ────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface TicketDetailResponse {
  ticket: Ticket;
  emotion: EmotionLog | null;
}

export interface CreateTicketResponse {
  ticket: Ticket;
  emotion: EmotionLog | null;
  resolution: string | null;
  escalated: boolean;
  warning?: string;
}

export interface DashboardMetrics {
  total: number;
  auto_resolved: number;
  by_status: Partial<Record<TicketStatus, number>>;
  by_emotion: Partial<Record<DominantEmotion, number>>;
  by_priority: Partial<Record<TicketPriority, number>>;
}

export interface CreateTicketPayload {
  customer_name: string;
  customer_email: string;
  subject: string;
  body: string;
}
