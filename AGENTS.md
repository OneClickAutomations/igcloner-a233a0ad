# Project architecture
- Clone mode names and summaries share a browser-safe display mapping keyed by unchanged A1/A2/A3 IDs, preserving saved preferences and generation behavior when labels change.
- Intel analytics are calculated and evidence-checked in a browser-safe pure module before persistence; AI supplies interpretation, not numerical truth.
- Intel AI requests use native streaming Claude Messages in a server-only helper; credentials and prompts never enter browser bundles.
- Intel-to-Studio handoff creates ordinary saved projects using existing project fields and routes, so other studio modules need no changes.
- Research PDF generation stays client-side with jsPDF and nine fixed editorial pages, avoiding server-only rendering dependencies.