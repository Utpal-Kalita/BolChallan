// BolChallan server: invoice -> voice note -> transcription -> deterministic
// extraction/reconciliation -> confirmation -> dashboard/history.
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const store = require('./src/store');
const { extractQuantities } = require('./src/engine/numbers');
const { reconcile, confirmRecord, applyAnswerResolution, reviewBreakdown } = require('./src/engine/reconcile');
const prisma = require('./src/adapters/prisma');
const timbre = require('./src/adapters/timbre');
const { scenarios } = require('./src/simulated');

const app = express();
const PORT = process.env.PORT || 4173;
const upload = multer({ dest: path.join(__dirname, 'data', 'uploads'), limits: { fileSize: 15 * 1024 * 1024 } });

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/audio/:name', (req, res) => {
  if (!/^tts_\d+\.wav$/.test(req.params.name)) return res.sendStatus(404);
  res.sendFile(path.join(__dirname, 'data', req.params.name));
});

app.get('/api/health', (req, res) => res.json({ ok: true, live: process.env.GNANI_LIVE === '1', creditBudgetReservedEstimate: prisma.totalSpentCredits() }));

app.get('/api/scenarios', (req, res) => res.json(scenarios));

app.get('/api/invoices', (req, res) => res.json(store.listInvoices()));

app.post('/api/invoices', (req, res) => {
  const { product, quantity, unit, unitPrice, party } = req.body || {};
  if (!product || typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 0 || (unitPrice != null && (typeof unitPrice !== 'number' || !Number.isFinite(unitPrice) || unitPrice < 0))) return res.status(400).json({ error: 'product and numeric quantity required' });
  const inv = store.addInvoice({ product, quantity, unit: unit || 'unit', unitPrice: typeof unitPrice === 'number' ? unitPrice : null, party: party || null });
  res.json(inv);
});

// Upload a voice note (audio file) with explicit consent, transcribe (live or dry-run), extract + reconcile.
app.post('/api/voice-notes', upload.single('audio'), async (req, res) => {
  const cleanup = () => { if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); };
  try {
    const { invoiceId, consent, transcriptText } = req.body;
    const invoice = store.getInvoice(invoiceId);
    if (!invoice) { cleanup(); return res.status(400).json({ error: 'unknown invoiceId' }); }
    if (consent !== 'yes') { cleanup(); return res.status(400).json({ error: 'recording consent required (consent=yes)' }); }

    let transcript = transcriptText || null;
    let audioPath = req.file ? req.file.path : null;
    let stt = { dryRun: true };
    if (!transcript && audioPath) {
      stt = await prisma.transcribe(audioPath, { filename: req.file.originalname });
      transcript = stt.transcript;
    }
    if (!transcript) {
      cleanup();
      return res.status(stt.dryRun ? 202 : 502).json({ error: 'Transcription did not return usable text. No reconciliation saved.', stt });
    }

    const extraction = extractQuantities(transcript);
    const note = store.addVoiceNote({ invoiceId, audioPath, transcript, consent: true, sttDryRun: !!stt.dryRun, extraction });
    const rec = reconcile(invoice, extraction);
    const saved = store.addReconciliation({ ...rec, voiceNoteId: note.id });
    res.json({ voiceNote: note, reconciliation: saved });
  } catch (e) {
    cleanup();
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Reconcile directly from a transcript (dry-run pipeline test).
app.post('/api/reconcile', (req, res) => {
  const { invoiceId, transcript, consent } = req.body || {};
  if (consent !== 'yes') return res.status(400).json({error:'Consent is required to store transcript data.'});
  const invoice = store.getInvoice(invoiceId);
  if (!invoice) return res.status(400).json({ error: 'unknown invoiceId' });
  if (!transcript) return res.status(400).json({ error: 'transcript required' });
  const extraction = extractQuantities(transcript);
  const note = store.addVoiceNote({ invoiceId, audioPath: null, transcript, consent: true, sttDryRun: true, extraction });
  const rec = reconcile(invoice, extraction);
  const saved = store.addReconciliation({ ...rec, voiceNoteId: note.id });
  res.json({ voiceNote: note, reconciliation: saved });
});

app.get('/api/voice-notes/:id', (req,res) => { const n = store.getVoiceNote(req.params.id); if (!n) return res.sendStatus(404); res.json(n); });

app.get('/api/reconciliations', (req, res) => res.json(store.listReconciliations()));

// Retailer answers a clarification (typed or from a follow-up voice note):
// re-extract from the combined conversation and re-reconcile as a new version.
app.post('/api/reconciliations/:id/resolve', (req, res) => {
  const rec = store.getReconciliation(req.params.id);
  if (!rec) return res.status(404).json({ error: 'not found' });
  const { answerText } = req.body || {};
  if (!answerText) return res.status(400).json({ error: 'answerText required' });
  const invoice = store.getInvoice(rec.invoiceId);
  if (!invoice) return res.status(400).json({ error: 'invoice missing' });
  const note = store.getVoiceNote(rec.voiceNoteId);
  const combined = ((note && note.transcript) || '') + ' . ' + answerText;
  const extraction = extractQuantities(combined);
  store.updateVoiceNote(rec.voiceNoteId, {transcript: combined, extraction});
  const raw = reconcile(invoice, extraction);
  const next = applyAnswerResolution(rec, raw, answerText);
  const saved = store.updateReconciliation(rec.id, { ...next, id: rec.id, createdAt: rec.createdAt, version: (rec.version || 1) + 1, voiceNoteId: rec.voiceNoteId, clarificationAnswer: answerText });
  res.json({ reconciliation: saved, extraction });
});

app.post('/api/reconciliations/:id/review', (req, res) => {
  const rec = store.getReconciliation(req.params.id);
  if (!rec) return res.sendStatus(404);
  try { res.json({reconciliation: store.updateReconciliation(rec.id, reviewBreakdown(rec, req.body))}); }
  catch(e) { res.status(400).json({error: e.message}); }
});

app.post('/api/reconciliations/:id/confirm', (req, res) => {
  const rec = store.getReconciliation(req.params.id);
  if (!rec) return res.status(404).json({ error: 'not found' });
  const note = store.getVoiceNote(rec.voiceNoteId);
  const extraction = note ? note.extraction : { statements: [] };
  const result = confirmRecord(rec, (req.body && req.body.confirmationText) || '', extraction);
  const saved = store.updateReconciliation(rec.id, result.record);
  res.json({ confirmed: result.confirmed, reason: result.reason || null, reconciliation: saved });
});

// Spoken confirmation prompt via Timbre (dry-run unless GNANI_LIVE=1).
app.post('/api/reconciliations/:id/confirmation-audio', async (req, res) => {
  const rec = store.getReconciliation(req.params.id);
  if (!rec) return res.status(404).json({ error: 'not found' });
  const q = rec.clarifications[0];
  const text = q ? q.question : `Invoice ${rec.invoiced.quantity} ${rec.invoiced.unit}, received ${rec.extracted.received}, damaged ${rec.extracted.damaged}. Confirm karein?`;
  try {
    const out = await timbre.synthesize(text, {});
    res.json({ text, ...out, audioUrl: out.audioPath ? '/api/audio/' + path.basename(out.audioPath) : null });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Delete a voice note and its audio file (participant data control).
app.delete('/api/voice-notes/:id', (req, res) => {
  const note = store.deleteVoiceNote(req.params.id);
  if (!note) return res.status(404).json({ error: 'not found' });
  res.json({ deleted: true, id: req.params.id });
});

app.listen(PORT, '127.0.0.1', () => console.log(`BolChallan listening on http://localhost:${PORT}`));
