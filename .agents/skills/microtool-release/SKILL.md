---
name: microtool-release
description: Check approvals, tested artifact provenance, environment separation and rollback before an explicitly authorized deploy.
---
Read `RELEASE.md` and the exact workflow. Production is NOT implemented in starter v0.1. Only run approved preview deployment after checking main SHA, selected target, scoped secrets and green tests. Report immutable evidence of source/tree and asset bytes plus the actual preview endpoint. Record resource state and rollback reference. Never copy tokens/namespaces from Recorte. Stop instead of bypassing any guard; do not claim dry-run equals actual publish.
