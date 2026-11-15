# BolChallan - solution pitch

BolChallan turns a delivery voice note into a reconciliation a small-business operator can review. Start with an invoice, upload a consented delivery note, and compare the spoken quantities with what was billed.

The difference is in how it handles disagreement. "18 received, 2 damaged" can mean 18 total units including damage, or 18 good units plus 2 damaged units. BolChallan does not silently choose a payment amount. It shows the original transcript and extraction, asks for a verified physical breakdown, and requires separate acceptance of any missing-unit or damage credit. Quantity and money calculations run in deterministic code. A conversational "yes" cannot authorize a credit.

Solo entry: Utpal Kalita - concept, design and evaluation, with AI-assisted development. Built using Gnani Prisma v3.0 for speech-to-text and Timbre v3.0 for spoken prompts. Testing includes synthetic Hindi audio tested end to end through the actual server: upload, Prisma transcription, extraction and reconciliation, with the live TTS prompt playing back in the browser. These are integration checks on a few samples, not an accuracy study.

The prototype includes an invoice form, consent gate, audio/transcript input, clarification flow, reviewed counts, transaction history and recording deletion. It does not send payments, post supplier credits or connect to an ERP. The speech-enabled prototype runs locally and is not publicly deployed; the public demo replays a synthetic typed transcript through the same deterministic pipeline. Next validation: consented small-business delivery notes with noisy audio and regional wording, measuring extraction quality and review time before any accuracy claims.
