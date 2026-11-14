// Unmetered integration regression. Child server stops even if an assertion fails.
const {spawn,execFileSync}=require('child_process'), fs=require('fs'),os=require('os'),path=require('path'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bolchallan-'));
const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'4174',GNANI_LIVE:'0',BOLCHALLAN_DATA_DIR:dir},stdio:'ignore'});
const base='http://127.0.0.1:4174';
async function post(p,b){const r=await fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});return {status:r.status,body:await r.json()};}
(async()=>{await new Promise(r=>setTimeout(r,500));
for(const v of [-1,null]) assert.equal((await post('/api/invoices',{product:'Invalid',quantity:v})).status,400);
const invoice=(await post('/api/invoices',{product:'Biscuit delivery (synthetic)',quantity:20,unit:'packet',unitPrice:40,party:'Fictional test store'})).body;
assert.equal((await post('/api/reconcile',{invoiceId:invoice.id,transcript:'18 received'})).status,400);
const r=(await post('/api/reconcile',{invoiceId:invoice.id,transcript:'20 packet भेजे थे लेकिन दुकान वाले ने 18 receive किया, 2 packet damage थे।',consent:'yes'})).body;
assert.equal(r.reconciliation.shortage,2);assert.equal(r.reconciliation.amountDue,null);
const id=r.reconciliation.id;
assert.equal((await post(`/api/reconciliations/${id}/confirm`,{confirmationText:'yes'})).body.confirmed,false);
assert.equal((await post(`/api/reconciliations/${id}/resolve`,{answerText:'not correct'})).body.reconciliation.amountFinal,false);
if(process.env.RENDER) execFileSync('google-chrome',['--headless','--no-sandbox','--disable-gpu','--window-size=1100,2100','--virtual-time-budget=2000','--screenshot='+path.join(dir,'review-pending.png'),base+'/#rec='+id],{stdio:'ignore'});
assert.equal((await post(`/api/reconciliations/${id}/review`,{receivedTotal:18,good:16,damaged:2,acceptDamageCredit:true})).status,400);
const review=(await post(`/api/reconciliations/${id}/review`,{receivedTotal:20,good:18,damaged:2,acceptDamageCredit:true})).body;
assert.equal(review.reconciliation.amountDue,720);
assert.equal((await post(`/api/reconciliations/${id}/confirm`,{confirmationText:'Reviewed physical counts and damage credit'})).body.confirmed,true);
if(process.env.RENDER) execFileSync('google-chrome',['--headless','--no-sandbox','--disable-gpu','--window-size=1100,1800','--virtual-time-budget=2000','--screenshot='+path.join(dir,'review-confirmed.png'),base+'/#rec='+id],{stdio:'ignore'});
await fetch(base+'/api/voice-notes/'+r.voiceNote.id,{method:'DELETE'});
const db=JSON.parse(fs.readFileSync(path.join(dir,'store.json')));
assert.equal(db.voiceNotes.length,0);assert.equal(db.reconciliations.length,0);
console.log('PASS: invoice validation, consent, mixed-script extraction, unresolved confirm gate, negated approval, credit gate, 18-good+2-damaged interpretation at Rs720, explicit confirmation, cascading delete persistence');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.kill());
