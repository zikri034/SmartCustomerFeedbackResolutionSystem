'use strict';

/**
 * Watson NLP Emotion Analysis Service
 *
 * Uses IBM Watson Natural Language Understanding (NLU) REST API
 * to run emotion detection on incoming ticket text.
 *
 * Required ENV vars:
 *   WATSON_NLU_API_KEY   – IAM API key from IBM Cloud
 *   WATSON_NLU_URL       – Service instance URL (e.g. https://api.us-south.natural-language-understanding.watson.cloud.ibm.com)
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

const WATSON_VERSION = '2022-04-07';
const REQUEST_TIMEOUT_MS = 10_000; // 10 s

/**
 * Calls IBM Watson NLU and returns structured emotion scores.
 *
 * @param {string} text – Raw ticket body text to analyse.
 * @returns {Promise<{
 *   dominant_emotion: string,
 *   anger: number,
 *   disgust: number,
 *   fear: number,
 *   joy: number,
 *   sadness: number,
 *   raw: object
 * }>}
 */
async function analyzeEmotion(text) {
  const apiKey = process.env.WATSON_NLU_API_KEY;
  const serviceUrl = process.env.WATSON_NLU_URL;

  if (!apiKey || !serviceUrl) {
    throw new Error('Watson NLU credentials are not configured (WATSON_NLU_API_KEY / WATSON_NLU_URL).');
  }

  const endpoint = new URL(`/v1/analyze?version=${WATSON_VERSION}`, serviceUrl);

  const payload = JSON.stringify({
    text,
    features: {
      emotion: { document: true },
    },
    language: 'en',
  });

  const rawResponse = await _doRequest(endpoint, apiKey, payload);

  // ── Parse Watson response ──────────────────────────────────────────────────
  const emotions = rawResponse?.emotion?.document?.emotion;
  if (!emotions) {
    throw new Error('Watson NLU returned an unexpected response shape.');
  }

  const { anger = 0, disgust = 0, fear = 0, joy = 0, sadness = 0 } = emotions;

  // Determine dominant emotion; if all scores are very low treat as neutral
  const scores = { anger, disgust, fear, joy, sadness };
  const maxScore = Math.max(...Object.values(scores));
  const dominant_emotion =
    maxScore < 0.15 ? 'neutral' : Object.keys(scores).find((k) => scores[k] === maxScore);

  return {
    dominant_emotion,
    anger,
    disgust,
    fear,
    joy,
    sadness,
    raw: rawResponse,
  };
}

/**
 * Low-level HTTPS request helper (no external deps).
 * Falls back gracefully with a structured error on network failure or timeout.
 */
function _doRequest(endpoint, apiKey, body) {
  return new Promise((resolve, reject) => {
    const isHttps = endpoint.protocol === 'https:';
    const transport = isHttps ? https : http;

    const options = {
      hostname: endpoint.hostname,
      port: endpoint.port || (isHttps ? 443 : 80),
      path: endpoint.pathname + endpoint.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Authorization: `Basic ${Buffer.from(`apikey:${apiKey}`).toString('base64')}`,
      },
    };

    const req = transport.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            const errMsg = parsed?.error || parsed?.description || `HTTP ${res.statusCode}`;
            return reject(new Error(`Watson NLU error: ${errMsg}`));
          }
          resolve(parsed);
        } catch {
          reject(new Error(`Watson NLU returned non-JSON response (status ${res.statusCode}).`));
        }
      });
    });

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('Watson NLU request timed out after 10 seconds.'));
    });

    req.on('error', (err) => {
      reject(new Error(`Watson NLU network error: ${err.message}`));
    });

    req.write(body);
    req.end();
  });
}

/**
 * Determines whether an emotion result should trigger escalation.
 * Escalate when dominant emotion is anger/fear/disgust OR any score > 0.75.
 *
 * @param {{ dominant_emotion: string, anger: number, fear: number, disgust: number }} emotionResult
 * @returns {boolean}
 */
function shouldEscalate(emotionResult) {
  const urgentEmotions = new Set(['anger', 'fear', 'disgust']);
  if (urgentEmotions.has(emotionResult.dominant_emotion)) return true;
  if (emotionResult.anger > 0.75 || emotionResult.fear > 0.75 || emotionResult.disgust > 0.75) return true;
  return false;
}

module.exports = { analyzeEmotion, shouldEscalate };
