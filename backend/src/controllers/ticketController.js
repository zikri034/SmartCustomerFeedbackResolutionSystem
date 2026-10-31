'use strict';

const db = require('../db');
const { analyzeEmotion, shouldEscalate } = require('../services/geminiEmotionService');
const { generateResolution } = require('../services/geminiService');

/**
 * POST /api/tickets
 * Creates a new ticket, runs emotion analysis, and optionally auto-resolves it.
 */
async function createTicket(req, res, next) {
  const { customer_name, customer_email, subject, body } = req.body;

  if (!customer_name || !customer_email || !subject || !body) {
    return res.status(400).json({ error: 'Fields customer_name, customer_email, subject, and body are required.' });
  }

  const trx = await db.transaction();
  try {
    // 1. Insert ticket (initial status: open)
    const [ticket] = await trx('tickets')
      .insert({ customer_name, customer_email, subject, body })
      .returning('*');

    // 2. Gemini Emotion Analysis
    let emotionResult;
    try {
      emotionResult = await analyzeEmotion(body);
    } catch (emotionErr) {
      console.error('[ticketController] Gemini emotion analysis failed:', emotionErr.message);
      // Simpan tiket tetap berhasil meski analisis emosi gagal
      await trx.commit();
      return res.status(201).json({
        ticket,
        emotion: null,
        warning: 'Emotion analysis unavailable; ticket saved as open.',
      });
    }

    // 3. Persist emotion log
    const [emotionLog] = await trx('emotion_logs')
      .insert({
        ticket_id: ticket.id,
        dominant_emotion: emotionResult.dominant_emotion,
        anger_score: emotionResult.anger,
        disgust_score: emotionResult.disgust,
        fear_score: emotionResult.fear,
        joy_score: emotionResult.joy,
        sadness_score: emotionResult.sadness,
        raw_watson_response: JSON.stringify(emotionResult.raw),
      })
      .returning('*');

    // 4. Escalation vs auto-resolution logic
    const escalate = shouldEscalate(emotionResult);

    let updatedTicket = ticket;
    let resolutionText = null;

    if (escalate) {
      // Mark as escalated – human agent required
      [updatedTicket] = await trx('tickets')
        .where({ id: ticket.id })
        .update({ status: 'escalated', priority: 'critical' })
        .returning('*');
    } else if (['neutral', 'joy'].includes(emotionResult.dominant_emotion)) {
      // Attempt Gemini auto-resolution
      resolutionText = await generateResolution({ customer_name, subject, body });
      [updatedTicket] = await trx('tickets')
        .where({ id: ticket.id })
        .update({ status: 'resolved', auto_resolved: true, resolution_text: resolutionText })
        .returning('*');
    }

    await trx.commit();

    return res.status(201).json({
      ticket: updatedTicket,
      emotion: emotionLog,
      resolution: resolutionText,
      escalated: escalate,
    });
  } catch (err) {
    await trx.rollback();
    next(err);
  }
}

/**
 * GET /api/tickets
 * Returns paginated list of tickets with optional status/priority filters.
 */
async function listTickets(req, res, next) {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const query = db('tickets').orderBy('created_at', 'desc');
    if (status) query.where({ status });
    if (priority) query.where({ priority });

    const [{ count }] = await db('tickets').count('id as count').modify((q) => {
      if (status) q.where({ status });
      if (priority) q.where({ priority });
    });

    const tickets = await query.limit(Number(limit)).offset(offset);

    return res.json({
      data: tickets,
      meta: {
        total: Number(count),
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(Number(count) / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tickets/:id
 * Returns a single ticket with its emotion log.
 */
async function getTicket(req, res, next) {
  try {
    const ticket = await db('tickets').where({ id: req.params.id }).first();
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

    const emotionLog = await db('emotion_logs').where({ ticket_id: ticket.id }).orderBy('created_at', 'desc').first();

    return res.json({ ticket, emotion: emotionLog || null });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/tickets/:id/status
 * Manually update ticket status (e.g., human agent resolution).
 */
async function updateTicketStatus(req, res, next) {
  try {
    const { status, resolution_text } = req.body;
    const allowedStatuses = ['open', 'in_progress', 'resolved', 'escalated'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${allowedStatuses.join(', ')}` });
    }

    const [updated] = await db('tickets')
      .where({ id: req.params.id })
      .update({ status, ...(resolution_text ? { resolution_text } : {}), updated_at: db.fn.now() })
      .returning('*');

    if (!updated) return res.status(404).json({ error: 'Ticket not found.' });

    return res.json({ ticket: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tickets/metrics
 * Returns aggregate counts used by the dashboard.
 */
async function getMetrics(req, res, next) {
  try {
    const statusCounts = await db('tickets')
      .select('status')
      .count('id as count')
      .groupBy('status');

    const emotionCounts = await db('emotion_logs')
      .select('dominant_emotion')
      .count('id as count')
      .groupBy('dominant_emotion');

    const priorityCounts = await db('tickets')
      .select('priority')
      .count('id as count')
      .groupBy('priority');

    const [{ total }] = await db('tickets').count('id as total');
    const [{ auto_resolved_count }] = await db('tickets')
      .count('id as auto_resolved_count')
      .where({ auto_resolved: true });

    return res.json({
      total: Number(total),
      auto_resolved: Number(auto_resolved_count),
      by_status: Object.fromEntries(statusCounts.map((r) => [r.status, Number(r.count)])),
      by_emotion: Object.fromEntries(emotionCounts.map((r) => [r.dominant_emotion, Number(r.count)])),
      by_priority: Object.fromEntries(priorityCounts.map((r) => [r.priority, Number(r.count)])),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { createTicket, listTickets, getTicket, updateTicketStatus, getMetrics };
