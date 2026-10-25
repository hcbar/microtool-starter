# Issue #4 — disabled executor, dry-run diagnostic

The latest coordination evidence supersedes the original unprotected-main note:
[ruleset 25832374](https://github.com/hcbar/microtool-starter/rules/25832374) is active,
with no bypass, PR + strict `verify` required, force push/deletion blocked. GitHub
review count is zero: independent audit and owner merge authorization remain
process gates. The [latest issue checkpoint](https://github.com/hcbar/microtool-starter/issues/4#issuecomment-6401752302)
records Work PR-open trigger PASS; automatic Codex start and automatic Astra audit
remain unproven/unconfigured. This PR changes neither Work nor those protections.
Base inspected for this task: `a51b1b9fa03246d6f69afed531ea7be52c465508`.

## Trigger and contract

After human review and a separately authorized merge, the workflow on the default
branch can receive a new **issue comment** on open Issue #4 containing exactly:

```text
/codex dry-run <current-main-40-character-lowercase-SHA>
```

Replace the placeholder; no additional text, newline, paths, credentials, mode or
repository parameters are accepted. This mechanism uses the coordinator's existing
comment capability. It avoids assuming a label proves owner authorization. The
workflow only wakes a diagnostic job for `/codex` comments on Issue #4; it does not
trigger on issue creation, push or PR. GitHub provides the authenticated event
file: no public webhook or custom signature/token service is added.

The script checks repository, owner ID `154026289`, default branch, open issue
number, absence of a PR, event/action, comment ID, sender ID/type, comment author
ID/type and actor ID. A connector bot is **not** implicitly authorized. If its
sender differs, the real invocation must fail; do not expand the whitelist on the
basis of editable names or claims. Re-run attempts are denied. GitHub API verifies
that the requested base is the current protected main SHA. Issue prose is ignored;
comment text is parsed as data and never interpolated into a shell or model prompt.
The only scope is a diagnosis of this repository/issue/base, with zero patch paths.

Output is a bounded JSON diagnostic in logs and step summary, including `DRY_RUN`,
`executor=DISABLED`, repository, issue, base, dedup result and `live=false`.
Failures emit fixed codes and fail the job without printing payloads or HTTP bodies.
The job has only contents/issues/actions read access, a 3-minute timeout, pinned
action SHAs, no persisted checkout credentials and no dependency installation.
Only GitHub GET requests are made with the ephemeral read-only GitHub token.
No API key, model invocation, publisher, deploy, automatic merge or LIVE path exists.
GitHub Actions runner minutes can still count against the account's plan/quota.

## Duplicate policy and limits

The key is `(repository, issue, exact command including base SHA)`. A per-issue
concurrency group serializes diagnostics with `cancel-in-progress: false`; GitHub
may replace a pending run, so this is not a reliable delivery queue. The script
reads up to 1,000 runs of this workflow (issue_comment only) and rejects any earlier
matching run title, including failed or cancelled runs. Same-run retries are also
rejected. Missing, inconsistent, unavailable or excessive history fails closed as
`DEDUP_UNVERIFIED`. There is no history-based fallback that executes an agent.

This is **history-bound duplicate suppression**, not durable exactly-once delivery:
GitHub retention/deletion may erase old evidence. Concurrency protects overlapping
jobs, not permanent storage. Untrusted comments may consume a key or runner quota
and deny service. No side-effecting executor exists to double-charge or publish.
A future LIVE design needs an atomic durable reservation with ownership, expiry,
recovery and replay rules; Actions history/cache alone is insufficient. Work's
separate best-effort dedup remains unchanged.

## Validation and real-event evidence

`node --test tests/codex-dry-run.test.mjs` covers valid dry-run; wrong identity/bot,
repo/issue/PR/event; malformed command, LIVE/secret/shell-like parameters; unprotected
or stale base; repeats/retries; pagination, truncation, API failures and workflow
permissions/pins. `npm run verify` includes these tests. Fixtures are synthetic
unit inputs, not evidence of authenticated GitHub delivery or real sender identity.

The new issue_comment workflow cannot be exercised on this unmerged PR: GitHub
loads that trigger from the default branch. Do not merge to manufacture evidence.
After separately authorized review/merge, the owner/coordinator may post the exact
command once, inspect the real sender and diagnostic, then post it again to observe
`DUPLICATE_DENIED`. Record run URLs, sender ID, base and result. Do not edit the
payload to fake ownership. This task does not post that command or change labels.

## Future design only — requires a separate PR and authorization

Compare available paths before funding custom infrastructure:

| Route | Cost and intervention | Risk/complexity |
| --- | --- | --- |
| Existing Codex Cloud with ChatGPT | Current manually started path; account credits/limits apply | No paid bridge needed; unattended start still unproven |
| GitHub coding agent assignment | Requires account/plan availability; agent not previously visible in assignees | Prefer native assignment if it becomes available; verify entitlement first |
| GitHub Actions + Codex API | Separate Platform billing and explicit budget/egress caps | Reproducible but requires isolated credentials, durable dedup and publication gates |
| Owner-local Codex CLI | ChatGPT authentication/credits subject to current terms; machine must stay on | Requires authenticated local broker and sandbox; never copy login tokens into Actions |

LIVE would require Astra's independent review of the exact diff/SHA, owner approval,
current protection verification, cost/token/time/egress limits and provisioned
restricted authentication (evaluate supported federation before persistent keys).
Use an isolated Linux execution job, contents read, checkout credentials disabled,
pinned actions/tools, `safety-strategy: drop-sudo`; never install dependencies with
a model credential present or run untrusted PR code with privileged event tokens.
Treat issue data as lower-trust specification, never superior instructions.

A separate credential-isolated publisher, with no model key, would validate artifact
hash/provenance, exact base, file allowlist, sizes and patch semantics before creating
a scoped branch/PR. Executor gets no GitHub write token. Publication must recheck
candidate/base and reservations; merges/deploys remain human-authorized. No publisher
or executable LIVE skeleton is included here. Per-repo installation is simplest
and isolates blast radius; a central GitHub App/service could reduce duplicated
secrets/workflows across products but adds service/auth/tenant-isolation burden.
Do not build it without measured need and a separate audit.

No changes or access to `hcbar/recorte`, Cloudflare, credentials or administrative
repository settings are part of this pilot. Implementer self-checks are not an
independent Astra review; that review remains pending.
