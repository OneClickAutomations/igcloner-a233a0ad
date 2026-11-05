# Project architecture
- Clone mode names and summaries share a browser-safe display mapping keyed by unchanged A1/A2/A3 IDs, preserving saved preferences and generation behavior when labels change.
- Intel analytics are calculated and evidence-checked in a browser-safe pure module before persistence; AI supplies interpretation, not numerical truth.
- Intel AI requests use native streaming Claude Messages in a server-only helper; credentials and prompts never enter browser bundles.
- Intel-to-Studio handoff creates ordinary saved projects using existing project fields and routes, so other studio modules need no changes.
- Research PDF generation stays client-side with jsPDF and nine fixed editorial pages, avoiding server-only rendering dependencies.
- UGC motion uses equal-width repeated groups and a CSS transform loop; visibility arbitration pauses every nonselected copy before playing at most one copy per creator to avoid duplicate playback.- In-flight research reports carry a last_progress_at heartbeat; a DB sweep (hourly pg_cron + lazy on list) fails and refunds stale runs, and every success update is conditional on the row still being in-flight so swept runs never flip back to ready.
- The sidebar credit balance is a shared react-query key (CREDIT_BALANCE_KEY); invalidate it after any action that can move credits.
