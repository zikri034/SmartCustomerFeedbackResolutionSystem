'use strict';

/**
 * Gemini Emotion Analysis Service
 *
 * Menggantikan Watson NLU untuk mendeteksi emosi dari teks tiket.
 * Menggunakan Gemini dengan JSON output mode — menghasilkan skor emosi
 * yang identik dengan format Watson NLU agar controller tidak perlu diubah.
 *
 * Menggunakan ENV var yang SAMA dengan geminiService.js:
 *   GEMINI_API_KEY  – dari https://aistudio.google.com/app/apikey
 *   GEMINI_MODEL    – default: gemini-2.0-flash
 *   GEMINI_TIMEOUT  – default: 20000 ms
 */

const https = require('https');
const { URL } = require('url');

const DEFAULT_MODEL   = 'gemini-2.5-flash';
const DEFAULT_TIMEOUT = 20_000;
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com';

// Instruksi sistem: minta Gemini menghasilkan JSON skor emosi yang terstruktur
const EMOTION_SYSTEM_PROMPT = `You are an emotion scoring API. Respond with ONLY this JSON, no other text:
{"anger":0.0,"disgust":0.0,"fear":0.0,"joy":0.0,"sadness":0.0}
Fill each value (0.0–1.0) based on the emotional tone of the customer message.`;

/**
 * Menganalisis emosi dari teks tiket menggunakan Gemini.
 * Return shape identik dengan watsonService.analyzeEmotion().
 *
 * @param {string} text
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
  const apiKey    = process.env.GEMINI_API_KEY;
  const model     = process.env.GEMINI_MODEL   || DEFAULT_MODEL;
  const timeoutMs = Number(process.env.GEMINI_TIMEOUT) || DEFAULT_TIMEOUT;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY tidak dikonfigurasi di file .env');
  }

  const payload = JSON.stringify({
    system_instruction: {
      parts: [{ text: EMOTION_SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: `Customer message: "${text}"\n\nJSON:` }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 256,
      // responseMimeType sengaja tidak dipakai — menyebabkan double-encoding pada 2.5-flash
    },
  });

  const endpoint = new URL(
    `/v1beta/models/${model}:generateContent?key=${apiKey}`,
    GEMINI_API_BASE
  );

  const rawText = await _doRequest(endpoint, payload, timeoutMs);

  // ── Parse respons Gemini ────────────────────────────────────────────────────
  let geminiResponse;
  try {
    geminiResponse = JSON.parse(rawText);
  } catch {
    throw new Error('Gemini mengembalikan respons non-JSON.');
  }

  // Tangkap error level API (mis. quota habis, key invalid)
  if (geminiResponse?.error) {
    throw new Error(`Gemini API error: ${geminiResponse.error.message || JSON.stringify(geminiResponse.error)}`);
  }

  const jsonText = geminiResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!jsonText) {
    throw new Error('Gemini mengembalikan respons dengan struktur tidak terduga.');
  }

  // Gemini dengan responseMimeType:'application/json' kadang mengembalikan
  // string JSON yang di-double-encode (mis. "{\"anger\":0.9,...}").
  // Coba parse dulu; jika hasilnya masih string, parse sekali lagi.
  let scores;
  try {
    const firstParse = JSON.parse(jsonText);
    scores = typeof firstParse === 'string' ? JSON.parse(firstParse) : firstParse;
  } catch {
    // Fallback: ekstrak objek JSON dari dalam teks bebas
    const jsonMatch = jsonText.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      throw new Error(`Gemini tidak mengembalikan JSON emosi yang valid: ${jsonText.slice(0, 120)}`);
    }
    try {
      scores = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error(`Gagal parse JSON dari Gemini: ${jsonMatch[0].slice(0, 100)}`);
    }
  }

  // Normalisasi — pastikan semua field ada dan berupa angka
  const anger   = Number(scores.anger   ?? 0);
  const disgust = Number(scores.disgust ?? 0);
  const fear    = Number(scores.fear    ?? 0);
  const joy     = Number(scores.joy     ?? 0);
  const sadness = Number(scores.sadness ?? 0);

  // Tentukan emosi dominan; jika semua rendah → neutral
  const emotionScores = { anger, disgust, fear, joy, sadness };
  const maxScore = Math.max(...Object.values(emotionScores));
  const dominant_emotion =
    maxScore < 0.15
      ? 'neutral'
      : Object.keys(emotionScores).find((k) => emotionScores[k] === maxScore);

  return {
    dominant_emotion,
    anger,
    disgust,
    fear,
    joy,
    sadness,
    raw: geminiResponse,
  };
}

/**
 * Menentukan apakah tiket perlu dieskalasi ke agen manusia.
 * Logic identik dengan watsonService.shouldEscalate().
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

/**
 * Low-level HTTPS POST helper.
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
      res.on('end', () => resolve(data));
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Gemini emotion request timed out after ${timeoutMs}ms.`));
    });

    req.on('error', (err) => {
      reject(new Error(`Gemini network error: ${err.message}`));
    });

    req.write(body);
    req.end();
  });
}

module.exports = { analyzeEmotion, shouldEscalate };
