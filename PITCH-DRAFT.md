# BolChallan
## Pitch draft for review, not submitted

BolChallan turns a delivery voice note into a reconciliation that a small-business operator can review. Start with an invoice, upload a consented delivery note, and compare the spoken quantities with what was billed.

The difference is in how it handles disagreement. "18 received, 2 damaged" can mean 18 total units including damage, or 18 good units plus 2 damaged units. BolChallan does not silently choose a payment amount. It shows the original transcript and extraction, asks for a verified physical breakdown, and requires separate acceptance of any missing-unit or damage credit. Quantity and money calculations run in deterministic code. A conversational "yes" cannot authorize a credit.

The prototype uses Gnani Prisma v3.0 for speech-to-text and Timbre v3.0 for spoken prompts. A synthetic audio upload has passed through the actual server, Prisma transcription, extraction and reconciliation. The live TTS button has returned an audio file that the browser loaded and played. These are integration checks, not a real-speaker accuracy study.

The current build is a local, private prototype with an invoice form, consent gate, audio/transcript input, clarification flow, reviewed counts, transaction history and recording deletion. It does not send payments, post supplier credits or connect to an ERP. Evon is not integrated.

Next validation should use consented small-business delivery notes, including noisy audio, regional wording, corrections and unit mismatches. Measure quantity extraction, the rate of unresolved discrepancies and review time before making accuracy or business-impact claims. No such results are claimed yet.

## Review notes
- No public deployment or submission approved yet.
- Human-speaker evaluation is still outstanding.
- The extractor supports a limited set of English, romanized Hindi and Hindi role words. Other phrasing can require manual review.
- Local JSON storage and no account authentication make this unsuitable for public production use.
