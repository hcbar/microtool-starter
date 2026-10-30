# Baseline security and proportional reviews

**Never claim absolute safety.** Threat model depends on the selected profile and functionality. See `docs/threat-model.md`.

## Default protections
- No backend for local tools; no server persistence of user files by this app.
- CSP restricts script/style/connect to self; denies object/frame, geolocation, microphone, camera and payment capabilities.
- No third-party scripts, ads or analytics initially; no service workers, user accounts, cookies or data collection.
- Audio product limits: 25 MiB touch/mobile or 50 MiB desktop before reading; at most 6 minutes, a 120-second disposable-worker watchdog, supported container/audio probe, bounded output. See `docs/threat-model.md` for allocation and browser risks.
- Outputs are user-initiated; object URLs are revoked on source replacement/page exit.
- Preview is `noindex`; production indexability requires verified origin and explicit build target. The preflight publishes no bytes to Cloudflare; deployment credentials are not accessed.
- No secrets in Git/HTML/client or logs; `.gitignore` covers common envs.

## Risk-triggered review matrix

| Change | Minimum gates |
|---|---|
| Copy/SEO/CSS | Config/HTML tests; mobile visual where applicable |
| File processor local | Tests with malformed, large, cancelled, unsupported and real representative files; RAM/browser variability |
| Third-party script/advertising | Supply chain, domains, CSP, consent, cross-border data, performance and disclosures |
| Backend endpoint/upstream | SSRF, redirects, DNS/rebinding, allowlist, resource limits, quotas, abuse costs, error leaks, concurrency |
| Auth/payment/data persistence | Separate specialized threat model; authentication/access controls/privacy/regulatory review |
| CI/workflow/deploy/secrets | Independent review mandatory; environment isolation, effective token permissions, artifact provenance, rollback |

`npm run verify` is a basic static/unit gate; Browser smoke (Python Playwright 1.57.0) is required in CI but separate from `npm run verify`. Add SAST/SCA, code scanning and locked Wrangler supply chain before authorizing any actual deploy. This is NOT the complete Recorte audit matrix. No external scan is configured at this stage.
