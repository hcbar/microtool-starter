# Lightweight threat model template — fill for every product

- **Assets:** visitor files/content; site integrity; Cloudflare credits; SEO; secrets; third-party API budgets.
- **Trust boundaries:** browser -> same-origin assets; browser -> Worker (backend only); Worker -> upstream (if any); site -> ad/analytics (separate integration only).
- **Untrusted inputs:** uploaded files, file metadata, filenames, API bodies, URL strings, headers, query params, upstream responses, third-party scripts.
- **Attack scenarios:** invalid file crash/OOM; file exfiltration; XSS from dynamic strings; malicious dependencies; open proxy/SSRF; quota abuse/cost attacks; ad impersonating tool actions; exposed secrets; unreviewed deployment drift.
- **Mitigations:** browser size/dimension caps, `textContent` and HTML escaping, no external fetch by default, allowlist and redirect controls for backend, restrictive CSP, strict credentials, CI and protected release.
- **Residual risks:** memory use of native decoders, service provider logs, browser differences, distributed abuse, CDN/cache edge behavior, unknown zero-days.
- **Risk owner and approval:** [fill].
- **Audit evidence:** exact SHA, test logs, report severity, what was *not* tested, accept/reject.
