# BolChallan

Development prototype for voice-assisted delivery reconciliation. It does not send payments, issue supplier credits, or change an accounting system.

## Run

Requires Node 22 or later.

```
npm ci
npm test
npm start
```

Open http://127.0.0.1:4173. The server binds to loopback only. Do not expose it publicly: the prototype has no account authentication or tenant isolation.

Dry-run is the default. Transcript entry requires consent. Live audio transcription and spoken prompts require GNANI_LIVE=1, GNANI_API_KEY injected from a secure secret manager, and a finite GNANI_CREDIT_CAP. Never put API keys in source control, browser storage or chat. There is no runtime API-key input in this version.

## Settlement rules

- Physical total received includes damaged units. Good + damaged must equal total.
- Missing units and damaged units are separate discrepancies, never explanations for one another.
- An ambiguous transcript has no settled amount. A natural-language yes cannot approve a credit.
- A reviewer enters verified physical counts and explicitly accepts each applicable shortage or damage credit, then confirms the record.
- Invoice 20, total 18, damaged 2 means 16 good and 2 missing. It can settle at Rs640 only if both credit types are explicitly accepted.
- If the intended statement was 18 good plus 2 damaged, the reviewer enters total 20 / good 18 / damaged 2. With damage credit accepted, the amount is Rs720 at Rs40 per unit.
- Overdelivery and unit mismatch cannot be cleared by a bare confirmation. Correct the invoice or counts.

## Evidence and limitations

Real API calls on November 11, 2026 returned HTTP200 for Timbre v3.0 synthesis and Prisma v3.0 transcription. A multipart upload through this server reached Prisma and produced the stored transcript and reconciliation. The source audio was synthetic; this is integration evidence, not a real-speaker accuracy benchmark. One short synthesized phrase was transcribed imperfectly. No WER, accuracy or field-reliability claims have been measured.

The extractor is a limited deterministic prototype for English, romanized Hindi and selected Hindi role words. Unsupported wording, number composition, returns and other languages can need manual review. A green clean-match result is not a guarantee that speech recognition was correct. Review the transcript and physical counts before relying on it.

The JSON store is single-process development storage, not production accounting infrastructure. Records and audio are local. Delete removes a recording, its transcript and linked reconciliation; invoices remain. Failed uploads are cleaned up. Generated TTS test files are development artifacts and should be removed when no longer needed.

The credit log records conservative reservations, not authoritative billing. Each STT request reserves 1 credit and each TTS request reserves at least 1 credit before the network call. Failures keep their reservation. The development cap must account for usage outside the app separately. Official console usage is the billing source of truth. No auto-retries.

Official API contracts:
- https://docs.gnani.ai/api/STT/speech-to-text
- https://docs.gnani.ai/api/TTS/tts-inference.md

Evon is not integrated. No public deployment, submission or production use is included in this prototype.
