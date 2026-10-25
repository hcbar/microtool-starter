# Put this starter in its own GitHub repository (Windows PowerShell)

This operation is not automated by the starter. It requires the owner's explicit creation of a distinct repo; do **not** use `hcbar/recorte` or copy its secrets.

1. Visit https://github.com/new and create `hcbar/microtool-starter`, preferably **private** initially. Do **not** check "Add README", .gitignore or license because they already exist in the ZIP.
2. Extract the ZIP and open a PowerShell in the **inner** `microtool-starter` directory (the one with `package.json`).
3. If Git is installed and authenticated, execute:

```powershell
git init
git add .
git commit -m "chore: initialize independent microtool starter v0.2"
git branch -M main
git remote add origin https://github.com/hcbar/microtool-starter.git
git push -u origin main
```

4. Verify on GitHub that the workflow **Verify starter-derived product** runs; it includes the real-browser test and may need browser dependencies on GitHub Actions.
5. Settings -> General -> **Template repository** after reviewing the contents and CI. If your GitHub plan/repository visibility restricts some protection settings, do not assume required-status-check enforcement is active.
6. Pass the exact commit SHA and CI result to Astra with `docs/audit-packet.md`. Treat all review findings as scoped to that SHA. Revisions require a new candidate and validation.

Do not configure Cloudflare secrets yet. This starter currently has only a manual preview **preflight** (no deploy) and no production publisher. Adding deploy is a separate security-sensitive change with independent review, bounded credentials and explicit approval.
