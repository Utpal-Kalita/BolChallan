// Explicit physical-count and settlement semantics. No transcript can approve a credit.
function valid(n) { return typeof n === 'number' && Number.isFinite(n) && n >= 0; }
function round(n) { return Math.round(n * 100) / 100; }
function reconcile(invoice, extraction) {
  const active = extraction.statements.filter(s => !s.superseded);
  const last = role => active.filter(s => s.role === role).at(-1);
  const sent = last('sent'), received = last('received'), damaged = last('damaged');
  const rq = received && valid(received.value) ? received.value : null;
  const dq = damaged && valid(damaged.value) ? damaged.value : damaged ? null : 0;
  const iq = valid(invoice.quantity) ? invoice.quantity : null;
  const unit = invoice.unit || 'unit';
  const discrete = ['packet','piece','carton','box','bag','dozen','unit'].includes(unit);
  const clarifications = [];
  const ask = (kind, question) => clarifications.push({kind, question});
  if (iq === null || !valid(invoice.unitPrice) && invoice.unitPrice != null) ask('invalid-invoice', 'Invoice quantity and price must be finite non-negative numbers.');
  if (active.some(s => !valid(s.value))) ask('invalid-quantity', 'Invalid spoken quantity. Enter the exact physical counts.');
  if (discrete && [iq, rq, dq].some(n => n !== null && !Number.isInteger(n))) ask('fractional-discrete-unit', 'This unit requires a whole-number count. Verify the unit or quantity.');
  if (rq === null) ask('missing-received', 'How many units physically arrived, including damaged units?');
  if (dq === null || rq !== null && dq > rq) ask('damage-exceeds-received', 'Damaged units cannot exceed the physical total received. Enter the exact breakdown.');
  if (active.some(s => s.unit && s.unit !== unit)) ask('unit-mismatch', 'Spoken units differ from the invoice. Correct the invoice or restate counts in its units.');
  if (sent && sent.value !== iq) ask('sent-invoice-mismatch', 'The dispatch count differs from the invoice. Verify the invoice.');
  const shortage = rq !== null && iq !== null ? round(iq - rq) : null;
  if (shortage < 0) ask('overdelivery', 'Received exceeds invoice. Verify the invoice or correct the count; extra units are not automatically payable.');
  if (shortage > 0) ask('unexplained-shortage', 'Physical receipt is below invoice. A damage claim does not explain missing units. Explicitly review the shortage credit.');
  if (dq > 0) ask('damage-claim-confirmation', 'Does received mean total including damage, or only good units? Enter total, good and damaged counts, then explicitly accept any credit.');
  for (const a of extraction.ambiguities || []) ask(a.type, a.detail);
  for (const role of ['received','damaged']) {
    const vals = new Set(active.filter(s => s.role === role).map(s => s.value));
    if (vals.size > 1) ask('conflicting-quantities', 'Several different counts remain active. Enter the verified breakdown.');
  }
  const goodUnits = rq !== null && dq !== null && dq <= rq ? round(rq - dq) : null;
  const amountDue = clarifications.length === 0 && goodUnits !== null && valid(invoice.unitPrice) ? round(goodUnits * invoice.unitPrice) : null;
  return {invoiceId: invoice.id, product: invoice.product,
    invoiced: {quantity: iq, unit, unitPrice: invoice.unitPrice ?? null},
    extracted: {sent: sent?.value ?? null, received: rq, damaged: dq, unit, rawStatements: extraction.statements},
    shortage, goodUnits, amountDue, amountFinal: clarifications.length === 0,
    status: clarifications.length ? 'needs-clarification' : 'matched', clarifications, version: 1};
}
// A conversational yes (or even 'not correct') never changes settlement authority.
function applyAnswerResolution(prev, next) { return next; }
function reviewBreakdown(record, review) {
  const {receivedTotal, good, damaged, acceptShortageCredit, acceptDamageCredit} = review || {};
  if (![receivedTotal, good, damaged].every(valid)) throw new Error('Enter finite non-negative total, good and damaged counts.');
  if (['packet','piece','carton','box','bag','dozen','unit'].includes(record.invoiced.unit) && ![receivedTotal,good,damaged].every(Number.isInteger)) throw new Error('Enter whole units or correct the invoice unit.');
  if (round(good + damaged) !== round(receivedTotal)) throw new Error('Good plus damaged must equal the physical total.');
  if (receivedTotal > record.invoiced.quantity) throw new Error('Overdelivery requires a corrected invoice; no automatic payable amount.');
  if ((record.clarifications || []).some(c => ['unit-mismatch','invalid-invoice','sent-invoice-mismatch'].includes(c.kind))) throw new Error('Correct invoice or unit mismatch before settlement.');
  const shortage = round(record.invoiced.quantity - receivedTotal);
  if (shortage > 0 && acceptShortageCredit !== true) throw new Error('Explicitly accept the shortage credit.');
  if (damaged > 0 && acceptDamageCredit !== true) throw new Error('Explicitly accept the damage credit.');
  return {...record, originalExtraction: record.originalExtraction || record.extracted, extracted: {...record.extracted, received: receivedTotal, damaged}, goodUnits: good, shortage,
    amountDue: valid(record.invoiced.unitPrice) ? round(good * record.invoiced.unitPrice) : null,
    amountFinal: true, status: 'reviewed', clarifications: [],
    review: {...review, reviewedAt: new Date().toISOString()}};
}
function confirmRecord(record, confirmationText) {
  if (record.clarifications?.length || !record.amountFinal) return {confirmed: false, reason: 'unresolved-clarifications', record};
  if (!String(confirmationText || '').trim()) return {confirmed: false, reason: 'confirmation-required', record};
  return {confirmed: true, record: {...record, status: 'confirmed', confirmationText, confirmedAt: new Date().toISOString()}};
}
module.exports = {reconcile, confirmRecord, applyAnswerResolution, reviewBreakdown};
