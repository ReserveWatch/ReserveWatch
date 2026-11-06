# Briefs — routine wiring (parent owns UpdateRoutine)

Content sink: `src/content/briefs.ts` (`BRIEFS` array, newest first). Routes: `/briefs`, `/briefs/{slug}`. Sitemap + nav/footer already include them.

## Monday issuer-scan
1. Diff live `/api/tokens` (and any new issuer research) against `TOKENS` / prior week snapshot.
2. If a **new commodity issuer** is added to the registry, or a material soft-label appears, prepend a Brief (`kind: 'new-issuer' | 'soft-label'`) with ledger facts only — no invented addresses, no buy/sell language.
3. Redeploy from `/workspace/xrpl-health-monitor` (`fly deploy -a reservewatch --depot=false --buildkit`). Do not rotate Fly secrets.

## CRITICAL / peg-break / flag-change (on event)
1. When alert log or live status hits CRITICAL (or peg flips to reliable CRITICAL / Global Freeze / unverified), prepend a Brief (`kind: 'critical' | 'flag-change' | 'measurement'`).
2. Cite `asOf` from the `/api/tokens` timestamp used. Link `/token/{id}` + `/methodology`.
3. Redeploy. Request GSC URL inspection for `/briefs/{slug}` after first publish if indexing is slow.

## Thursday cadence
Optional: if Monday scan found nothing but a weekly snapshot notes a material measurement change (e.g. new quote asset depth), publish a short `measurement` brief pointing at that week's `/snapshots/{date}`.

Empty state: if `BRIEFS` is `[]`, `/briefs` shows an honest empty notice (pipeline still live).
