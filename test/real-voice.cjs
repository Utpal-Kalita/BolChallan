// Optional manual check with a user-supplied sample voice note (audio is NOT
// included in this repository). Place a WAV at data/sample-voice.wav or set
// SAMPLE_VOICE to its path, then run with live credentials:
//   GNANI_LIVE=1 GNANI_CREDIT_CAP=25 GNANI_API_KEY=<your key> node test/real-voice.cjs
// The sample audio stays local; only the transcription result is written.
const fs = require('fs');
const path = require('path');
const prisma = require('../src/adapters/prisma');
const { extractQuantities } = require('../src/engine/numbers');
const sample = process.env.SAMPLE_VOICE || path.join(__dirname, '..', 'data', 'sample-voice.wav');
(async () => {
  if (!fs.existsSync(sample)) { console.error('Sample audio not found:', sample); process.exit(2); }
  const stt = await prisma.transcribe(sample, { filename: path.basename(sample) });
  const out = { sttStatus: stt.status, elapsedMs: stt.elapsedMs, transcript: stt.transcript };
  if (stt.transcript) {
    const ex = extractQuantities(stt.transcript);
    out.statements = ex.statements.map(s => ({ role: s.role, value: s.value, unit: s.unit, confusable: s.confusable, raw: s.raw }));
    out.ambiguities = ex.ambiguities;
  }
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'real-voice-result.json'), JSON.stringify({ ts: new Date().toISOString(), ...out }, null, 1));
  console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error(String(e.message || e)); process.exit(1); });
