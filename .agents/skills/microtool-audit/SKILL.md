---
name: microtool-audit
description: Independently review the exact candidate SHA or patch with risk-proportional adversarial tests and a reproducible report.
---
Read `SECURITY.md` and `docs/threat-model.md`, base SHA, diff and exact CI evidence. Separate proven defects, hypotheses and improvements. For each finding report severity, file/line, reproduction, exploit preconditions, impact, and blocking criterion. If risk concerns backend, review upstream allowlists/SSRF, input limits, spend guards, cross-origin, and secret handling; for file processing, memory and corrupt files; for ads, privacy/CSP/consent/UX. Never equate self-review with independent audit or claim absolute security. No changes, merges or releases unless specifically authorized.
