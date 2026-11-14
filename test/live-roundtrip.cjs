// Live synthetic round-trip: TTS (Timbre) -> STT (Prisma) -> deterministic extraction.
// Bounded: 5 phrases, 10 metered calls max, cap enforced by the adapters.
// Run: GNANI_LIVE=1 GNANI_CREDIT_CAP=12 GNANI_API_KEY=<your key> node test/live-roundtrip.cjs
const fs = require('fs');
const path = require('path');
const timbre = require('../src/adapters/timbre');
const prisma = require('../src/adapters/prisma');
const { extractQuantities } = require('../src/engine/numbers');

const CASES = [
  { id: 'dev-short-damage', lang: 'hi-IN',
    text: 'बीस पैकेट भेजे थे, लेकिन दुकान वाले ने अठारह रिसीव किया, दो पैकेट डैमेज थे।',
    expect: { sent: 20, received: 18, damaged: 2 } },
  { id: 'dev-clean-kg', lang: 'hi-IN',
    text: 'पचास किलो चावल भेजा था और दुकान पर पचास किलो मिला।',
    expect: { sent: 50, received: 50 } },
  { id: 'dev-confusable', lang: 'hi-IN',
    text: 'पंद्रह कार्टन भेजे थे, दुकान ने बोला पचास आए।',
    expect: { sent: 15, received: 50 } },
  { id: 'hinglish-shortage', lang: 'hi-IN',
    text: 'Tees kilo dal bheji thi, pachis kilo receive hui.',
    expect: { sent: 30, received: 25 } },
  { id: 'english-short-damage', lang: 'en-IN',
    text: 'Twenty boxes sent, eighteen received, two damaged.',
    expect: { sent: 20, received: 18, damaged: 2 } }
];

function got(extraction) {
  const by = { sent: null, received: null, damaged: null };
  for (const s of (extraction && extraction.statements) || []) {
    if (s.superseded) continue;
    if (s.role in by && by[s.role] === null) by[s.role] = s.value;
  }
  return by;
}

(async () => {
  const results = [];
  for (const c of CASES) {
    const r = { id: c.id, intended: c.expect, inputText: c.text };
    try {
      const tts = await timbre.synthesize(c.text, { languageCode: c.lang });
      r.ttsStatus = tts.status;
      if (!tts.audioPath) { r.error = 'tts-no-audio'; results.push(r); continue; }
      r.audioSeconds = Math.round(fs.statSync(tts.audioPath).size / 32) / 1000;
      const stt = await prisma.transcribe(tts.audioPath, { filename: c.id + '.wav' });
      r.sttStatus = stt.status;
      r.elapsedMs = stt.elapsedMs;
      r.transcript = stt.transcript;
      fs.unlinkSync(tts.audioPath); // dev artifact cleanup per README
      if (stt.transcript) {
        const extraction = extractQuantities(stt.transcript);
        r.extraction = got(extraction);
        r.confusables = (extraction.statements || []).filter(s => s.confusable).map(s => s.raw);
        r.fieldsCorrect = Object.keys(c.expect).filter(k => r.extraction[k] === c.expect[k]).length;
        r.fieldsTotal = Object.keys(c.expect).length;
      }
    } catch (e) { r.error = String(e.message || e).slice(0, 200); }
    results.push(r);
  }
  fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'roundtrip-results.json'), JSON.stringify({ ts: new Date().toISOString(), results }, null, 1));
  for (const r of results) console.log(JSON.stringify(r));
  console.log('TOTAL RESERVED CREDITS (app-side conservative):', prisma.totalSpentCredits());
})().catch(e => { console.error('FATAL', e); process.exit(1); });
