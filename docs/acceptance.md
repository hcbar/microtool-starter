# Acceptance and comparability

For each product report: task throughput and success rate; unique visits; Google Search Console impressions, clicks and query families; build/test lead time; human intervention minutes; estimated compute/AI credits; number of new vulnerabilities/remediations; infrastructure cost per 1,000 successful tasks; mobile task completion. Compare baseline Recorte only with explicitly recorded measurements. Do not invent a percent of time/tokens saved.

The starter is **proven reusable** only when at least two distinct actual tools (one file-oriented; the other using a different functional core) are generated, tested and published to isolated preview environments without redesigning the process.

The initial example now also has a real Chromium smoke test. It does not prove Safari or physical-mobile compatibility, nor a hardened production release. A rendered page is not proof the tool itself works; require at least one actual output file and stale-result cancellation test.
