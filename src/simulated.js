// Canned demo transcripts (scripted, consented scenarios) used in dry-run mode
// so the full pipeline is testable without any metered API call.
module.exports = {
  scenarios: [
    {
      id: 'disputed-delivery',
      label: 'Disputed delivery: 20 invoiced, 18 received, 2 damaged (Hinglish)',
      transcript: 'Bees packet bheje the, lekin dukaan wale ne atharah receive kiya. Do packet damaged the.'
    },
    {
      id: 'clean-match',
      label: 'Clean match: 50 kg sent, 50 kg received (Hinglish)',
      transcript: 'Pachaas kilo chawal bheja tha aur dukaan pe pachaas kilo receive hua.'
    },
    {
      id: 'confusable-number',
      label: 'Confusable number: fifteen/fifty ambiguity, needs clarification',
      transcript: 'Pandrah carton bheje the, dukaan ne bola pachaas aaye. Confirm karo kitne the.'
    },
    {
      id: 'correction-mid-call',
      label: 'Mid-call correction: 20 corrected to 18 received',
      transcript: 'Bees packet receive hue, nahi, atharah receive hue. Do packet wapas bhej diye.'
    },
    {
      id: 'devanagari-mixed',
      label: 'Devanagari + English mix (as Gnani Prisma actually transcribes)',
      transcript: '20 packet भेजेदा, लेकिन दुकान वाले ने 18 receive किया, 2 packet damage दी।'
    },
    {
      id: 'overdelivery',
      label: 'Overdelivery: 20 invoiced, 50 claimed received - must not auto-accept',
      transcript: 'Bees kilo bheje the, pachaas kilo receive hue.'
    },
    {
      id: 'unexplained-shortage',
      label: 'Unexplained shortage: 30 sent, 25 received, no damage claim',
      transcript: 'Tees kilo dal bheji thi, pachis kilo receive hui.'
    },
    {
      id: 'decimal-quantity',
      label: 'Decimal quantity: 2.5 kg sent and received',
      transcript: '2.5 kilo cheeni bheji thi, 2.5 kilo receive hui.'
    }
  ]
};
