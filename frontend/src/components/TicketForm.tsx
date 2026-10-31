import { useState } from 'react';
import { useSubmitTicket } from '../hooks/useSubmitTicket';
import type { CreateTicketResponse } from '../types';

interface TicketFormProps {
  onSuccess?: (result: CreateTicketResponse) => void;
}

export function TicketForm({ onSuccess }: TicketFormProps) {
  const { submit, loading, error, result, reset } = useSubmitTicket();

  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    subject: '',
    body: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await submit(form);
      onSuccess?.(res);
      setForm({ customer_name: '', customer_email: '', subject: '', body: '' });
    } catch {
      // error is captured in hook state
    }
  };

  if (result) {
    const isEscalated = result.escalated;
    const isResolved = result.ticket.auto_resolved;
    return (
      <div className="border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] bg-white p-6">
        <div
          className={`border-4 border-black p-4 mb-4 font-black text-center text-lg uppercase ${
            isEscalated ? 'bg-red-500 text-white' : isResolved ? 'bg-green-400 text-black' : 'bg-yellow-300 text-black'
          }`}
        >
          {isEscalated ? '🚨 Escalated to Human Agent' : isResolved ? '✅ Auto-Resolved' : '📋 Ticket Queued'}
        </div>

        {result.emotion && (
          <p className="text-sm font-bold uppercase mb-2">
            Detected Emotion:{' '}
            <span className="bg-black text-white px-2 py-0.5">
              {result.emotion.dominant_emotion}
            </span>
          </p>
        )}

        {result.resolution && (
          <div className="border-4 border-black bg-yellow-50 p-4 mt-3">
            <p className="font-black text-xs uppercase mb-2">Auto-Generated Response:</p>
            <p className="text-sm whitespace-pre-wrap">{result.resolution}</p>
          </div>
        )}

        {result.warning && (
          <p className="text-xs text-orange-700 font-bold mt-2 border-2 border-orange-400 p-2">
            ⚠ {result.warning}
          </p>
        )}

        <button
          onClick={reset}
          className="mt-4 w-full bg-black text-white font-black uppercase py-3 px-4 border-4 border-black hover:bg-white hover:text-black transition-colors cursor-pointer"
        >
          Submit Another Ticket
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] bg-white p-6 flex flex-col gap-4"
    >
      <h2 className="font-black text-xl uppercase tracking-widest border-b-4 border-black pb-3">
        Submit a Complaint
      </h2>

      {error && (
        <div className="bg-red-500 text-white border-4 border-black p-3 font-bold text-sm">
          ✕ {error}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="font-black text-xs uppercase tracking-widest">Name *</label>
        <input
          type="text"
          name="customer_name"
          value={form.customer_name}
          onChange={handleChange}
          required
          placeholder="Jane Doe"
          className="border-4 border-black px-3 py-2 font-medium text-sm focus:outline-none focus:bg-yellow-50"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-black text-xs uppercase tracking-widest">Email *</label>
        <input
          type="email"
          name="customer_email"
          value={form.customer_email}
          onChange={handleChange}
          required
          placeholder="jane@example.com"
          className="border-4 border-black px-3 py-2 font-medium text-sm focus:outline-none focus:bg-yellow-50"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-black text-xs uppercase tracking-widest">Subject *</label>
        <input
          type="text"
          name="subject"
          value={form.subject}
          onChange={handleChange}
          required
          placeholder="Order not received"
          className="border-4 border-black px-3 py-2 font-medium text-sm focus:outline-none focus:bg-yellow-50"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-black text-xs uppercase tracking-widest">Message *</label>
        <textarea
          name="body"
          value={form.body}
          onChange={handleChange}
          required
          rows={5}
          placeholder="Describe your issue in detail..."
          className="border-4 border-black px-3 py-2 font-medium text-sm focus:outline-none focus:bg-yellow-50 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-black text-white font-black uppercase py-3 px-4 border-4 border-black hover:bg-yellow-300 hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm tracking-widest"
      >
        {loading ? 'Analysing…' : 'Submit Ticket →'}
      </button>
    </form>
  );
}
