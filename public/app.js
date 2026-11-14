let currentRec = null;

async function api(path, opts) {
  const res = await fetch(path, opts);
  return res.json();
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function fmtDate(iso) {
  try { return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return ''; }
}

function statusBadge(status) {
  return `<span class="status status-${esc(status)}">${esc(status.replace(/-/g, ' '))}</span>`;
}

async function refreshInvoices() {
  const invs = await api('/api/invoices');
  const sel = document.getElementById('vn-invoice');
  sel.innerHTML = invs.map(i => `<option value="${i.id}">${esc(i.product)} - ${i.quantity} ${esc(i.unit)} (${esc(i.party || 'party?')})</option>`).join('');
  document.getElementById('invoice-list').innerHTML = invs.map(i =>
    `<li><strong>${esc(i.product)}</strong><span>${i.quantity} ${esc(i.unit)} @ Rs ${i.unitPrice ?? '?'}${i.party ? ' - ' + esc(i.party) : ''}</span></li>`).join('');
}

async function refreshHistory() {
  const recs = await api('/api/reconciliations');
  document.getElementById('history-list').innerHTML = recs.map(r => {
    const qty = r.invoiced.quantity;
    const unit = esc(r.invoiced.unit);
    const recv = r.extracted.received ?? '?';
    const dmg = r.extracted.damaged ?? 0;
    const money = r.amountFinal
      ? `<span class="final">due Rs ${r.amountDue ?? '?'}</span>`
      : `<span class="pending">amount pending clarification</span>`;
    return `<li>
      <strong>${esc(r.product)}</strong> ${statusBadge(r.status)}
      <span>invoiced ${qty} ${unit} - received ${recv} - damaged ${dmg} - ${money}</span>
      <span class="muted">${fmtDate(r.createdAt)}</span>
      <span class="spacer"></span>
      <button class="danger" data-del-vn="${esc(r.voiceNoteId || '')}">Delete recording &amp; record</button>
    </li>`;
  }).join('');
  document.querySelectorAll('[data-del-vn]').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-del-vn');
      if (!id) { alert('No recording attached to this entry.'); return; }
      if (!confirm('Delete this recording, transcript and reconciliation permanently?')) return;
      await api(`/api/voice-notes/${id}`, { method: 'DELETE' });
      currentRec = null;
      document.getElementById('result-section').hidden = true;
      refreshHistory();
    };
  });
}

document.getElementById('create-invoice').onclick = async () => {
  const body = {
    product: document.getElementById('inv-product').value.trim(),
    quantity: parseFloat(document.getElementById('inv-qty').value),
    unit: document.getElementById('inv-unit').value.trim() || 'unit',
    unitPrice: parseFloat(document.getElementById('inv-price').value) || null,
    party: document.getElementById('inv-party').value.trim() || null
  };
  const out = await api('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (out.error) { alert(out.error); return; }
  refreshInvoices();
};

let scenarioIdx = 0;
document.getElementById('load-scenario').onclick = async () => {
  const scenarios = await api('/api/scenarios');
  const pick = scenarios[scenarioIdx % scenarios.length];
  scenarioIdx++;
  document.getElementById('vn-transcript').value = pick.transcript;
  document.getElementById('load-scenario').textContent = 'Load demo scenario (' + pick.label.slice(0, 28) + '...)';
};

function explanation(r) {
  const parts = [];
  const unit = esc(r.invoiced.unit);
  if (r.extracted.received !== null) {
    parts.push(`${r.review ? 'Verified breakdown: received' : 'Unverified interpretation: received'} ${r.extracted.received} ${unit} total` + (r.extracted.damaged > 0 ? `, of which ${r.extracted.damaged} damaged, so ${r.goodUnits} payable` : `, all payable`));
  }
  if (r.shortage > 0) parts.push(`${r.shortage} ${unit} short vs invoice`);
  if (r.shortage < 0) parts.push(`${Math.abs(r.shortage)} ${unit} MORE than invoice - needs confirmation`);
  if (r.amountFinal && r.amountDue !== null) parts.push(`Amount due: Rs ${r.amountDue}`);
  if (!r.amountFinal) parts.push('Amount shown is provisional until the clarification is answered');
  return parts.join('. ') + '.';
}

function renderResult(data) {
  const r = data.reconciliation;
  currentRec = r;
  const clar = (r.clarifications || []).map(c => `<li class="clar">${esc(c.question)}</li>`).join('');
  document.getElementById('result').innerHTML = `
    <table>
      <tr><th></th><th>Invoice</th><th>${r.review ? 'Verified review counts' : 'Voice note extraction (unverified)'}</th></tr>
      <tr><td>Quantity</td><td>${r.invoiced.quantity} ${esc(r.invoiced.unit)}</td><td>received ${r.extracted.received ?? '?'}, damaged ${r.extracted.damaged ?? 0}</td></tr>
      <tr><td>Shortage (unexplained)</td><td colspan="2">${r.shortage === null ? '?' : r.shortage + ' ' + esc(r.invoiced.unit)}</td></tr>
      <tr><td>Payable (good) units</td><td colspan="2">${r.goodUnits ?? '?'} ${esc(r.invoiced.unit)} ${r.amountFinal ? '' : '(interpretation only)'}</td></tr>
      <tr><td>Amount due</td><td colspan="2">${r.amountDue === null ? 'Not settled' : 'Rs ' + r.amountDue} ${r.amountFinal ? '' : '<span class="pending">(provisional)</span>'}</td></tr>
      <tr><td>Status</td><td colspan="2">${statusBadge(r.status)}</td></tr>
    </table>
    <p class="explain">${esc(explanation(r))}</p>
    <p class="muted">Transcript: ${esc(data.voiceNote.transcript)}</p>
    ${r.originalExtraction ? `<p class="explain">Original voice extraction (not edited): received ${r.originalExtraction.received ?? '?'}; damaged ${r.originalExtraction.damaged ?? '?'}. These are not the reviewed counts.</p>` : ''}
    ${r.review ? `<p class="explain">Verified counts override the transcript: ${r.review.receivedTotal} total arrived = ${r.review.good} good + ${r.review.damaged} damaged. Damage credit: ${r.review.acceptDamageCredit ? 'accepted' : 'not needed'}. Shortage credit: ${r.review.acceptShortageCredit ? 'accepted' : 'not needed'}.</p>` : ''}
    ${clar ? '<h3>Clarification needed before confirming</h3><ul>' + clar + '</ul>' : ''}`;
  document.getElementById('clar-answer-block').hidden = !(r.clarifications || []).length;
  document.getElementById('review-block').hidden = !(r.clarifications || []).length;
  document.getElementById('confirm-rec').disabled = !r.amountFinal;
  document.getElementById('result-section').hidden = false;
  refreshHistory();
}

document.getElementById('submit-voice').onclick = async () => {
  const invoiceId = document.getElementById('vn-invoice').value;
  const consent = document.getElementById('vn-consent').checked ? 'yes' : '';
  const transcriptText = document.getElementById('vn-transcript').value.trim();
  const audioFile = document.getElementById('vn-audio').files[0];
  if (!consent) { alert('Consent is required to store/transcribe the recording.'); return; }

  let data;
  if (audioFile) {
    const fd = new FormData();
    fd.append('audio', audioFile);
    fd.append('invoiceId', invoiceId);
    fd.append('consent', consent);
    if (transcriptText) fd.append('transcriptText', transcriptText);
    data = await api('/api/voice-notes', { method: 'POST', body: fd });
  } else {
    data = await api('/api/reconcile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId, transcript: transcriptText, consent })
    });
  }
  if (data.error) { alert(data.error); return; }
  renderResult(data);
};

