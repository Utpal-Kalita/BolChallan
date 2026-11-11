// Deterministic number parsing for English + Hindi (code-mixed) quantity speech.
// No LLM involved: every quantity the system acts on comes from these tables/rules.

const UNITS = {
  packet: 'packet', packets: 'packet', paket: 'packet',
  kilo: 'kg', kilos: 'kg', kg: 'kg', kgs: 'kg', kilee: 'kg',
  gram: 'g', grams: 'g', g: 'g',
  litre: 'litre', litres: 'litre', liter: 'litre', liters: 'litre', l: 'litre',
  box: 'box', boxes: 'box', carton: 'carton', cartons: 'carton',
  piece: 'piece', pieces: 'piece', pc: 'piece', pcs: 'piece',
  unit: 'unit', units: 'unit',
  bag: 'bag', bags: 'bag', bori: 'bag',
  dozen: 'dozen', dazen: 'dozen'
};

const EN = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  hundred: 100
};

const HI = {
  ek: 1, do: 2, teen: 3, tin: 3, char: 4, chaar: 4, paanch: 5, panch: 5,
  chhe: 6, chhah: 6, cheh: 6, saat: 7, saath: 7, aath: 8, ath: 8, nau: 9,
  das: 10, gyarah: 11, gyaarah: 11, barah: 12, baarah: 12, terah: 13,
  chaudah: 14, choudah: 14, pandrah: 15, pandra: 15, solah: 16,
  satrah: 17, sathra: 17, atharah: 18, athaarah: 18, unnis: 19, unnees: 19,
  bees: 20, bis: 20, ikkis: 21, baais: 22, teis: 23, chaubis: 24, pachis: 25,
  chhabbis: 26, sattais: 27, atthais: 28, untis: 29, tees: 30,
  chalis: 40, chaalees: 40, pachaas: 50, pachas: 50, saath60: 60, sattar: 70,
  assi: 80, nabbe: 90, nabbey: 90, sau: 100
};

// Confusable pairs frequently misheard on phone audio (used for uncertainty flags)
const CONFUSABLES = [
  ['pandrah', 'pachaas'], ['pandra', 'pachas'], ['fifteen', 'fifty'],
  ['terah', 'tees'], ['thirteen', 'thirty'], ['chaudah', 'chalis'],
  ['fourteen', 'forty'], ['solah', 'saath60'], ['sixteen', 'sixty'],
  ['satrah', 'sattar'], ['seventeen', 'seventy'], ['atharah', 'assi'],
  ['eighteen', 'eighty'], ['unnis', 'nabbe'], ['nineteen', 'ninety']
];

const CORRECTION_MARKERS = ['nahi', 'nahin', 'nhi', 'mat', 'sorry', 'arre', 'are'];

const SENT_WORDS = ['bheje', 'bheja', 'bheji', 'bhej', 'sent', 'dispatch', 'dispatched', 'nikale', 'chadhaya', 'loaded', 'भेजे', 'भेजा', 'भेजी', 'भेजेदा', 'भेज', 'निकाले', 'चढ़ाया'];
const RECEIVED_WORDS = ['receive', 'received', 'mila', 'mile', 'mili', 'pahuncha', 'pahunche', 'pahunchi', 'aaya', 'aaye', 'got', 'मिला', 'मिले', 'मिली', 'पहुंचा', 'पहुंचे', 'पहुंची', 'आया', 'आए'];
const DAMAGED_WORDS = ['damaged', 'damage', 'kharab', 'tuta', 'tuti', 'tute', 'phuta', 'phute', 'broken', 'leak', 'leaked', 'spoiled', 'expired', 'डैमेज', 'डैमेज़', 'खराब', 'टूटा', 'टूटी', 'टूटे', 'फूटा', 'फूटे'];

