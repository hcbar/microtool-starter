# Responsible monetization policy — adapted from Recorte 1.0 (PR #17)

**Policy: permitted. Integrations: OFF.** Advertising, sponsors, premium features and analytics are allowed after separate explicit approval and validation. There is no perpetual no-ads restriction.

- Utility must work before commercial content; no fake download buttons, obstructive interstitials, automatic redirects, audio autoplay or ad overlays over save/cut/convert actions.
- Inspect publisher ad policies, third-party platform rights and whether the use case is eligible. Never promise acceptance by AdSense.
- Keep task-completion rate, CLS/LCP/INP, mobile accessibility and cost per task as pre/post metrics; include rollback.
- Document actual recipients, SDK domains, cookies, identifiers, data purposes, retention, consent requirements per jurisdiction and user notices in each language before enabling anything.
- Never share private file contents, source URLs, HMAC quota IDs, signed tickets or internal API request bodies with ad vendors.
- Change CSP only by narrow allowlist after review. Third-party script installation is **not** authorized by merely flipping a config flag.
- For local tools, distinguish client-side files from ad/analytics requests; "files stay in browser" does not imply "no data whatsoever leaves browser" if ads exist.
- Integrations require their own ticket, PR, focused tests, separate security review, preview validation, and release approval.
