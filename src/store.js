// Simple JSON-file persistence for invoices, voice notes and reconciliations.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.BOLCHALLAN_DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ invoices: [], voiceNotes: [], reconciliations: [] }, null, 2));
  }
}

function read() {
  ensure();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function write(db) {
  ensure();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function nextId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

module.exports = {
  addInvoice(inv) { const db = read(); const rec = { id: nextId('inv'), createdAt: new Date().toISOString(), ...inv }; db.invoices.push(rec); write(db); return rec; },
  listInvoices() { return read().invoices; },
  getInvoice(id) { return read().invoices.find(i => i.id === id); },
  addVoiceNote(note) { const db = read(); const rec = { id: nextId('vn'), createdAt: new Date().toISOString(), ...note }; db.voiceNotes.push(rec); write(db); return rec; },
  updateVoiceNote(id, patch) { const db = read(); const n = db.voiceNotes.find(v => v.id === id); if (n) Object.assign(n, patch); write(db); return n; },
  getVoiceNote(id) { return read().voiceNotes.find(v => v.id === id); },
  addReconciliation(rec) { const db = read(); const r = { id: nextId('rec'), createdAt: new Date().toISOString(), ...rec }; db.reconciliations.push(r); write(db); return r; },
  updateReconciliation(id, patch) {
    const db = read();
    const i = db.reconciliations.findIndex(r => r.id === id);
    if (i === -1) return null;
    db.reconciliations[i] = { ...db.reconciliations[i], ...patch };
    write(db);
    return db.reconciliations[i];
  },
  getReconciliation(id) { return read().reconciliations.find(r => r.id === id); },
  listInvoices() { return read().invoices; },
  listReconciliations() { return read().reconciliations; },
  deleteVoiceNote(id) {
    const db = read();
    const note = db.voiceNotes.find(v => v.id === id);
    db.voiceNotes = db.voiceNotes.filter(v => v.id !== id);
    db.reconciliations = db.reconciliations.filter(r => r.voiceNoteId !== id);
    write(db);
    if (note && note.audioPath && fs.existsSync(note.audioPath)) fs.unlinkSync(note.audioPath);
    return note;
  }
};
