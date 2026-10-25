# Repeatable low-token orchestration

Goal: pick a functional query -> create an inexpensive utility -> produce testable artifact -> independently review changes with risk proportionality -> approve deployment. The model does not substitute for deterministic evidence.

## Verifiable state and handoff contract

SCOPED → ASSIGNED → IMPLEMENTED → CI_PASSED → REVIEWED → APPROVED → RELEASED

Each transition requires the previous state's evidence and the following evidence for
the same candidate. Unknown, failed or pending is not passed. Never skip a gate.
Evidence is bound to the tuple `base_sha + head_sha + tested_merge_sha`.
Changing base or head invalidates CI_PASSED; return to IMPLEMENTED, retest the
integration and re-evaluate affected review and approval before restoring gates.
If main advances while head stays unchanged, fresh integration CI is mandatory.
Changing head invalidates the old candidate's CI, review and approval.
The record lives in the PR body
and linked check/review/release records, avoiding a commit containing its own SHA.

<!-- handoff-contract:start -->
```json
{
  "states": [
    {"name":"SCOPED","actor":"coordinator","evidence":["task","scope","acceptance","authorization"]},
    {"name":"ASSIGNED","actor":"coordinator","evidence":["executor","base"]},
    {"name":"IMPLEMENTED","actor":"implementer","evidence":["sha","pr","files","local_checks","limits","human_gates"]},
    {"name":"CI_PASSED","actor":"ci","evidence":["sha","base_sha","head_sha","tested_merge_sha","check_urls","required_checks_passed"]},
    {"name":"REVIEWED","actor":"independent_reviewer","evidence":["sha","reviewer","review_url","findings","blocking_findings_resolved"]},
    {"name":"APPROVED","actor":"owner","evidence":["sha","approval_url","authorized_action","target"]},
    {"name":"RELEASED","actor":"release_operator","evidence":["sha","artifact","target","release_url","smoke","rollback"]}
  ]
}
```
<!-- handoff-contract:end -->

- SCOPED: coordinator records bounded work and owner task authorization.
- ASSIGNED: name the real active executor and exact base commit. If unavailable,
  report `EXECUTOR_UNAVAILABLE`; do not invent assignment or substitute an executor.
- IMPLEMENTED: one implementer supplies the exact head SHA, PR, changed files and
  actual local results. Include skipped checks, security implications and limits.
- CI_PASSED: inspect every required PR check's final successful result and URL.
  Record base SHA, head SHA and tested merge SHA when CI tests a synthetic merge.
  Verify the tuple against the actual CI checkout/logs and GitHub commit metadata;
  a declared merge SHA alone is not evidence. For head-only CI, record that mode
  explicitly rather than inventing a tested merge. A local pass or green run on
  another tuple cannot establish this state.
- REVIEWED: name the real independent reviewer (Astra for this pilot), review link,
  findings and disposition of blockers for the exact candidate. CI and implementer
  self-review cannot establish independent review; pending review stays pending.
- APPROVED: link explicit owner approval for the exact SHA, action and target.
  Review approval alone grants neither merge nor deploy authority. Merge and
  preview/production deployment each need their own authorization.
- RELEASED: link actual authorized publication, immutable artifact, smoke results
  and rollback evidence. A merged PR or preview preflight is not a release.

Handoff summary must include real executor, task/authorization, current state,
base and candidate SHA, PR, files, actual local/CI checks and references, real
reviewer or pending, security implications, limits and human gates. Later evidence
updates the PR record; never claim events merely because they are planned.

The structural validator does not authenticate actors, sessions, links or events.
An `independent_reviewer` label or editable PR text is not an authorization gate.
Humans must inspect original evidence. Future merge/deploy automation must verify
identity, authorization and candidate evidence through trusted APIs and controls
outside editable PR content; this pilot implements no such automation.

Run `node --test tests/orchestration.test.mjs` for the focused documentation gate;
it is also included by the existing `npm test` and `npm run verify` commands.

## Pilot #3 and next integration (proposal only)

Issue #3 authorizes Codex alone to implement documentation and a local validator,
create branch/commit/push/PR, and run checks. The PR is the live evidence record:
SCOPED/ASSIGNED/IMPLEMENTED are recorded only once supported; CI_PASSED follows
inspection of that PR's checks. Astra review and owner approval remain separate
pending gates. No release is authorized. No changes to Recorte, functional code,
SEO, CSP, monetization, Cloudflare, credentials or branch protections are in scope.

Lowest-cost next step: reuse GitHub's existing read-only CI and assign each scoped
ticket to Codex Cloud with a GitHub-connected environment, or an owner-controlled
Codex CLI/SDK runner. Choose based on available account credits and measured cost;
do not assume either is free. Pass only issue, base SHA and scoped context. The
executor returns a branch/PR and exact head SHA. Read CI evidence, then hand the
same base/diff/SHA to a separately invoked Astra reviewer. The owner decides merge
and, under a separate release ticket, preview/production deployment. No queue,
AI orchestrator, token bot, new service or write-permission workflow is needed.

This chat cannot establish a persistent unattended runner, provision account
entitlements, schedule autonomous Astra execution, or grant itself GitHub/Cloudflare
permissions. Independent Astra review must actually be invoked through an available
authorized interface; a text request is not completed review. Human approval cannot
be manufactured or inferred. This pilot configures none of those integrations,
and does not implement merge, branch protection or publication automation.

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
