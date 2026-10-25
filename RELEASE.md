# Release procedure and gates

## Status

Only `preview` has a starter workflow. This is a **candidate**, not equivalent to the Recorte 1.0 controlled production prepare/launch. The separate production publisher and post-launch updater are pending validation and must not be improvised.

## Preview — preflight only in v0.2

A GitHub Actions workflow called **Preview release preflight (no deploy)** accepts `PREFLIGHT` and validates the indexation/destination, runs checks and publishes review artifacts. It **never reads Cloudflare tokens** and **never deploys**. The older v0.1 workflow could run a transient `npx` dependency graph while holding Cloudflare credentials; this is not acceptable as a reusable default.

To enable preview deployment in a later approved PR, lock the publisher and all dependencies, install without credentials, use a distinct least-privilege Cloudflare token scoped to the preview Worker, verify actual destination/bindings and SHA, and run a post-deploy smoke with rollback reference. Audit this change independently. A passing preflight is not proof of an actual Cloudflare deployment.

## Production — deliberately not yet automated

Prerequisites: reviewed prod-specific GH environment with branch protection; separate Worker account permissions and credentials; SHA-and-bytes identity proof, prod build with `DEPLOY_TARGET=production`, noindex/indexability checks; published domain/DNS/TLS checks, cost alert, rollback by version ID and post-deploy verification. Use the Recorte's pattern, not its actual secrets/Worker IDs.

Require a deployment dry-run and independent review of changes to deployment scripts. Avoid rebuilding untested assets at promotion time. Record manifest SHA256, source SHA, approved reviewer, UTC timestamp, Worker/version, smoke results and rollback reference.
