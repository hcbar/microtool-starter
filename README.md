# Microtool Starter v0.2 — small functional products, repeatable security gates

An **independent starter**, inspired by the process used in `hcbar/recorte`, **not a fork of its source**. Default: usable in-browser image compressor; zero runtime/npm dependencies; English/Portuguese/Spanish prerendered URLs, responsive UI, Cloudflare Workers Static Assets config, CI, isolated preview workflow, monetization policy, and three agent skills.

**Status:** working *starter candidate* verified locally; **not certified as a production-release framework**. The Recorte 1.0 production controls were designed for its own deployment and are not automatically inherited. Do not equate this preview workflow with Recorte's tested-artifact prepare/launch process.

## Start

Requirements: Node >=22.13, npm.

```sh
npm ci
npm run verify
npm run dev
```

**Windows PowerShell:** use `npm.cmd ci`, `npm.cmd run verify`, `npm.cmd run dev` (PowerShell often blocks `npm.ps1`; do **not** weaken execution policy). Keep the terminal with `dev` running while opening the local URL. The dev command rebuilds a clean **noindex preview** before serving; stop with Ctrl+C.

Browser smoke (real Chromium, separate from the 12 fast Node tests):

```sh
python -m pip install playwright==1.57.0
python -m playwright install chromium
python tests/browser-smoke.py
```

On Windows, use `py -m pip`, `py -m playwright` and `py tests/browser-smoke.py`. In CI this test is required and is run with Chromium installed from the pinned Playwright version.

Open `http://127.0.0.1:4173/`, `/pt/` or `/es/`.

Generate a product configuration from the template:

```sh
npm run new:product -- image-100kb "Image 100 KB" local
npm run verify
```

This **only changes metadata**. Replace the sample copy in `config/product.json` and the example utility in `src/` with the approved implementation. **Never ship an unchanged sample app under a different function name.** Set the actual `siteUrl` and `indexable: true` only for a deliberately approved production candidate. Preview builds remain `noindex`.

## Two profiles

- `local`: static assets only. Best for compressing images, converting audio, removing EXIF (after implementation). No Durable Object, quotas, cookies, API endpoints or server-side file uploads.
- `backend`: additionally deploys `worker/api.mjs` for `/api/*`. Default is a health endpoint only; no open proxy. **Not production-ready for fetching arbitrary remote URLs.** Add a threat model, input limits, SSRF allowlist, quota protection, authorization where appropriate and adversarial tests *before* adding upstream fetching.

Switch `config/product.json` profile and rerun `npm run verify`; derived `wrangler.preview.jsonc` / `wrangler.production.jsonc` are generated; review before any deployment. Different Workers are named `<slug>-preview` and `<slug>`.

## SEO and localization

`npm run build` defaults to `DEPLOY_TARGET=preview`: it **always** generates `noindex`, `robots.txt` disallow and no sitemap. Production with a verified `siteUrl` and `indexable: true`:

```sh
DEPLOY_TARGET=production npm run verify
DEPLOY_TARGET=production npm run manifest
```

This produces prerendered HTML in `/`, `/pt/`, `/es/` and canonical/hreflang, sitemap and robots only when eligible. This is **not** a production deployment; the production release procedure is intentionally approval-gated and needs environment-specific implementation. Do not clone thin keyword variants without genuinely different functionality.

## Monetization defaults

`config/product.json`: `monetization.policy: responsible`, `adsEnabled: false`, `analyticsEnabled: false`, `premiumEnabled: false`. These flags are **gates**, not working integrations. Enabling them without a reviewed integration intentionally fails `npm run check`. Consult [MONETIZATION.md](MONETIZATION.md) before any scripts, cookies, consent or CSP changes.

## Audit remediation candidate (v0.2.2)

Following independent Astra audit of `main@3874749`, this candidate removes the unchecked small-JPEG bypass (every image is decoded and output is re-encoded as JPEG, avoiding accidental retention of source metadata), prechecks known JPEG/PNG/WebP dimensions from a bounded header sample, and makes preview and indexable-production checks independent. Node regressions and Chromium browser smoke cover invalid JPEG, valid small JPEG, oversized declared dimensions and stale operations. Native decoding may still use device-dependent memory; `noindex` and a green CI do not grant deployment authorization.

The audit still BLOCKS real preview and production deployment until branch protection, an independently reviewed locked publisher, exact artifact identity, isolated credentials, remote smoke/rollback and supply-chain pinning are implemented and verified. See `docs/audit-remediation.md`.

## CI / releases

- CI (`.github/workflows/ci.yml`) checks config, generates HTML, runs deterministic Node tests AND a real Chromium smoke (file compression, downloaded JPEG, three locales, mobile, invalidation of stale result, external requests), validates CSP/noindex and records SHA256 assets.
- Manual preview **preflight** workflow (`deploy-preview.yml`) validates the isolated Worker name and preview noindex, produces an artifact and **never deploys**. The v0.1 preview publisher was deliberately disabled in v0.2 because its transient `npx` install could execute an unlocked supply chain with Cloudflare tokens. A lockfile-pinned, independently audited publisher is pending.
- There is intentionally **no unattended production deploy** in v0.1. Read [RELEASE.md](RELEASE.md). Reproducing Recorte's fully controlled prepare/launch, protected branch, sealed manifest and rollback checks is a remaining milestone, not an accomplished claim.

## Import into GitHub

See [Windows GitHub setup](docs/github-setup-windows.md). This package is a local artifact; it has not been pushed or deployed. Do not commit build outputs or secrets.

## Acceptance plan

1. Exercise compressed image output with a real JPG/PNG in Chromium, mobile and Safari; verify byte target is best-effort, not guaranteed.
2. Instantiate another function type from the same template, e.g. local audio utility; require real automated regressions. **Not yet done.**
3. Instantiate backend profile; test quota/SSRF and deployment isolation when backend endpoints exist.
4. Pass an independent security review bound to the exact commit and CI evidence. See [audit packet](docs/audit-packet.md).
5. Wire an approved production publisher with rollback and account budget alarms; then consider the starter stable.

**Recorte is read-only reference:** no files, secrets, namespaces, Deployments, DNS, or quotas in `hcbar/recorte` are touched by this project. The archived version of its process lives in its `AGENTS.md` and `.agents/skills/workers-development-review-release/SKILL.md`.

## Codex bridge pilot: DISABLED / DRY_RUN

Issue #4 adds a read-only diagnostic workflow, with **no Codex executor** and no
LIVE switch. It neither writes code nor opens PRs. This implementation PR is
created by the manually started Codex task, separately from the bridge.
See [the command, security contract and remaining gates](docs/codex-dry-run.md).
No OpenAI key is configured or needed. Future OpenAI Platform/API usage has
separate billing from ChatGPT Plus and requires explicit budget approval.
