# Repeatable low-token orchestration

Goal: pick a functional query -> create an inexpensive utility -> produce testable artifact -> independently review changes with risk proportionality -> approve deployment. The model does not substitute for deterministic evidence.

## Short context packets

- **Product owner / ChatGPT (brief, 1 page):** search intent, single task, user-visible IO, file/type/memory constraints, accepted browsers, monetization flags, cost/abuse model, out-of-scope.
- **Codex / implement:** task ID; `PRODUCT.md`; selected profile; exact acceptance tests; only the affected source, relevant Skill and `AGENTS.md`. Deliver minimal diff, tests, risk and SHA. No deployment.
- **Astra / audit:** exact candidate diff/SHA, threat model, CI output, tests and risk checklist. Avoid repeating implementation research. High-risk changes require independent audit; CSS/SEO only need focused gates.
- **Release operator (human-approved):** exact SHA and tested artifact, domain/Worker identity, secrets environment (without values), deployment evidence, smoke/rollback. Never infer authorization from audit pass.

## Expensive work must be bounded

- Begin with cheapest reproducer; do not run full browser suite after every copy edit.
- Use one implementer, one independent reviewer at fixed milestones. Review **diff**, not whole history, except when architecture changes.
- No repeated blanket "audit everything" loops: each finding requires severity, evidence and deterministic blocking criteria.
- Keep `docs/decisions.md` for product-specific exceptions; do not accumulate chat histories in prompts.
- CI remains mandatory for final candidate; no reusing a green status from another SHA.
- Track implementation time, human intervention minutes, AI tokens/credits (if provider makes available), number of review rounds, CI/test errors. Do not invent savings.

## Launch gates

1. Preview preflight green; actual preview publisher is not implemented in v0.2.
2. Real browser task completion and representative file tests pass.
3. Independent security review for new backend, third parties, payments, CI, and deployment changes.
4. Privileged release requires separately reviewed, locked deployment tool, approved target, and rollback evidence.
5. Search Console and monetization only after explicit product-specific approval.
