# AGENTS — stable and low-token process

## Authority and separation
- User owns product decision, credentials, merge, publication and destructive actions.
- Codex: primary implementer in its own branch/worktree, minimally scoped diff, deterministic tests.
- Astra: independent reviewer only when needed; reads **base/commit/diff**, threat model and evidence without implementing its own findings. It must not call a self-review independent.
- Antigravity: alternate executor and discovery researcher when assigned, not a second implementation by default.
- ChatGPT: product brief, acceptance criteria, decision log, escalation. Grok/Gemini: research; report sources separately from estimates.

## Task types
- `research`: no code change. Return cited alternatives, uncertainties, risk and estimated validation cost.
- `implement`: read PRODUCT and relevant Skills. Implement ONE scoped ticket, write tests and give diff/check commands.
- `audit`: run relevant scanners/tests and independent review where risk merits it. Severity + reproducibility + SHA + blockers.
- `release`: require authorization, immutable candidate evidence, separate preview/production; no direct deploy in a diagnosis.

## Non-negotiables
- Do not reuse or expose secrets from Recorte. Do not edit its repo or Cloudflare resources.
- Do not assume a flag allows advertising: scripts/data sharing require a separate documented integration.
- Do not add arbitrary outbound fetch/proxy to backend without SSRF threat model, allowlist, timeouts, size limits, quotas.
- Don't claim tests passed if not run, mobile hardware tested if only emulated, or that AI review proves no vulnerabilities.
- Preserve existing work. Task authorization may permit branch/commit/push/PR only within the named repository and ticket scope; record that authorization in the handoff. It never implies permission to merge, deploy, change credentials or repository protections. Those actions require separate explicit authorization.
- Fast loop: test smallest affected behavior locally; full CI on final candidate, don't rerun unrelated expensive suites after docs-only edits.

## Standard handoff (short)
`EXECUTOR | TASK+AUTHORIZATION | STATE | BASE+SHA | PR | FILES | CHECKS (actual, links) | REVIEWER (actual or pending) | SECURITY IMPLICATION | LIMITS | HUMAN GATES`

Use the state/evidence contract in `docs/orchestration.md`. Implementer self-checks are not independent review. An unavailable executor must be reported as `EXECUTOR_UNAVAILABLE`, never silently replaced.

## Acceptance
- Existing tasks function in a real browser with documented limits and no silent failure.
- Production path is not accessible from preview workflow or tokens; user approves activation.
- Screens, scripts and handling of third parties match written data/monetization policy.
- Test results and source hash correspond to candidate being reviewed.
