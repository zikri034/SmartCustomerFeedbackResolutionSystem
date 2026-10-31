import { useMetrics } from '../hooks/useMetrics';
import {
  MetricCard,
  EmotionBreakdownPanel,
  StatusBreakdownPanel,
  PriorityBreakdownPanel,
} from './MetricCard';
import { TicketForm } from './TicketForm';

export function Dashboard() {
  const { metrics, loading, error, refresh } = useMetrics(30_000);

  const autoResolutionRate =
    metrics && metrics.total > 0
      ? `${Math.round((metrics.auto_resolved / metrics.total) * 100)}%`
      : '—';

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-black text-white border-b-4 border-black px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-black text-2xl uppercase tracking-widest leading-none">
            Smart Feedback System
          </h1>
          <p className="text-yellow-300 font-bold text-xs uppercase tracking-widest mt-1">
            AI-Powered Customer Resolution Dashboard
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="bg-yellow-300 text-black font-black uppercase px-4 py-2 border-4 border-yellow-300 hover:bg-white transition-colors disabled:opacity-50 text-xs tracking-widest cursor-pointer"
        >
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 flex flex-col gap-8">

        {/* ── Error Banner ──────────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-500 text-white border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] p-4 font-bold">
            ⚠ API Error: {error}
          </div>
        )}

        {/* ── Top KPI Cards ─────────────────────────────────────────────────── */}
        <section>
          <h2 className="font-black uppercase text-sm tracking-widest mb-4 border-b-4 border-black pb-2">
            Key Metrics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Total Tickets"
              value={loading ? '…' : (metrics?.total ?? 0)}
              accent="bg-yellow-300"
              large
            />
            <MetricCard
              label="Auto-Resolved"
              value={loading ? '…' : (metrics?.auto_resolved ?? 0)}
              accent="bg-green-400"
              large
            />
            <MetricCard
              label="Resolution Rate"
              value={loading ? '…' : autoResolutionRate}
              accent="bg-white"
              large
            />
            <MetricCard
              label="Escalated"
              value={loading ? '…' : (metrics?.by_status?.escalated ?? 0)}
              accent="bg-red-500"
              large
            />
          </div>
        </section>

        {/* ── Second Row KPIs ───────────────────────────────────────────────── */}
        <section>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Open" value={loading ? '…' : (metrics?.by_status?.open ?? 0)} accent="bg-yellow-100" />
            <MetricCard label="In Progress" value={loading ? '…' : (metrics?.by_status?.in_progress ?? 0)} accent="bg-blue-200" />
            <MetricCard label="Resolved" value={loading ? '…' : (metrics?.by_status?.resolved ?? 0)} accent="bg-green-200" />
            <MetricCard label="Critical" value={loading ? '…' : (metrics?.by_priority?.critical ?? 0)} accent="bg-orange-300" />
          </div>
        </section>

        {/* ── Breakdown Panels ──────────────────────────────────────────────── */}
        {metrics && (
          <section className="grid md:grid-cols-3 gap-6">
            <EmotionBreakdownPanel byEmotion={metrics.by_emotion} total={metrics.total} />
            <StatusBreakdownPanel byStatus={metrics.by_status} total={metrics.total} />
            <PriorityBreakdownPanel byPriority={metrics.by_priority} total={metrics.total} />
          </section>
        )}

        {/* ── Ticket Submission Form ─────────────────────────────────────────── */}
        <section className="grid md:grid-cols-2 gap-6 items-start">
          <div>
            <h2 className="font-black uppercase text-sm tracking-widest mb-4 border-b-4 border-black pb-2">
              New Ticket
            </h2>
            <TicketForm onSuccess={refresh} />
          </div>

          {/* ── How It Works ────────────────────────────────────────────────── */}
          <div className="border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] bg-black text-white p-6 flex flex-col gap-5">
            <h2 className="font-black uppercase text-sm tracking-widest border-b-4 border-white pb-2">
              How It Works
            </h2>
            {[
              { step: '01', title: 'Submit Ticket', desc: 'Customer fills in complaint via this form.' },
              { step: '02', title: 'Watson NLU Analysis', desc: 'IBM Watson NLU detects dominant emotion: anger, fear, joy, neutral…' },
              { step: '03', title: 'Routing Decision', desc: 'Angry / fearful / disgusted tickets are escalated to a human agent immediately.' },
              { step: '04', title: 'Ollama Auto-Reply', desc: 'Neutral / joyful tickets are auto-resolved by a local Llama 3 / Qwen 3 model.' },
              { step: '05', title: 'Logged to PostgreSQL', desc: 'Every ticket and emotion score is persisted for analytics and audit.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-4">
                <span className="bg-yellow-300 text-black font-black border-4 border-yellow-300 w-12 h-12 flex items-center justify-center text-sm flex-shrink-0">
                  {step}
                </span>
                <div>
                  <p className="font-black uppercase text-sm">{title}</p>
                  <p className="text-gray-300 text-xs mt-1">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="border-t-4 border-black pt-4 text-center">
          <p className="font-black text-xs uppercase tracking-widest text-gray-500">
            Smart Customer Feedback &amp; Resolution System · Capstone Project
          </p>
        </footer>
      </main>
    </div>
  );
}
