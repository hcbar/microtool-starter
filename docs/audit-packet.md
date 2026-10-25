# Independent reviewer handoff — v0.2

Give this to Astra (or another auditor in an independent session) after committing the starter to a dedicated repository. Attach **the exact SHA/diff, `npm run verify` logs, CI browser run, and threat model**. A self-review by Codex/ChatGPT is not independent.

## Scope

- Source/config: `config/`, `src/`, `scripts/`, `worker/`, `package*.json`, `.github/workflows/`, `wrangler.*`, `.agents/skills/`
- Threat model: `docs/threat-model.md`, `SECURITY.md`, `MONETIZATION.md`
- Verify functional file handling: input validation, MIME sniff vs claimed type, size/pixel limits and RAM/CPU exhaustion, late results, object-URL lifetime, unsupported codecs, error privacy
- Verify HTML/SEO: escaping and unsafe attributes, CSP/HTTP headers, default noindex, actual content vs generated metadata, domain/index gating
- Verify local/backend isolation: no arbitrary proxy, endpoints and methods, no secret leaks, Cloudflare resource isolation and permissions
- Verify supply chain: locked versions, any CI command fetched remotely, GitHub token exposure, action immutability, build-vs-release artifact integrity
- Verify future monetization controls: flags cannot silently enable scripts; CSP/consent and data disclosures require independent PR
- Verify reproducibility: clean checkout; Windows PowerShell `.cmd` instructions; Node 22/24; CI branch contexts; real browser test and its limits
- Verify v0.2 has **no Cloudflare deploy** and no production publisher. Do not treat docs as evidence of enforceability.

## Required review output

1. Fixed SHA and base; tests actually executed vs not executed.
2. Findings table with **severity, evidence (reproduced/theoretical), exploit conditions, precise path/line and minimal reproduction**.
3. Blocking criterion for each confirmed issue; suggested focused fix and regression test.
4. Residual risks/untested surfaces; separate "not assessed" from "safe".
5. Explicit **PASS / PASS WITH CONDITIONS / BLOCK** for candidate, scoped to this SHA.

Do **not** review or mutate `hcbar/recorte`; it is reference only. Never request or echo Cloudflare credentials.
