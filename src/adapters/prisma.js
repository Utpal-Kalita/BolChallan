// Gnani Prisma STT adapter (REST transcription).
// DRY-RUN by default: real API calls happen only when GNANI_API_KEY is present in the environment (for example, injected by a secret manager) AND
// GNANI_LIVE=1 is set explicitly. Credit usage is logged per call.
// Docs: https://docs.gnani.ai/api/STT/speech-to-text (REST, 30s max per request)

const fs = require('fs');
const path = require('path');
const https = require('https');

const API_BASE = 'https://api.vachana.ai';
const USAGE_LOG = path.join(__dirname, '..', '..', 'data', 'credit-usage.jsonl');
const HARD_CAP_CREDITS = parseFloat(process.env.GNANI_CREDIT_CAP || '0'); // 0 = no live calls allowed

function logUsage(entry) {
  fs.mkdirSync(path.dirname(USAGE_LOG), { recursive: true });
  fs.appendFileSync(USAGE_LOG, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
}

function totalSpentCredits() {
  if (!fs.existsSync(USAGE_LOG)) return 0;
  return fs.readFileSync(USAGE_LOG, 'utf8').trim().split('\n').filter(Boolean)
    .reduce((sum, line) => sum + (JSON.parse(line).reservedCredits || JSON.parse(line).estimatedCredits || 0), 0);
}

// STT is billed Rs 20/hour of audio = 1 credit per 180 seconds.
function estimateSttCredits(seconds) { return seconds / 180; }

async function transcribe(audioPath, { languageCode = 'hi-IN,en-IN', model = 'prisma-v3.0', filename = null } = {}) {
  if (process.env.GNANI_LIVE !== '1') {
    return { dryRun: true, transcript: null, note: 'GNANI_LIVE not set; no API call made.' };
  }
  if (!Number.isFinite(HARD_CAP_CREDITS) || HARD_CAP_CREDITS <= 0) throw new Error('A finite positive credit cap is required.');
  const key = process.env.GNANI_API_KEY;
  if (!key) throw new Error('Gnani API key not injected (GNANI_API_KEY)');

  const stats = fs.statSync(audioPath);
  // Conservative estimate before call: reject if projected spend exceeds cap.
  const roughSeconds = Math.max(5, Math.min(30, Math.round(stats.size / 16000))); // ~16kB/s speech estimate
  const reservedCredits = 1; // conservative per-request reserve, above full 30s rate
  const projected = totalSpentCredits() + reservedCredits;
  if (projected > HARD_CAP_CREDITS) {
    throw new Error(`Credit hard cap would be exceeded (projected ${projected.toFixed(2)} > ${HARD_CAP_CREDITS})`);
  }

  const audio = fs.readFileSync(audioPath);
  const boundary = '----bolchallan' + Date.now();
  const fields = { language_code: languageCode, model, format: 'transcribe' };
  const ext = path.extname(filename || audioPath).toLowerCase();
  if (!['.wav','.mp3','.m4a','.ogg','.flac','.aac'].includes(ext)) throw new Error('Unsupported audio file extension');
  const safeName = 'delivery' + ext;
  let body = '';
  for (const [k, v] of Object.entries(fields)) {
    body += `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`;
  }
  const head = Buffer.from(body + `--${boundary}\r\nContent-Disposition: form-data; name="audio_file"; filename="${safeName}"\r\nContent-Type: application/octet-stream\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const payload = Buffer.concat([head, audio, tail]);

  logUsage({ service: 'stt-rest', model, reservedCredits, state: 'reserved-before-request' });
  const started = Date.now();
  const result = await new Promise((resolve, reject) => {
    const req = https.request(`${API_BASE}/stt/v3`, {
      method: 'POST',
      headers: {
        'X-API-Key-ID': key,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': payload.length
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });

  let parsed = {};
  try { parsed = JSON.parse(result.body); } catch { parsed = { raw: result.body }; }
  const durationSec = parsed.audio_duration_seconds || roughSeconds;
  logUsage({ service: 'stt-rest', model, audioSeconds: durationSec, estimatedRateCredits: estimateSttCredits(durationSec), status: result.status });
  return { dryRun: false, transcript: parsed.transcript || parsed.text || null, raw: parsed, status: result.status, elapsedMs: Date.now() - started };
}

module.exports = { transcribe, totalSpentCredits, HARD_CAP_CREDITS };
