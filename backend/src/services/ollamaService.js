'use strict';

/**
 * Ollama Auto-Resolution Service
 *
 * Sends ticket context to a local Ollama instance and streams back
 * a contextual customer-service reply.
 *
 * Required ENV vars:
 *   OLLAMA_BASE_URL  – e.g. http://localhost:11434  (default)
 *   OLLAMA_MODEL     – e.g. llama3 or qwen3 (default: llama3)
 *   OLLAMA_TIMEOUT   – request timeout in ms (default: 30000)
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3';
const DEFAULT_TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You are a helpful, professional customer support agent.
Your job is to resolve customer complaints concisely and empathetically.
Always:
- Acknowledge the customer's concern in the first sentence.
- Provide a clear, actionable resolution or next step.
- Keep the reply under 120 words.
- Never make up tracking numbers, order IDs, or policies.
- End with a polite closing.`;

/**
 * Generates an auto-resolution reply via Ollama's /api/generate endpoint.
 *
 * @param {{ subject: string, body: string, customer_name: string }} ticket
 * @returns {Promise<string>} – The generated reply text.
 */
async function generateResolution(ticket) {
  const baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.OLLAMA_MODEL || DEFAULT_MODEL;
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT) || DEFAULT_TIMEOUT_MS;

  const userPrompt = `Customer name: ${ticket.customer_name}
Subject: ${ticket.subject}
Message: ${ticket.body}

Write a professional customer-support response to this ticket.`;

  const payload = JSON.stringify({
    model,
    prompt: userPrompt,
    system: SYSTEM_PROMPT,
    stream: false,
    options: {
      temperature: 0.4,
      num_predict: 256,
    },
  });

  const endpoint = new URL('/api/generate', baseUrl);

  let rawText;
  try {
    rawText = await _doRequest(endpoint, payload, timeoutMs);
  } catch (err) {
    // ── Graceful fallback ──────────────────────────────────────────────────────
    console.error('[ollamaService] Ollama unreachable, using fallback reply.', err.message);
    return _fallbackReply(ticket.customer_name);
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    console.error('[ollamaService] Non-JSON response from Ollama, using fallback.');
    return _fallbackReply(ticket.customer_name);
  }

  if (!parsed?.response) {
    console.error('[ollamaService] Unexpected Ollama response shape, using fallback.', parsed);
    return _fallbackReply(ticket.customer_name);
  }

  return parsed.response.trim();
}

/**
 * Returns a safe pre-written fallback message when Ollama is unavailable.
 */
function _fallbackReply(customerName) {
  return (
    `Dear ${customerName || 'Customer'},\n\n` +
    `Thank you for reaching out to us. We have received your message and a member of our ` +
    `support team will review your case and get back to you within 1–2 business days.\n\n` +
    `We apologise for any inconvenience caused.\n\n` +
    `Best regards,\nCustomer Support Team`
  );
}

/**
 * Low-level HTTP/HTTPS request helper.
 */
function _doRequest(endpoint, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const isHttps = endpoint.protocol === 'https:';
    const transport = isHttps ? https : http;

    const options = {
      hostname: endpoint.hostname,
      port: endpoint.port || (isHttps ? 443 : 80),
      path: endpoint.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = transport.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`Ollama responded with HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
        resolve(data);
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Ollama request timed out after ${timeoutMs}ms.`));
    });

    req.on('error', (err) => {
      reject(new Error(`Ollama network error: ${err.message}`));
    });

    req.write(body);
    req.end();
  });
}

module.exports = { generateResolution };
