// Gnani Timbre TTS adapter (REST synthesis) for spoken confirmation prompts.
// DRY-RUN by default: real API calls only when GNANI_LIVE=1 and credentials
// are injected via the environment (for example, by a secret manager). Billed Rs 18 per 10,000 characters.
// Docs: https://docs.gnani.ai/api/TTS (Timbre v2.5/v3.0)

const fs = require('fs');
const path = require('path');
const https = require('https');

const API_BASE = 'https://api.vachana.ai';
const USAGE_LOG = path.join(__dirname, '..', '..', 'data', 'credit-usage.jsonl');
const HARD_CAP_CREDITS = parseFloat(process.env.GNANI_CREDIT_CAP || '0');

function logUsage(entry) {
  fs.mkdirSync(path.dirname(USAGE_LOG), { recursive: true });
  fs.appendFileSync(USAGE_LOG, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
}

function totalSpentCredits() {
  if (!fs.existsSync(USAGE_LOG)) return 0;
  return fs.readFileSync(USAGE_LOG, 'utf8').trim().split('\n').filter(Boolean)
    .reduce((sum, line) => sum + (JSON.parse(line).reservedCredits || JSON.parse(line).estimatedCredits || 0), 0);
}

function estimateTtsCredits(chars) { return (chars / 10000) * 18; }

async function synthesize(text, { languageCode = 'hi-IN', voice = null, model = 'timbre-v3.0' } = {}) {
  if (process.env.GNANI_LIVE !== '1') {
    return { dryRun: true, audioPath: null, note: 'GNANI_LIVE not set; no API call made.' };
  }
  if (!Number.isFinite(HARD_CAP_CREDITS) || HARD_CAP_CREDITS <= 0) throw new Error('A finite positive credit cap is required.');
  const key = process.env.GNANI_API_KEY;
  if (!key) throw new Error('Gnani API key not injected (GNANI_API_KEY)');

  if (typeof text !== 'string' || text.length < 1 || text.length > 800) throw new Error('TTS text must contain 1 to 800 characters.');
  const reservedCredits = Math.max(1, Math.ceil(estimateTtsCredits(text.length)));
  const projected = totalSpentCredits() + reservedCredits;
  if (projected > HARD_CAP_CREDITS) {
    throw new Error(`Credit hard cap would be exceeded (projected ${projected.toFixed(2)} > ${HARD_CAP_CREDITS})`);
  }

  const body = JSON.stringify({
    text, voice: voice || 'Avinash', model, language: languageCode, speed: 1.0,
    audio_config: { sample_rate: 16000, num_channels: 1, sample_width: 2, encoding: 'linear_pcm', container: 'wav' }
  });
  logUsage({ service: 'tts-rest', model, reservedCredits, state: 'reserved-before-request' });
  const result = await new Promise((resolve, reject) => {
    const req = https.request(`${API_BASE}/api/v1/tts/inference`, {
      method: 'POST',
      headers: {
        'X-API-Key-ID': key,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks), contentType: res.headers['content-type'] }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  logUsage({ service: 'tts-rest', model, chars: text.length, estimatedRateCredits: estimateTtsCredits(text.length), status: result.status });
  let audioPath = null;
  if (result.status === 200 && result.contentType && result.contentType.includes('audio')) {
    audioPath = path.join(__dirname, '..', '..', 'data', `tts_${Date.now()}.wav`);
    fs.writeFileSync(audioPath, result.body);
  }
  return { dryRun: false, audioPath, status: result.status };
}

module.exports = { synthesize, totalSpentCredits };
