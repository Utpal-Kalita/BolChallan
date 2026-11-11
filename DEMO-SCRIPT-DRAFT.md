# BolChallan demo script
## Review draft, target 2-3 minutes. Not recorded or published.

### 0:00-0:20 | The problem
Screen: invoice for 20 packets at Rs40 each.

"A delivery note might say: 18 received, 2 damaged. Does that mean 18 total, or 18 good plus 2 damaged? The difference changes the amount. BolChallan makes that ambiguity visible before anyone confirms the record."

### 0:20-0:50 | Voice to quantities
Screen: consent checkbox, synthetic audio upload, stored transcript and extraction.

"This is a synthetic audio example, not a customer recording. The file goes through the app's server to Gnani Prisma v3.0. The returned transcript is shown with the extracted quantities. Here, it says 20 sent, 18 received and 2 damaged."

Production note: the server upload path was verified live. If showing a stored result, label it "previous live API result". Do not imply a new API call happened while filming unless it actually did.

### 0:50-1:30 | Do not guess the settlement
Screen: needs-clarification state, no settled amount, disabled Confirm button.

"BolChallan does not treat damaged units as missing units, and it does not turn a spoken yes into financial approval. It asks for the physical total, good units and damaged units. Any shortage credit and damage credit need separate acceptance."

Screen: enter total20, good18, damaged2; accept damage credit; verify breakdown.

"For this example, the reviewer verifies that 20 units arrived: 18 good and 2 damaged. With the damage credit accepted, the deterministic calculation is 18 times Rs40, or Rs720. The original extraction still says 18 received. The reviewed counts are shown separately, so the voice note has not been rewritten."

### 1:30-2:00 | Confirm and hear it back
Screen: Confirm, transaction history, Play confirmation prompt.

"After review, the record can be confirmed. Gnani Timbre v3.0 produces the spoken prompt. This creates a reconciliation record only. It does not make a payment, issue a supplier credit or change an accounting system."

Production note: the actual UI button -> live TTS -> served audio -> browser playback clock was verified. Do not claim a native microphone recording feature: this version accepts an uploaded audio file.

### 2:00-2:30 | Limits and data control
Screen: original transcript beside reviewed counts, Delete recording & record.

"The local prototype includes consent and deletion controls. The speech integration has been tested with synthetic audio. Human-speaker accuracy and business impact are not measured yet. Next, it needs consented delivery notes with noise, corrections and local wording. When it is uncertain, the workflow should ask rather than silently settle."

## Before filming
- Review wording and pitch with Utpal; do not publish before approval.
- Keep the repository private. Never show the console key or environment variables.
- Label every synthetic example. Do not invent accuracy, WER, savings or user counts.
- Do not call Evon integrated or imply production readiness.
- Use staged fictional invoices only. No actual financial transactions.
