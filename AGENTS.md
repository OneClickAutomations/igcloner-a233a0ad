# Project architecture
- Intel analytics are calculated and evidence-checked in a browser-safe pure module before persistence; AI supplies interpretation, not numerical truth.
- Intel AI requests use native streaming Claude Messages in a server-only helper; credentials and prompts never enter browser bundles.
- Intel-to-Studio handoff creates ordinary saved projects using existing project fields and routes, so other studio modules need no changes.
- Research PDF generation stays client-side with jsPDF and nine fixed editorial pages, avoiding server-only rendering dependencies.