function normalize(text) {
  return ' ' + String(text).toLowerCase()
    .replace(/(\d)\.(\d)/g, '$1<DECIMAL>$2') // keep decimal points inside numbers
    .replace(/[.,!?;:।]/g, ' | ').replace(/["'()\[\]]/g, ' ')
    .replace(/<DECIMAL>/g, '.')
    .replace(/\s+/g, ' ') + ' ';
}

// Parse a single numeric phrase starting at tokens[i]; returns {value, tokensUsed, confusable, raw} or null
function parseNumber(tokens, i) {
  const t = tokens[i];
  if (/^\d+(\.\d+)?$/.test(t)) {
    return { value: parseFloat(t), tokensUsed: 1, confusable: false, raw: t };
  }
  if (EN[t] !== undefined) {
    let value = EN[t]; let used = 1;
    if (value >= 20 && value < 100 && value % 10 === 0 && tokens[i + 1] && EN[tokens[i + 1]] !== undefined && EN[tokens[i + 1]] < 10) {
      value += EN[tokens[i + 1]]; used = 2;
    }
    const conf = CONFUSABLES.some(pair => pair[0] === t || pair[1] === t);
    return { value, tokensUsed: used, confusable: conf, raw: tokens.slice(i, i + used).join(' ') };
  }
  if (HI[t] !== undefined) {
    const conf = CONFUSABLES.some(pair => pair[0] === t || pair[1] === t);
    return { value: HI[t], tokensUsed: 1, confusable: conf, raw: t };
  }
  return null;
}

function findUnit(tokens, i) {
  for (let j = i; j <= Math.min(i + 2, tokens.length - 1); j++) {
    if (UNITS[tokens[j]]) return { unit: UNITS[tokens[j]], at: j };
  }
  return null;
}

// Extract quantity statements with roles from a transcript.
function extractQuantities(transcript) {
  const text = normalize(transcript);
  const tokens = text.trim().split(' ');
  const statements = [];
  let correctionPending = false;

  for (let i = 0; i < tokens.length; i++) {
    if (CORRECTION_MARKERS.includes(tokens[i])) {
      if (statements.length > 0) correctionPending = true;
      continue;
    }
    const num = parseNumber(tokens, i);
    if (!num) continue;

    const unitInfo = findUnit(tokens, i + num.tokensUsed);
    // Role = nearest role-word around the quantity (ties prefer words AFTER the
    // number, e.g. 'do packet damaged', and damaged > sent > received at equal distance).
    let role = null;
    let best = Infinity;
    const numEnd = i + num.tokensUsed;
    const consider = (words, r) => {
      for (let j = Math.max(0, i - 3); j < Math.min(tokens.length, numEnd + 5); j++) {
        if (tokens.slice(Math.min(i,j), Math.max(i,j)).includes('|')) continue;
        if (!words.includes(tokens[j])) continue;
        const d = Math.abs(j - i) - (j >= numEnd ? 0.5 : 0); // slight preference for following words
        if (d < best - 0.01) { best = d; role = r; }
      }
    };
    consider(DAMAGED_WORDS, 'damaged');
    consider(SENT_WORDS, 'sent');
    consider(RECEIVED_WORDS, 'received');

    const st = {
      role,
      value: num.value,
      unit: unitInfo ? unitInfo.unit : null,
      confusable: num.confusable,
      raw: num.raw,
      tokenIndex: i,
      isCorrection: correctionPending
    };
    if (correctionPending && statements.length > 0) {
      statements[statements.length - 1].superseded = true;
      correctionPending = false;
    }
    statements.push(st);
    i += num.tokensUsed - 1;
  }

  const ambiguities = [];
  if (/-\s*\d|\b(?:minus|negative|infinity|nan|maybe|shayad|ya)\b/i.test(transcript)) ambiguities.push({type:'uncertain-or-invalid-number',detail:'Negative, non-finite or uncertain quantity wording requires explicit count review.'});
  // Confusable number words (pandrah/pachaas, atharah/assi, ...) are flagged on the
  // statements; reconcile() decides whether they actually change the outcome before
  // asking for clarification, so consistent cases are not needlessly blocked.
  const confusables = statements.filter(s => s.confusable && !s.superseded);
  if (confusables.length > 0) {
    ambiguities.push({
      type: 'confusable-number',
      detail: `Potentially confusable quantity word(s): ${confusables.map(s => '"' + s.raw + '"').join(', ')}. Confirm the exact figure.`
    });
  }
  const active = statements.filter(s => !s.superseded);
  const noRole = active.filter(s => !s.role);
  if (noRole.length > 0) {
    ambiguities.push({
      type: 'unclassified-quantity',
      detail: `${noRole.length} ${noRole.length > 1 ? 'quantities' : 'quantity'} could not be tied to sent/received/damaged: ${noRole.map(s => s.value).join(', ')}.`
    });
  }
  return { statements, ambiguities };
}

function resolveQuantities(statements) {
  const active = statements.filter(s => !s.superseded);
  const byRole = {};
  for (const st of active) {
    if (!st.role) continue;
    byRole[st.role] = st;
  }
  return {
    sent: byRole.sent || null,
    received: byRole.received || null,
    damaged: byRole.damaged || null,
    unclassified: active.filter(s => !s.role)
  };
}

module.exports = { extractQuantities, resolveQuantities, UNITS, normalize };