document.getElementById('submit-answer').onclick = async () => {
  if (!currentRec) return;
  const answerText = document.getElementById('clar-answer').value.trim();
  if (!answerText) { alert('Type the retailer\'s answer first.'); return; }
  const out = await api(`/api/reconciliations/${currentRec.id}/resolve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answerText })
  });
  if (out.error) { alert(out.error); return; }
  renderResult({ reconciliation: out.reconciliation, voiceNote: { transcript: out.reconciliation.clarificationAnswer || '' } });
};

document.getElementById('review-save').onclick = async () => {
  if (!currentRec) return;
  const read = id => { const v = document.getElementById(id).value; return v === '' ? null : Number(v); };
  const out = await api(`/api/reconciliations/${currentRec.id}/review`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({receivedTotal:read('review-total'), good:read('review-good'), damaged:read('review-damaged'),acceptShortageCredit:document.getElementById('review-shortage-credit').checked,acceptDamageCredit:document.getElementById('review-damage-credit').checked})});
  if (out.error) return alert(out.error);
  renderResult({reconciliation:out.reconciliation,voiceNote:{transcript:'Verified physical breakdown saved'}});
};
document.getElementById('confirm-rec').onclick = async () => {
  if (!currentRec) return;
  const out = await api(`/api/reconciliations/${currentRec.id}/confirm`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmationText: 'confirmed in app' })
  });
  if (!out.confirmed) { alert('Not confirmed: ' + (out.reason || '')); return; }
  const note = await api('/api/voice-notes/' + out.reconciliation.voiceNoteId);
  renderResult({reconciliation:out.reconciliation,voiceNote:note});
  currentRec = out.reconciliation;
  refreshHistory();
};

document.getElementById('tts-prompt').onclick = async () => {
  if (!currentRec) return;
  const out = await api(`/api/reconciliations/${currentRec.id}/confirmation-audio`, { method: 'POST' });
  if (out.audioPath) {
    const audio = document.getElementById('tts-audio');
    audio.src = out.audioUrl;
    audio.hidden = false;
    audio.play();
  } else {
    alert('TTS dry-run (live mode off). Prompt text: ' + (out.text || ''));
  }
};

refreshInvoices();
refreshHistory();

// Deep link: #rec=<id> renders a stored reconciliation (used for demos/tests).
if (location.hash.startsWith('#rec=')) {
  const id = location.hash.slice(5);
  api('/api/reconciliations').then(recs => {
    const rec = recs.find(r => r.id === id);
    if (rec) api('/api/voice-notes/' + rec.voiceNoteId).then(note => renderResult({ reconciliation: rec, voiceNote: note }));
  });
}
