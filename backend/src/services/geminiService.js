'use strict';

/**
 * Google Gemini Auto-Resolution Service
 *
 * Calls the Gemini REST API (generateContent) to produce a contextual
 * customer-support reply for non-urgent tickets.
 *
 * Required ENV var:
 *   GEMINI_API_KEY  – Get from https://aistudio.google.com/app/apikey (free)
 *
 * Optional ENV vars:
 *   GEMINI_MODEL    – e.g. gemini-2.0-flash  (default)
 *   GEMINI_TIMEOUT  – request timeout in ms  (default: 20000)
 */

const https = require('https');
const { URL } = require('url');

const DEFAULT_MODEL   = 'gemini-2.5-flash';
const DEFAULT_TIMEOUT = 20_000;
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com';

const SYSTEM_INSTRUCTION = `You are a professional, empathetic customer support agent.
Rules:
- Start by acknowledging the customer's concern.
- Provide a clear, actionable resolution or next step.
- Keep the reply under 120 words.
- Never fabricate order IDs, tracking numbers, or company policies.
- End with a polite closing line.`;

/**
 * Generates a customer-support reply using Gemini generateContent.
 *
 * @param {{ subject: string, body: string, customer_name: string }} ticket
 * @returns {Promise<string>} – The generated reply text.
 */
async function generateResolution(ticket) {
  const apiKey     = process.env.GEMINI_API_KEY;
  const model      = process.env.GEMINI_MODEL   || DEFAULT_MODEL;
  const timeoutMs  = Number(process.env.GEMINI_TIMEOUT) || DEFAULT_TIMEOUT;

  if (!apiKey) {
    console.warn('[geminiService] GEMINI_API_KEY not set – using fallback reply.');
    return _fallbackReply(ticket.customer_name);
  }

  const userMessage =
    `Customer name: ${ticket.customer_name}\n` +
    `Subject: ${ticket.subject}\n` +
    `Message: ${ticket.body}\n\n` +
    `Write a professional customer-support response to this ticket.`;

  // ── Build Gemini request body ──────────────────────────────────────────────
  const payload = JSON.stringify({
    system_instruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userMessage }],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 256,
    },
  });

  // Endpoint: POST /v1beta/models/{model}:generateContent?key={apiKey}
  const endpoint = new URL(
    `/v1beta/models/${model}:generateContent?key=${apiKey}`,
    GEMINI_API_BASE
  );

  let rawText;
  try {
    rawText = await _doRequest(endpoint, payload, timeoutMs);
  } catch (err) {
    console.error('[geminiService] Gemini unreachable, using fallback reply.', err.message);
    return _fallbackReply(ticket.customer_name);
  }

  // ── Parse response ─────────────────────────────────────────────────────────
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    console.error('[geminiService] Non-JSON response from Gemini, using fallback.');
    return _fallbackReply(ticket.customer_name);
  }

  // Check for API-level errors (e.g. invalid key, quota exceeded)
  if (parsed?.error) {
    console.error('[geminiService] Gemini API error:', parsed.error.message || parsed.error);
    return _fallbackReply(ticket.customer_name);
  }

  const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    console.error('[geminiService] Unexpected Gemini response shape:', JSON.stringify(parsed).slice(0, 300));
    return _fallbackReply(ticket.customer_name);
  }

  return text.trim();
}

/**
 * Safe pre-written fallback when Gemini is unavailable or misconfigured.
 */
function _fallbackReply(customerName) {
  return (
    `Dear ${customerName || 'Customer'},\n\n` +
    `Thank you for contacting us. We have received your message and a member of our ` +
    `support team will review your case and respond within 1–2 business days.\n\n` +
    `We apologise for any inconvenience caused and appreciate your patience.\n\n` +
    `Best regards,\nCustomer Support Team`
  );
}

/**
 * Low-level HTTPS POST helper (no external dependencies).
 */
function _doRequest(endpoint, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: endpoint.hostname,
      port: 443,
      path: endpoint.pathname + endpoint.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        // 4xx/5xx are still resolved so we can parse the error body
        resolve(data);
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Gemini request timed out after ${timeoutMs}ms.`));
    });

    req.on('error', (err) => {
      reject(new Error(`Gemini network error: ${err.message}`));
    });

    req.write(body);
    req.end();
  });
}

module.exports = { generateResolution };
