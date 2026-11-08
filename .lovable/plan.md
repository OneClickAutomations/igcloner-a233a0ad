# Video Inspiration Studio — Step 3

Build the studio now, independent of AWS assembly.

- Private, owner-readable projects, reference assets, scenes, attempts and assembly jobs; server-only writes and atomic generation claims.
- Reference library with face/body/back slots, product/logo references and individual toggles. Identity comes from references, not prompt descriptions.
- Import saved visual evidence separately from cached transcripts; preserve timestamps/provenance and unknown fields. No new scrape or paid analysis on import.
- Editable portrait storyboard, action-object/state checklist, single-still regeneration and approval invalidation after edits.
- Explicit model/seconds/rate quotes; sequential, durable gateway jobs, private clip collection after tab closure, failure refunds without paid retries.
- Fast 8s default, Lite “less motion” draft, explicitly selected Omni fallback. Physical constraints are always included.
- Assembly gated by the AWS bridge secret and URL, with a clear unavailable state and a ZIP of completed clips.
- Prices remain unset until USD/workspace-credit conversion is verified. Show the $0.145 customer-credit / 35% cost-ceiling math for animation, stills, writing and voiceover.
- Focused rule/security/concurrency tests and signed-in desktop/mobile checks. At most one cheap live smoke test; zero generation spend is acceptable if pricing or access prevents safe execution.

## Technical details
Use existing TanStack authentication and ledger RPCs, private storage and a bounded scheduled collector. Separate source observations from authored scene content; source likeness/text never prefill generated prompts. Assembly implementation remains an integration stub pending the owner's AWS deployment; existing studios/prices remain unchanged.