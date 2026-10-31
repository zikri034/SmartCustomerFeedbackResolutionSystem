import type { DashboardMetrics } from '../types';

// ── Colour map for emotions ───────────────────────────────────────────────────
const EMOTION_COLORS: Record<string, string> = {
  anger:   'bg-red-500 text-white',
  disgust: 'bg-yellow-600 text-white',
  fear:    'bg-purple-600 text-white',
  joy:     'bg-green-500 text-white',
  sadness: 'bg-blue-500 text-white',
  neutral: 'bg-gray-400 text-white',
};

const STATUS_COLORS: Record<string, string> = {
  open:        'bg-yellow-300 text-black',
  in_progress: 'bg-blue-400 text-white',
  resolved:    'bg-green-400 text-black',
  escalated:   'bg-red-600 text-white',
};

const PRIORITY_COLORS: Record<string, string> = {
  low:      'bg-gray-200 text-black',
  medium:   'bg-yellow-200 text-black',
  high:     'bg-orange-400 text-white',
  critical: 'bg-red-700 text-white',
};

// ── Metric Card ───────────────────────────────────────────────────────────────
interface MetricCardProps {
  label: string;
  value: number | string;
  accent?: string; // Tailwind bg class
  large?: boolean;
}

export function MetricCard({ label, value, accent = 'bg-white', large = false }: MetricCardProps) {
  return (
    <div
      className={`${accent} border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] p-5 flex flex-col gap-1`}
    >
      <span className={`font-black uppercase tracking-widest text-xs`}>{label}</span>
      <span className={`font-black ${large ? 'text-5xl' : 'text-3xl'} leading-none`}>{value}</span>
    </div>
  );
}

// ── Breakdown Row ─────────────────────────────────────────────────────────────
interface BreakdownRowProps {
  label: string;
  count: number;
  total: number;
  colorClass: string;
}

function BreakdownRow({ label, count, total, colorClass }: BreakdownRowProps) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className={`${colorClass} border-2 border-black px-2 py-0.5 text-xs font-black uppercase min-w-[100px] text-center`}>
        {label}
      </span>
      <div className="flex-1 h-5 border-2 border-black bg-white overflow-hidden">
        <div
          className="h-full bg-black transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-black text-sm w-10 text-right">{count}</span>
    </div>
  );
}

// ── Emotion Breakdown Panel ───────────────────────────────────────────────────
interface EmotionPanelProps {
  byEmotion: DashboardMetrics['by_emotion'];
  total: number;
}

export function EmotionBreakdownPanel({ byEmotion, total }: EmotionPanelProps) {
  return (
    <div className="border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] bg-white p-5">
      <h2 className="font-black text-lg uppercase tracking-widest mb-4 border-b-4 border-black pb-2">
        Emotion Distribution
      </h2>
      <div className="flex flex-col gap-3">
        {(['anger', 'disgust', 'fear', 'joy', 'sadness', 'neutral'] as const).map((emotion) => (
          <BreakdownRow
            key={emotion}
            label={emotion}
            count={byEmotion[emotion] ?? 0}
            total={total}
            colorClass={EMOTION_COLORS[emotion]}
          />
        ))}
      </div>
    </div>
  );
}

// ── Status Breakdown Panel ────────────────────────────────────────────────────
interface StatusPanelProps {
  byStatus: DashboardMetrics['by_status'];
  total: number;
}

export function StatusBreakdownPanel({ byStatus, total }: StatusPanelProps) {
  return (
    <div className="border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] bg-white p-5">
      <h2 className="font-black text-lg uppercase tracking-widest mb-4 border-b-4 border-black pb-2">
        Ticket Status
      </h2>
      <div className="flex flex-col gap-3">
        {(['open', 'in_progress', 'resolved', 'escalated'] as const).map((status) => (
          <BreakdownRow
            key={status}
            label={status.replace('_', ' ')}
            count={byStatus[status] ?? 0}
            total={total}
            colorClass={STATUS_COLORS[status]}
          />
        ))}
      </div>
    </div>
  );
}

// ── Priority Breakdown Panel ──────────────────────────────────────────────────
interface PriorityPanelProps {
  byPriority: DashboardMetrics['by_priority'];
  total: number;
}

export function PriorityBreakdownPanel({ byPriority, total }: PriorityPanelProps) {
  return (
    <div className="border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] bg-white p-5">
      <h2 className="font-black text-lg uppercase tracking-widest mb-4 border-b-4 border-black pb-2">
        Priority Levels
      </h2>
      <div className="flex flex-col gap-3">
        {(['low', 'medium', 'high', 'critical'] as const).map((p) => (
          <BreakdownRow
            key={p}
            label={p}
            count={byPriority[p] ?? 0}
            total={total}
            colorClass={PRIORITY_COLORS[p]}
          />
        ))}
      </div>
    </div>
  );
}
